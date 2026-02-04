
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
        const campaignId = parseInt(dto.cid, 10);
        const creativeId = parseInt(dto.crid, 10);
        const userId = dto.uid;
        const today = new Date().toISOString().split('T')[0];

        // 1. Determine Event Type & Cost
        let eventType = EventType.IMPRESSION;
        let cost = 0; // Default cost to 0 unless specified or calculated

        if (dto.type === TrackingType.CLICK) eventType = EventType.CLICK;
        if (dto.type === TrackingType.CONV || dto.type === TrackingType.CONVERSION) {
            eventType = EventType.CONVERSION;
        }

        if (dto.cost) cost = parseFloat(dto.cost);

        // 2. Async Persist to DB (Fire & Forget for latency, strictly speaking should queue)
        await this.db.insert(schema.ad_events).values({
            request_id: randomUUID(), // In real app, pass from request
            campaign_id: campaignId,
            creative_id: creativeId,
            user_id: userId,
            event_type: eventType,
            event_time: new Date(),
            cost: cost.toString(),
        }).catch(e => this.logger.error('Failed to insert tracking event', e));

        // 3. Update Redis Counters (Real-time Policy Enforcement)

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

        // 3.3 Stats (Impressions/Clicks)
        // Keys: stats:campaign:{id}:{hour}
        // Omitted for brevity, but same pattern as above
    }
}
