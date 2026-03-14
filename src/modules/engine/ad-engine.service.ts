
import { Injectable, Logger } from '@nestjs/common';
import { UserContext, AdCandidate } from '../../shared/types';
import { RetrievalService } from './pipeline/1-retrieval.service';
import { FilterService } from './pipeline/2-filter.service';
import { PredictionService } from './pipeline/3-prediction.service';
import { RankingService } from './pipeline/4-ranking.service';
import { RerankService } from './pipeline/5-rerank.service';
import { UserProfileService } from './services/user-profile.service';

@Injectable()
export class AdEngine {
    private readonly logger = new Logger(AdEngine.name);

    constructor(
        private retrievalStep: RetrievalService,
        private filterStep: FilterService,
        private predictionStep: PredictionService,
        private rankingStep: RankingService,
        private rerankStep: RerankService,
        private userProfileService: UserProfileService,
    ) { }

    /**
     * Main recommendation pipeline.
     */
    async recommend(
        context: UserContext,
        slotId: string,
    ): Promise<AdCandidate[]> {
        const start = Date.now();
        let candidates: AdCandidate[] = [];

        // Load user profile if user_id is present
        if (context.user_id) {
            try {
                const profile = await this.userProfileService.getProfile(context.user_id);
                if (profile) {
                    // Merge profile data into context (existing context fields take precedence)
                    context.age = context.age ?? profile.age;
                    context.gender = context.gender ?? profile.gender;
                    context.interests = context.interests ?? profile.interests;
                }
            } catch (error) {
                this.logger.warn(`Failed to load profile for user ${context.user_id}`, error);
                // Continue execution even if profile load fails
            }
        }

        // 1. Retrieval
        candidates = await this.retrievalStep.execute([], context, { slot_id: slotId });
        const countRetrieval = candidates.length;

        // 2. Filter
        candidates = await this.filterStep.execute(candidates, context);
        const countFilter = candidates.length;

        // 3. Prediction (Now async due to ONNX)
        const predictionStart = Date.now();
        candidates = await this.predictionStep.execute(candidates, context);
        const predictionDuration = Date.now() - predictionStart;

        // 4. Ranking (OPTIMIZATION 3: Pure sync, no await)
        candidates = this.rankingStep.execute(candidates, context);

        // 5. Rerank
        // Default limit to context.num_ads or 1 if not specified
        const limit = context.num_ads || 1;
        candidates = await this.rerankStep.execute(candidates, context, { limit });

        const duration = Date.now() - start;
        this.logger.log(
            `Pipeline finished in ${duration}ms (Prediction: ${predictionDuration}ms). ` +
            `Retrieved: ${countRetrieval} -> Filtered: ${countFilter} -> Final: ${candidates.length}`
        );

        return candidates;
    }
}
