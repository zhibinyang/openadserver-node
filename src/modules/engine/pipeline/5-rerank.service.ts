
import { Injectable } from '@nestjs/common';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext } from '../../../shared/types';

@Injectable()
export class RerankService implements PipelineStep {
    private readonly MAX_PER_ADVERTISER = 2; // Diversity rule

    async execute(
        candidates: AdCandidate[],
        _context: UserContext,
        extraArgs?: { limit?: number },
    ): Promise<AdCandidate[]> {
        const limit = extraArgs?.limit || 10;
        const result: AdCandidate[] = [];
        const advertiserCounts = new Map<number, number>();

        // Greedy Selection preserving Rank order
        for (const candidate of candidates) {
            if (result.length >= limit) break;

            const advId = candidate.advertiser_id;
            const currentCount = advertiserCounts.get(advId) || 0;

            if (currentCount < this.MAX_PER_ADVERTISER) {
                result.push(candidate);
                advertiserCounts.set(advId, currentCount + 1);
            }
        }

        return result;
    }
}
