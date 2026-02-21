
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

        // 0. Filter by slot_type (creative_type must match)
        if (context.slot_type) {
            const before = candidates.length;
            candidates = candidates.filter(c => c.creative_type === context.slot_type);
            if (candidates.length < before) {
                this.logger.log(`Slot type filter: ${before} -> ${candidates.length} (slot_type=${context.slot_type})`);
            }
            if (candidates.length === 0) return [];
        }

        // 0.5 Filter by dimensions (width & height must match if provided)
        if (context.slot_width && context.slot_height) {
            const before = candidates.length;
            candidates = candidates.filter(c => c.width === context.slot_width && c.height === context.slot_height);
            if (candidates.length < before) {
                this.logger.log(`Dimension filter: ${before} -> ${candidates.length} (requested ${context.slot_width}x${context.slot_height})`);
            }
            if (candidates.length === 0) return [];
        }

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
     * Batch check budgets and pacing for all candidates using Redis pipeline.
     * Returns array of booleans indicating if each candidate should be DROPPED (exhausted or throttled).
     */
    private async batchCheckBudgets(candidates: AdCandidate[], date: string): Promise<boolean[]> {
        const pipeline = this.redisService.client.pipeline();

        // Prepare Redis queries
        for (const candidate of candidates) {
            const campaign = this.cacheService.getCampaign(candidate.campaign_id);

            // Query both daily and total spent for all campaigns to simplify pipeline indexing
            const dailyKey = `budget:${candidate.campaign_id}:${date}`;
            const totalKey = `budget:total:${candidate.campaign_id}`;
            pipeline.hmget(dailyKey, 'spent_today');
            pipeline.hmget(totalKey, 'spent_total');
        }

        const results = await pipeline.exec();
        const dropDecisions: boolean[] = [];

        // Time logic for pacing
        const now = new Date();
        const secSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const dailyTimeProgress = secSinceMidnight / 86400; // 0.0 to 1.0

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            const campaign = this.cacheService.getCampaign(candidate.campaign_id);
            if (!campaign) {
                dropDecisions.push(true); // Drop invalid campaigns
                continue;
            }

            const dailyLimit = campaign.budget_daily ? parseFloat(campaign.budget_daily) : 0;
            const totalLimit = campaign.budget_total ? parseFloat(campaign.budget_total) : 0;
            // Assuming pacing_type comes from DB (Even=1, Aggressive=2, DailyASAP=3, FlightASAP=4)
            // @ts-ignore - pacing_type added to cache/DB but might not be explicitly typed in memory yet
            const pacingType = campaign.pacing_type || 1;

            // EVER_GREEN ignores all budget caps and pacing
            if (pacingType === 5) {
                dropDecisions.push(false);
                continue;
            }

            const [errDaily, valDaily] = results![i * 2];
            const [errTotal, valTotal] = results![i * 2 + 1];

            if (errDaily || errTotal) {
                this.logger.warn(`Redis error checking budget for Camp ${candidate.campaign_id}`);
                dropDecisions.push(false);
                continue;
            }

            const spentToday = parseFloat((valDaily as (string | null)[])?.[0] || '0');
            const spentTotal = parseFloat((valTotal as (string | null)[])?.[0] || '0');

            // 1. Hard Cap Checks
            if (totalLimit > 0 && spentTotal >= totalLimit) {
                dropDecisions.push(true);
                continue;
            }
            // Flight ASAP ignores daily limit
            if (pacingType !== 4 && dailyLimit > 0 && spentToday >= dailyLimit) {
                dropDecisions.push(true);
                continue;
            }

            // 2. Probabilistic Pacing Throttling
            let shouldDrop = false;

            if (dailyLimit > 0) {
                const dailySpendProgress = spentToday / dailyLimit;

                switch (pacingType) {
                    case 1: // EVEN (Strictly follow time)
                        // Allow a tiny 2% buffer. If spend exceeds time + 2%, strongly throttle.
                        if (dailySpendProgress > dailyTimeProgress + 0.02) {
                            const overspendRatio = dailySpendProgress - dailyTimeProgress;
                            // Steep penalty: 5% ahead = 50% drop, 10% ahead = 100% drop.
                            let throttleRate = overspendRatio * 10;
                            // If overspend is absurdly high (e.g. 20% ahead), drop definitively.
                            if (overspendRatio > 0.10) {
                                throttleRate = 1.0;
                            }
                            shouldDrop = Math.random() < throttleRate;
                        }
                        break;

                    case 2: // AGGRESSIVE (Pace ahead of time, front-load)
                        // Allow spending up to 130% of time progress early in the day
                        const aggressiveTarget = Math.min(dailyTimeProgress * 1.3, 1.0);
                        if (dailySpendProgress > aggressiveTarget) {
                            const overspendRatio = dailySpendProgress - aggressiveTarget;
                            // Steeper penalty for aggressive overspend
                            let throttleRate = overspendRatio * 15;
                            if (overspendRatio > 0.05) {
                                throttleRate = 1.0;
                            }
                            shouldDrop = Math.random() < throttleRate;
                        }
                        break;

                    case 3: // DAILY_ASAP
                        // No throttling until limit is hit (handled in Hard Cap check)
                        break;

                    case 4: // FLIGHT_ASAP
                        // TODO: Implement total budget flight pacing if needed. Currently ASAP.
                        break;
                }
            }

            if (shouldDrop && process.env.DEBUG_PREDICTION) {
                this.logger.debug(`[Pacing Throttle] Dropped Candidate ${candidate.campaign_id} (Type: ${pacingType}, Spent: ${(spentToday / dailyLimit * 100).toFixed(1)}%, Time: ${(dailyTimeProgress * 100).toFixed(1)}%)`);
            }

            dropDecisions.push(shouldDrop);
        }

        return dropDecisions;
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
            const candidate = candidates[i];
            const campaign = this.cacheService.getCampaign(candidate.campaign_id);
            // @ts-ignore
            const pacingType = campaign?.pacing_type || 1;

            // EVER_GREEN ignores frequency caps
            if (pacingType === 5) {
                capped.push(false);
                continue;
            }

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
