
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
import { TrackingDto, TrackingType } from './tracking.dto';
import { EventType } from '../../shared/types';
import { randomUUID } from 'crypto';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class TrackingService {
    private readonly logger = new Logger(TrackingService.name);

    constructor(
        private redisService: RedisService,
        private analyticsService: AnalyticsService,
    ) { }

    async track(dto: TrackingDto): Promise<void> {
        let campaignId: number;
        let creativeId: number;
        let userId: string | undefined;
        let requestId: string;
        let clickId = dto.click_id;

        // Context fields - Now mostly empty for lightweight tracking
        let device: string | undefined;
        let browser: string | undefined;
        let country: string | undefined;
        let city: string | undefined;
        let ip: string | undefined;
        let bid = 0;

        // Try click_id-based tracking (lightweight)
        if (dto.click_id) {
            // We NO LONGER fetch context from Redis.
            // We rely on DB to join 'click_id' with the original 'REQUEST' event.
            campaignId = 0; // Unknown
            creativeId = 0; // Unknown
            userId = '';    // Unknown
            requestId = ''; // Unknown

            this.logger.log(`Tracking via click_id: ${dto.click_id} (Lightweight - Log & Join)`);
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

        // 1. Determine Event Type & Cost
        let eventType = EventType.IMPRESSION;
        let cost = 0;

        if (dto.type === TrackingType.CLICK) eventType = EventType.CLICK;
        if (dto.type === TrackingType.CONV || dto.type === TrackingType.CONVERSION) {
            eventType = EventType.CONVERSION;
        }
        if (dto.type === TrackingType.VIDEO_START) eventType = EventType.VIDEO_START;
        if (dto.type === TrackingType.VIDEO_FIRST_QUARTILE) eventType = EventType.VIDEO_FIRST_QUARTILE;
        if (dto.type === TrackingType.VIDEO_MIDPOINT) eventType = EventType.VIDEO_MIDPOINT;
        if (dto.type === TrackingType.VIDEO_THIRD_QUARTILE) eventType = EventType.VIDEO_THIRD_QUARTILE;
        if (dto.type === TrackingType.VIDEO_COMPLETE) eventType = EventType.VIDEO_COMPLETE;

        if (dto.cost) cost = parseFloat(dto.cost);

        // 2. Persist to DB (Postgres and/or BigQuery) via AnalyticsService
        const eventTime = new Date();
        this.analyticsService.trackEvent({
            request_id: requestId,
            click_id: clickId,
            campaign_id: campaignId,
            creative_id: creativeId,
            user_id: userId,
            event_type: eventType,
            event_time: eventTime.getTime(),
            cost: cost,
            ip: ip,
            country: country,
            city: city,
            device: device,
            browser: browser,
            bid: bid,
            price: cost,
            conversion_value: dto.conversion_value ? parseFloat(dto.conversion_value) : null,
        });

        // 3. Update Redis Counters
        // We cannot update budget/freq without campaign_id/user_id.
        // If campaignId is known (legacy path), we update.
        if (campaignId > 0) {
            if (eventType === EventType.IMPRESSION && userId) {
                const key = `freq:${userId}:${campaignId}`;
                await this.redisService.incr(key, 86400); // 1 day TTL
            }

            if (cost > 0) {
                const key = `budget:${campaignId}:${today}`;
                await this.redisService.hincrbyfloat(key, 'spent_today', cost);
            }
        }
    }
}
