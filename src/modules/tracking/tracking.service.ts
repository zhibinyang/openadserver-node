
import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { RedisService } from '../../shared/redis/redis.service';
import { TrackingDto, TrackingType } from './tracking.dto';
import { EventType } from '../../shared/types';
import { randomUUID } from 'crypto';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class TrackingService {
    private readonly logger = new Logger(TrackingService.name);

    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
        private redisService: RedisService,
        private analyticsService: AnalyticsService,
    ) { }

    async track(dto: TrackingDto): Promise<void> {
        let campaignId: number;
        let creativeId: number;
        let userId: string | undefined;
        let requestId: string;
        let clickId = dto.click_id;

        // Context fields
        // Context fields - Now mostly empty for lightweight tracking
        let device: string | undefined;
        let browser: string | undefined;
        let os: string | undefined;
        let country: string | undefined;
        let city: string | undefined;
        let ip: string | undefined; // We could extract from request if passed to track()
        let appId: string | undefined;
        let bid = 0;

        // Try click_id-based tracking (lightweight)
        if (dto.click_id) {
            // We NO LONGER fetch context from Redis.
            // We rely on BigQuery to join 'click_id' with the original 'REQUEST' event.
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
            requestId = randomUUID(); // Generate new request_id for legacy tracking
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

        if (dto.cost) cost = parseFloat(dto.cost);

        // 2. Persist to DB (Postgres)
        const eventTime = new Date();
        // For lightweight tracking, many fields will be null/0. This is expected.
        if (campaignId > 0) {
            await this.db.insert(schema.ad_events).values({
                request_id: requestId,
                click_id: clickId,
                campaign_id: campaignId,
                creative_id: creativeId,
                user_id: userId,
                event_type: eventType,
                event_time: eventTime,
                cost: cost.toString(),
                device: device,
                browser: browser,
            }).catch(e => this.logger.error('Failed to insert tracking event', e));
        }

        // 3. Persist to BigQuery (Micro-Batching)
        // We send what we have. For lightweight, it's mostly click_id + type + time.
        this.analyticsService.trackEvent({
            request_id: requestId,
            click_id: clickId,
            campaign_id: campaignId,
            creative_id: creativeId,
            user_id: userId,
            event_type: eventType,
            event_time: eventTime.getTime(), // ms
            cost: cost,
            ip: ip,
            country: country,
            city: city,
            device: device,
            browser: browser,
            bid: bid,
            price: cost, // Price paid = cost (for simple CPM/CPC)
        });

        // 4. Update Redis Counters
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
