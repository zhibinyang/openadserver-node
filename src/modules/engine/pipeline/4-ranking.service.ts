
import { Injectable, Logger } from '@nestjs/common';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext, BidType } from '../../../shared/types';

const BID_TYPE_NAMES: Record<number, string> = {
    [BidType.CPM]: 'CPM',
    [BidType.CPC]: 'CPC',
    [BidType.CPA]: 'CPA',
    [BidType.OCPM]: 'OCPM',
};

@Injectable()
export class RankingService implements PipelineStep {
    private readonly logger = new Logger(RankingService.name);

    // OPTIMIZATION 3: Removed async - pure synchronous computation
    execute(
        candidates: AdCandidate[],
        _context: UserContext,
    ): AdCandidate[] {

        for (const candidate of candidates) {
            candidate.ecpm = this.calculateEcpm(candidate);
            candidate.score = candidate.ecpm; // Strategy: Maximize eCPM
        }

        // Sort descending by score
        const sorted = candidates.sort((a, b) => (b.score || 0) - (a.score || 0));

        // Log ranked candidates
        this.logger.log(`Ranked ${sorted.length} candidates:`);
        sorted.forEach((c, i) => {
            const bidType = BID_TYPE_NAMES[c.bid_type] || 'UNKNOWN';
            const pctr = c.pctr != null ? c.pctr.toFixed(6) : 'N/A';
            const pcvr = c.pcvr != null ? c.pcvr.toFixed(6) : 'N/A';
            this.logger.log(
                `  #${i + 1} | Camp=${c.campaign_id} Cre=${c.creative_id} | ${bidType} $${c.bid} | pCTR=${pctr} pCVR=${pcvr} | eCPM=${c.ecpm?.toFixed(4)}`
            );
        });

        return sorted;
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
