
import { Injectable } from '@nestjs/common';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext, BidType } from '../../../shared/types';

@Injectable()
export class RankingService implements PipelineStep {

    async execute(
        candidates: AdCandidate[],
        _context: UserContext,
    ): Promise<AdCandidate[]> {

        for (const candidate of candidates) {
            candidate.ecpm = this.calculateEcpm(candidate);
            candidate.score = candidate.ecpm; // Strategy: Maximize eCPM
        }

        // Sort descending by score
        return candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private calculateEcpm(candidate: AdCandidate): number {
        const bid = candidate.bid;
        const pctr = candidate.pctr || 0.0001;
        const pcvr = candidate.pcvr || 0.0001;

        switch (candidate.bid_type) {
            case BidType.CPM:
                return bid;
            case BidType.CPC:
                // eCPM = Bid * pCTR * 1000
                return bid * pctr * 1000;
            case BidType.CPA:
            case BidType.OCPM: // Simplified OCPM
                // eCPM = Bid * pCTR * pCVR * 1000
                // (Assuming Bid is per Conversion/Action)
                return bid * pctr * pcvr * 1000;
            default:
                return 0;
        }
    }
}
