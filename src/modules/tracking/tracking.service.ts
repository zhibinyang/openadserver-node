
import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { RedisService } from '../../shared/redis/redis.service';
import { TrackingDto, TrackingType } from './tracking.dto';
import { EventType } from '../../shared/types';
import { randomUUID } from 'crypto';

@Injectable()
export class TrackingService {
    private readonly logger = new Logger(TrackingService.name);

    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
        private redisService: RedisService,
    ) { }

    async track(dto: TrackingDto): Promise<void> {
        let campaignId: number;
        let creativeId: number;
        let userId: string | undefined;
        let requestId: string;
        let clickId = dto.click_id;

        // Try click_id-based tracking first (new method)
        if (dto.click_id) {
            const clickDataStr = await this.redisService.get(`click:${dto.click_id}`);

            if (clickDataStr) {
                const clickData = JSON.parse(clickDataStr);
                campaignId = clickData.campaign_id;
                creativeId = clickData.creative_id;
                userId = clickData.user_id;
                requestId = clickData.request_id;

                this.logger.log(`Tracking via click_id: ${dto.click_id} for campaign ${campaignId}`);
            } else {
                this.logger.warn(`Click ID not found in Redis: ${dto.click_id}`);
                return; // Skip tracking if click_id is invalid
            }
        }
        // Fallback to legacy method (cid/crid)
        else if (dto.cid && dto.crid) {
            campaignId = parseInt(dto.cid, 10);
            creativeId = parseInt(dto.crid, 10);
            userId = dto.uid;
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

        // 2. Persist to DB
        await this.db.insert(schema.ad_events).values({
            request_id: requestId,
            click_id: clickId,
            campaign_id: campaignId,
            creative_id: creativeId,
            user_id: userId,
            event_type: eventType,
            event_time: new Date(),
            cost: cost.toString(),
        }).catch(e => this.logger.error('Failed to insert tracking event', e));

        // 3. Update Redis Counters

        // 3.1 Frequency Capping (Increments only on Impression)
        if (eventType === EventType.IMPRESSION && userId) {
            const key = `freq:${userId}:${campaignId}`;
            await this.redisService.incr(key, 86400); // 1 day TTL
        }

        // 3.2 Budget Tracking (Increments only if cost > 0)
        if (cost > 0) {
            const key = `budget:${campaignId}:${today}`;
            await this.redisService.hincrbyfloat(key, 'spent_today', cost);
        }
    }
}
