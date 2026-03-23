
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
import { TrackingDto, TrackingType } from './tracking.dto';
import { EventType } from '../../shared/types';
import { randomUUID } from 'crypto';
import { AnalyticsService } from '../analytics/analytics.service';
import { CalibrationService } from '../engine/services/calibration.service';
import { EventProducerService } from '../events/producers/event-producer.service';
import {
  ImpressionEvent,
  ClickEvent,
  ConversionEvent,
  VideoVTREvent,
  VideoEventType,
} from '../events/types/event.types';

@Injectable()
export class TrackingService {
    private readonly logger = new Logger(TrackingService.name);

    // TTL configurations
    private readonly IMP_TTL_VIDEO = 25 * 60 * 60; // 25 hours for video ads (all events use imp_id)
    private readonly IMP_TTL_DEFAULT = 2 * 60 * 60; // 2 hours for non-video ads (only for impression -> click validation)
    private readonly CLICK_TTL = 25 * 60 * 60; // 25 hours for click_id (for conversion validation)

    constructor(
        private redisService: RedisService,
        private analyticsService: AnalyticsService,
        private calibrationService: CalibrationService,
        private eventProducer: EventProducerService,
    ) { }

    async track(dto: TrackingDto): Promise<void> {
        let campaignId: number = 0;
        let creativeId: number = 0;
        let userId: string | undefined;
        const impId = dto.imp_id;
        const clickId = dto.click_id || impId; // imp_id and click_id are same value when both present
        let trackingIdValid = false;

        // Extract basic IDs from URL params (used for event reporting)
        campaignId = dto.cid ? parseInt(dto.cid, 10) : 0;
        creativeId = dto.crid ? parseInt(dto.crid, 10) : 0;
        userId = dto.uid || '';

        // Try imp_id-based tracking first (new flow)
        if (impId) {
            // Check if imp_id exists
            const impExists = await this.redisService.exists(`imp:${impId}`);
            trackingIdValid = impExists > 0;

            // Handle impression event: mark imp_id as existing
            if (dto.type === TrackingType.IMP) {
                // For simplicity, use 25h TTL for all imp entries (still 70%+ saving vs pre-storing)
                // Can optimize to 2h for non-video later if needed
                await this.redisService.set(`imp:${impId}`, '1', this.IMP_TTL_VIDEO);
                trackingIdValid = true;
                this.logger.log(`Marked imp_id as active: ${impId}`);
            }

            // Handle click event: validate imp exists first
            if (dto.type === TrackingType.CLICK) {
                // Reject clicks without corresponding impression
                if (!trackingIdValid) {
                    this.logger.warn(`Discarded click event with invalid/expired imp_id: ${impId}`);
                    return;
                }

                // Mark click_id as existing for conversion validation
                if (clickId) {
                    await this.redisService.set(`click:${clickId}`, '1', this.CLICK_TTL);
                    this.logger.log(`Marked click_id as active: ${clickId}`);
                }
            }

            this.logger.log(`Tracking event (imp_id: ${impId}, cid: ${campaignId}, crid: ${creativeId})`);
        }
        // Fallback to click_id-based tracking (compatibility with old URLs)
        else if (dto.click_id) {
            // Check if click_id exists
            const clickExists = await this.redisService.exists(`click:${dto.click_id}`);
            trackingIdValid = clickExists > 0;

            // For backward compatibility: if this is an impression on old URL, store click_id
            if (dto.type === TrackingType.IMP) {
                await this.redisService.set(`click:${dto.click_id}`, '1', this.CLICK_TTL);
                trackingIdValid = true;
            }

            this.logger.log(`Tracking event (click_id: ${dto.click_id}, cid: ${campaignId}, crid: ${creativeId})`);
        }
        // Fallback to legacy method (cid/crid)
        else if (dto.cid && dto.crid) {
            campaignId = parseInt(dto.cid, 10);
            creativeId = parseInt(dto.crid, 10);
            userId = dto.uid || '';
            requestId = randomUUID();
            clickId = undefined;

            this.logger.log(`Tracking via legacy method: campaign ${campaignId}, creative ${creativeId}`);
        } else {
            this.logger.warn('Invalid tracking request: missing click_id or cid/crid');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const eventTime = Date.now();

        // 1. Determine Event Type
        let eventType = EventType.IMPRESSION;

        if (dto.type === TrackingType.CLICK) eventType = EventType.CLICK;
        if (dto.type === TrackingType.CONV || dto.type === TrackingType.CONVERSION) {
            eventType = EventType.CONVERSION;
            // 转化事件必须有有效的ID（在Redis中存在），否则直接丢弃
            let valid = trackingIdValid;
            let id = impId || clickId;

            // If only click_id is provided, ensure it exists
            if (!impId && dto.click_id && !valid) {
                const clickExists = await this.redisService.exists(`click:${dto.click_id}`);
                valid = clickExists > 0;
                id = dto.click_id;
            }

            if (!valid) {
                this.logger.warn(`Discarded conversion event with invalid/expired ID: ${id}`);
                return;
            }
        }
        // These assignments are only used by the legacy analytics service below
        // The new event pipeline handles all video types directly as VIDEO_VTR in sendToEventPipeline()
        if (dto.type === TrackingType.VIDEO_START) eventType = EventType.VIDEO_START;
        if (dto.type === TrackingType.VIDEO_FIRST_QUARTILE) eventType = EventType.VIDEO_FIRST_QUARTILE;
        if (dto.type === TrackingType.VIDEO_MIDPOINT) eventType = EventType.VIDEO_MIDPOINT;
        if (dto.type === TrackingType.VIDEO_THIRD_QUARTILE) eventType = EventType.VIDEO_THIRD_QUARTILE;
        if (dto.type === TrackingType.VIDEO_COMPLETE) eventType = EventType.VIDEO_COMPLETE;

        // 2. Send to new event pipeline (Kafka/LevelDB)
        await this.sendToEventPipeline(dto, clickId, eventTime);

        // Legacy Postgres/BigQuery persistence removed - only Kafka pipeline is used

        // 4. Update Redis Counters
        // We cannot update budget/freq without campaign_id/user_id.
        // If campaignId is known (legacy path), we update.
        if (campaignId > 0) {
            if (eventType === EventType.IMPRESSION) {
                if (userId) {
                    const key = `freq:${userId}:${campaignId}`;
                    await this.redisService.incr(key, 86400); // 1 day TTL
                }
            } else if (eventType === EventType.CLICK) {
                // Click calibration moved to event pipeline
            } else if (eventType === EventType.CONVERSION) {
                // Conversion calibration moved to event pipeline
            }
        }
    }

    /**
     * Send event to the new Kafka/LevelDB pipeline
     */
    private async sendToEventPipeline(
        dto: TrackingDto,
        clickId: string | undefined,
        eventTime: number,
    ): Promise<void> {
        if (!clickId) {
            this.logger.debug('No click_id, skipping event pipeline');
            return;
        }

        try {
            switch (dto.type) {
                case TrackingType.IMP: {
                    const event: ImpressionEvent = {
                        clickId,
                        eventTime,
                    };
                    await this.eventProducer.produceImpression(event);
                    break;
                }
                case TrackingType.CLICK: {
                    const event: ClickEvent = {
                        clickId,
                        eventTime,
                    };
                    await this.eventProducer.produceClick(event);
                    break;
                }
                case TrackingType.CONV:
                case TrackingType.CONVERSION: {
                    const event: ConversionEvent = {
                        clickId,
                        eventTime,
                        conversionValue: dto.conversion_value ? parseFloat(dto.conversion_value) : undefined,
                        conversionType: 'conversion',
                    };
                    await this.eventProducer.produceConversion(event);
                    break;
                }
                case TrackingType.VIDEO_START: {
                    const event: VideoVTREvent = {
                        clickId,
                        eventTime,
                        eventType: VideoEventType.START,
                        progressPercent: 0,
                    };
                    await this.eventProducer.produceVideoVTR(event);
                    break;
                }
                case TrackingType.VIDEO_FIRST_QUARTILE: {
                    const event: VideoVTREvent = {
                        clickId,
                        eventTime,
                        eventType: VideoEventType.FIRST_QUARTILE,
                        progressPercent: 25,
                    };
                    await this.eventProducer.produceVideoVTR(event);
                    break;
                }
                case TrackingType.VIDEO_MIDPOINT: {
                    const event: VideoVTREvent = {
                        clickId,
                        eventTime,
                        eventType: VideoEventType.MIDPOINT,
                        progressPercent: 50,
                    };
                    await this.eventProducer.produceVideoVTR(event);
                    break;
                }
                case TrackingType.VIDEO_THIRD_QUARTILE: {
                    const event: VideoVTREvent = {
                        clickId,
                        eventTime,
                        eventType: VideoEventType.THIRD_QUARTILE,
                        progressPercent: 75,
                    };
                    await this.eventProducer.produceVideoVTR(event);
                    break;
                }
                case TrackingType.VIDEO_COMPLETE: {
                    const event: VideoVTREvent = {
                        clickId,
                        eventTime,
                        eventType: VideoEventType.COMPLETE,
                        progressPercent: 100,
                    };
                    await this.eventProducer.produceVideoVTR(event);
                    break;
                }
            }
        } catch (error) {
            this.logger.error('Failed to send event to pipeline', error);
            // Don't throw - allow tracking to continue with legacy path
        }
    }
}
