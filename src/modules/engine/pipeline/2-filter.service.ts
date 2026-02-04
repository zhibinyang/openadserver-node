
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

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // OPTIMIZATION 1: Batch Redis operations using pipeline
        const budgetChecks = await this.batchCheckBudgets(candidates, today);
        const freqChecks = await this.batchCheckFrequency(candidates, context.user_id);

        const validCandidates: AdCandidate[] = [];
        for (let i = 0; i < candidates.length; i++) {
            if (budgetChecks[i] || freqChecks[i]) {
                continue; // Filtered out
            }
            validCandidates.push(candidates[i]);
        }

        return validCandidates;
    }

    /**
     * Batch check budgets for all candidates using Redis pipeline.
     * Returns array of booleans indicating if each candidate is budget-exhausted.
     */
    private async batchCheckBudgets(candidates: AdCandidate[], date: string): Promise<boolean[]> {
        const pipeline = this.redisService.client.pipeline();
        const campaignLimits: number[] = [];

        for (const candidate of candidates) {
            const campaign = this.cacheService.getCampaign(candidate.campaign_id);
            const limit = campaign?.budget_daily ? parseFloat(campaign.budget_daily) : 0;
            campaignLimits.push(limit);

            if (limit > 0) {
                const key = `budget:${candidate.campaign_id}:${date}`;
                pipeline.hmget(key, 'spent_today');
            } else {
                pipeline.get('__dummy__'); // Placeholder to maintain index alignment
            }
        }

        const results = await pipeline.exec();
        const exhausted: boolean[] = [];

        for (let i = 0; i < candidates.length; i++) {
            const limit = campaignLimits[i];
            if (limit <= 0) {
                exhausted.push(false);
                continue;
            }

            const [err, value] = results![i];
            if (err) {
                this.logger.warn(`Redis error checking budget: ${err}`);
                exhausted.push(false);
                continue;
            }

            // value is from hmget, returns array of strings
            const spentToday = (value as (string | null)[])?.[0];
            exhausted.push(!!(spentToday && parseFloat(spentToday) >= limit));
        }

        return exhausted;
    }

    /**
     * Batch check frequency caps for all candidates using Redis pipeline.
     * Returns array of booleans indicating if each candidate is frequency-capped.
     */
    private async batchCheckFrequency(candidates: AdCandidate[], userId?: string): Promise<boolean[]> {
        if (!userId) {
            return new Array(candidates.length).fill(false);
        }

        const pipeline = this.redisService.client.pipeline();
        const campaignLimits: number[] = [];

        for (const candidate of candidates) {
            const campaign = this.cacheService.getCampaign(candidate.campaign_id);
            const limit = campaign?.freq_cap_daily || 0;
            campaignLimits.push(limit);

            if (limit > 0) {
                const key = `freq:${userId}:${candidate.campaign_id}`;
                pipeline.get(key);
            } else {
                pipeline.get('__dummy__');
            }
        }

        const results = await pipeline.exec();
        const capped: boolean[] = [];

        for (let i = 0; i < candidates.length; i++) {
            const limit = campaignLimits[i];
            if (limit <= 0) {
                capped.push(false);
                continue;
            }

            const [err, value] = results![i];
            if (err) {
                this.logger.warn(`Redis error checking frequency: ${err}`);
                capped.push(false);
                continue;
            }

            const count = value ? parseInt(value as string, 10) : 0;
            capped.push(count >= limit);
        }

        return capped;
    }
}
