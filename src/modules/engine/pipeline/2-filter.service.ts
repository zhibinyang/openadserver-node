
import { Injectable, Logger } from '@nestjs/common';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext } from '../../../shared/types';
import { RedisService } from '../../../shared/redis/redis.service';
import { CacheService } from '../services/cache.service';

@Injectable()
export class FilterService implements PipelineStep {
    private readonly logger = new Logger(FilterService.name);

    constructor(
        private redisService: RedisService,
        private cacheService: CacheService,
    ) { }

    async execute(
        candidates: AdCandidate[],
        context: UserContext,
    ): Promise<AdCandidate[]> {
        if (candidates.length === 0) return [];

        const validCandidates: AdCandidate[] = [];
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Optimization: Check logical validatity + Batch Redis checks can be implemented here
        // For MVP, we do sequential checks but optimized with pipeline if needed in future.
        // Let's implement individual checks for clarity first.

        for (const candidate of candidates) {
            if (await this.isBudgetExhausted(candidate.campaign_id, today)) {
                continue;
            }

            if (await this.isFrequencyCapped(candidate.campaign_id, context.user_id)) {
                continue;
            }

            validCandidates.push(candidate);
        }

        return validCandidates;
    }

    // --- Filter Logic ---

    /**
     * Check if campaign budget is exhausted.
     * Key: budget:{campaign_id}:{date} -> field: spent_today
     */
    private async isBudgetExhausted(campaignId: number, date: string): Promise<boolean> {
        const campaign = this.cacheService.getCampaign(campaignId);
        if (!campaign || !campaign.budget_daily) return false; // No limit

        const dailyLimit = parseFloat(campaign.budget_daily);
        if (dailyLimit <= 0) return false;

        const key = `budget:${campaignId}:${date}`;
        // We assume 'spent_today' is maintained by Tracking logic
        const spentStr = await this.redisService.get(key); // Simplified k-v for now or hash
        // The Python implementation used Hash: hget budget:... spent_today
        // Let's stick to Python plan:
        // HGET budget:{campaign_id}:{today} spent_today
        const [spentToday] = await this.redisService.hmget(key, 'spent_today');

        if (spentToday && parseFloat(spentToday) >= dailyLimit) {
            return true;
        }
        return false;
    }

    /**
     * Check frequency cap.
     * Key: freq:{user_id}:{campaign_id} (Simple counter with TTL)
     */
    private async isFrequencyCapped(campaignId: number, userId?: string): Promise<boolean> {
        if (!userId) return false;

        const campaign = this.cacheService.getCampaign(campaignId);
        if (!campaign || !campaign.freq_cap_daily) return false;

        const limit = campaign.freq_cap_daily;
        const key = `freq:${userId}:${campaignId}`;
        const countStr = await this.redisService.get(key);

        if (countStr && parseInt(countStr, 10) >= limit) {
            return true;
        }
        return false;
    }
}
