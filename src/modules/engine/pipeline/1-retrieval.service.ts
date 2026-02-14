
import { Injectable, Logger } from '@nestjs/common';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext, BidType, CreativeType } from '../../../shared/types';
import { CacheService } from '../services/cache.service';
import { TargetingMatcher } from '../services/targeting.matcher';

@Injectable()
export class RetrievalService implements PipelineStep {
    private readonly logger = new Logger(RetrievalService.name);

    constructor(
        private cacheService: CacheService,
        private targetingMatcher: TargetingMatcher,
    ) { }

    async execute(
        _candidates: AdCandidate[], // First step, usually empty or ignored
        context: UserContext,
        extraArgs?: { slot_id?: string },
    ): Promise<AdCandidate[]> {
        // OPTIMIZATION 2: Use indexed cache for O(1) access by slot_id
        const rawCreatives = this.cacheService.getCreativesBySlot(extraArgs?.slot_id);
        const result: AdCandidate[] = [];

        // Iterate all creatives (Naive linear scan for now - acceptable for thousands)
        // In production with millions, we would use inverted index in CacheService
        for (const creative of rawCreatives) {
            const campaign = this.cacheService.getCampaign(creative.campaign_id);
            if (!campaign) continue;

            // 1. Check basic time schedule (Campaign level)
            const now = new Date();
            if (campaign.start_time && new Date(campaign.start_time) > now) continue;
            if (campaign.end_time && new Date(campaign.end_time) < now) continue;

            // 2. Check Targeting Rules
            const rules = this.cacheService.getRulesForCampaign(campaign.id);
            if (!this.targetingMatcher.match(rules, context)) {
                continue;
            }

            // 3. Create Candidate
            result.push({
                campaign_id: campaign.id,
                creative_id: creative.id,
                advertiser_id: campaign.advertiser_id,
                bid: parseFloat(campaign.bid_amount || '0'), // inherited from campaign
                bid_type: (campaign.bid_type as number) as BidType,
                creative_type: (creative.creative_type as number) as CreativeType,
                title: creative.title,
                description: creative.description || undefined,
                image_url: creative.image_url || undefined,
                video_url: creative.video_url || undefined,
                landing_url: creative.landing_url,
                width: creative.width || 0,
                height: creative.height || 0,
                duration: creative.duration || 0,
                metadata: {},
            });
        }

        return result;
    }
}
