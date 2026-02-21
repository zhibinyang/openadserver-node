
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
        let campaignId: number = 0;
        let creativeId: number = 0;
        let userId: string | undefined;
        let requestId: string = '';
        let clickId = dto.click_id;

        // Context fields - Now mostly empty for lightweight tracking
        let device: string | undefined;
        let os: string | undefined;
        let browser: string | undefined;
        let country: string | undefined;
        let city: string | undefined;
        let ip: string | undefined;
        let bid = 0;

        // Try click_id-based tracking
        if (dto.click_id) {
            // First, attempt to load rich context from Redis
            const cachedData = await this.redisService.get(`click:${dto.click_id}`);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    campaignId = parsed.campaignId;
                    creativeId = parsed.creativeId;
                    userId = parsed.userId || dto.uid || '';
                    requestId = parsed.requestId || '';
                    device = parsed.device;
                    os = parsed.os;
                    browser = parsed.browser;
                    country = parsed.country;
                    city = parsed.city;
                    // For click/conversion, adopt the pre-calculated contextual budget cost if the URL didn't specify it
                    if (!dto.cost || dto.cost === '0') {
                        if (dto.type === TrackingType.CLICK) bid = parsed.clickCost || 0;
                        if (dto.type === TrackingType.CONV || dto.type === TrackingType.CONVERSION) bid = parsed.convCost || 0;
                    }
                    this.logger.log(`Restored tracking context from Redis for click_id: ${dto.click_id}`);
                } catch (e) {
                    this.logger.warn(`Failed to parse click context for ${dto.click_id}`);
                }
            }

            // Fallback to URL defaults if Redis data was expired or missing
            if (campaignId === undefined) {
                campaignId = dto.cid ? parseInt(dto.cid, 10) : 0;
                creativeId = dto.crid ? parseInt(dto.crid, 10) : 0;
                userId = dto.uid || '';
                requestId = ''; // Unknown unless passed
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
            os: os,
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
                const dailyKey = `budget:${campaignId}:${today}`;
                const totalKey = `budget:total:${campaignId}`;

                await Promise.all([
                    this.redisService.hincrbyfloat(dailyKey, 'spent_today', cost),
                    this.redisService.hincrbyfloat(totalKey, 'spent_total', cost),
                ]);
            }
        }
    }
}
