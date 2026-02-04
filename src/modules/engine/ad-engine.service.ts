
import { Injectable, Logger } from '@nestjs/common';
import { UserContext, AdCandidate } from '../../shared/types';
import { RetrievalService } from './pipeline/1-retrieval.service';
import { FilterService } from './pipeline/2-filter.service';
import { PredictionService } from './pipeline/3-prediction.service';
import { RankingService } from './pipeline/4-ranking.service';
import { RerankService } from './pipeline/5-rerank.service';

@Injectable()
export class AdEngine {
    private readonly logger = new Logger(AdEngine.name);

    constructor(
        private retrievalStep: RetrievalService,
        private filterStep: FilterService,
        private predictionStep: PredictionService,
        private rankingStep: RankingService,
        private rerankStep: RerankService,
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

        // 1. Retrieval
        candidates = await this.retrievalStep.execute([], context, { slot_id: slotId });
        const countRetrieval = candidates.length;

        // 2. Filter
        candidates = await this.filterStep.execute(candidates, context);
        const countFilter = candidates.length;

        // 3. Prediction (OPTIMIZATION 3: Pure sync, no await)
        candidates = this.predictionStep.execute(candidates, context);

        // 4. Ranking (OPTIMIZATION 3: Pure sync, no await)
        candidates = this.rankingStep.execute(candidates, context);

        // 5. Rerank
        // Default limit 5 ads
        candidates = await this.rerankStep.execute(candidates, context, { limit: 5 });

        const duration = Date.now() - start;
        this.logger.log(
            `Pipeline finished in ${duration}ms. ` +
            `Retrieved: ${countRetrieval} -> Filtered: ${countFilter} -> Final: ${candidates.length}`
        );

        return candidates;
    }
}
