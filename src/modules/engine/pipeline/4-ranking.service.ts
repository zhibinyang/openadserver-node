
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

            // Generalized Second Price (GSP) Calculation
            const nextEcpm = (i + 1 < sorted.length) ? (sorted[i + 1].score || 0) : 0;
            const pctr = c.pctr || 0.0001;
            const pcvr = c.pcvr || 0.0001;

            let requiredBid = 0;
            if (c.bid_type === BidType.CPM) {
                requiredBid = nextEcpm;
            } else if (c.bid_type === BidType.CPC) {
                // eCPM = Bid * pCTR * 1000 => Bid = eCPM / (pCTR * 1000)
                requiredBid = nextEcpm / (pctr * 1000);
            } else if (c.bid_type === BidType.CPA || c.bid_type === BidType.OCPM) {
                // eCPM = Bid * pCTR * pCVR * 1000 => Bid = eCPM / (pCTR * pCVR * 1000)
                requiredBid = nextEcpm / (pctr * pcvr * 1000);
            }

            // GSP Floor is 0.01, Ceiling is the advertiser's actual bid
            c.actual_cost = Math.min(c.bid, Math.max(0.01, requiredBid));

            const adjPctr = c.pctr || 0;
            const adjPcvr = c.pcvr || 0;
            const ctrFactor = c.ctr_factor || 1.0;
            const cvrFactor = c.cvr_factor || 1.0;

            // Reconstruct original values before calibration
            const origPctr = adjPctr / ctrFactor;
            const origPcvr = adjPcvr / cvrFactor;

            let origEcpm = 0;
            if (c.bid_type === BidType.CPM) origEcpm = c.bid;
            else if (c.bid_type === BidType.CPC) origEcpm = c.bid * origPctr * 1000;
            else origEcpm = c.bid * origPctr * origPcvr * 1000;

            this.logger.log(
                `  #${i + 1} | Camp=${c.campaign_id} Cre=${c.creative_id} | ${bidType} Bid=$${c.bid} Cost=$${c.actual_cost?.toFixed(4)} | pCTR=${origPctr.toFixed(6)} pCVR=${origPcvr.toFixed(6)} | eCPM=${origEcpm.toFixed(4)} | calib(CTRx${ctrFactor.toFixed(2)}, CVRx${cvrFactor.toFixed(2)}) | adj_eCPM=${c.ecpm?.toFixed(4)}`
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
