
import { Injectable } from '@nestjs/common';
import { AdCandidate, CreativeType, UserContext } from '../../../shared/types';
import { MacroReplacer } from './macro-replacer.service';
import { RedisService } from '../../../shared/redis/redis.service';
import { generateUUIDv7 } from '../../../shared/utils/uuid';
import { VastBuilder } from './vast-builder';

export interface AdResponseBuilder {
    build(
        candidates: AdCandidate[],
        context: UserContext,
        requestId: string,
        host: string
    ): Promise<any>;
}

@Injectable()
export class JsonResponseBuilder implements AdResponseBuilder {
    constructor(
        private readonly macroReplacer: MacroReplacer,
        private readonly redisService: RedisService,
    ) { }

    async build(candidates: AdCandidate[], context: UserContext, requestId: string, host: string): Promise<any> {
        const numAds = candidates.length; // Or limit handled before
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        const enrichedCandidates = await Promise.all(
            candidates.map(async (c) => {
                // Use same UUIDv7 for both imp_id and click_id
                const trackingId = c.click_id || generateUUIDv7();
                const clickId = trackingId;
                const impId = trackingId;

                // Calculate costs (no longer store in Redis here - will store on impression)
                const costToPay = c.actual_cost ?? c.bid;
                const clickCost = c.bid_type === 2 ? costToPay : 0; // CPC = 2
                const convCost = c.bid_type === 3 ? costToPay : 0; // CPA = 3. OCPM charges per impression.

                // Macro replacement
                const originalLandingUrl = this.macroReplacer.replace(c.landing_url, {
                    requestId,
                    candidate: c,
                    userContext: context,
                    timestamp: Date.now(),
                });

                // Internal URL construction
                const urlSeparator = originalLandingUrl.includes('?') ? '&' : '?';
                const internalUrl = `${originalLandingUrl}${urlSeparator}click_id=${clickId}&utm_source=openadserver&utm_medium=cpc&utm_campaign=${c.campaign_id}`;

                // External click-through URL
                // CPM is charged per impression. OCPM is effectively charged per impression based on eCPM.
                // Reconstruct eCPM-based impression cost for OCPM: (c.actual_cost * pCTR * pCVR * 1000) / 1000 = c.actual_cost * pCTR * pCVR.
                // But simplier: OCPM eCPM = actual_cost * pctr * pcvr * 1000. So per imp cost = eCPM / 1000.
                const ocpmEcpm = (costToPay * (c.pctr || 0) * (c.pcvr || 0) * 1000);
                const impCost = c.bid_type === 1 ? costToPay / 1000 : (c.bid_type === 4 ? ocpmEcpm / 1000 : 0); // CPM = 1, OCPM = 4

                const trackingQuery = `&cid=${c.campaign_id}&crid=${c.creative_id}`;
                const landingUrl = `${baseUrl}/tracking/click?click_id=${clickId}&bid=${c.bid}&rid=${requestId}&to=${encodeURIComponent(internalUrl)}${trackingQuery}`;

                return {
                    ad_id: `ad_${c.campaign_id}_${c.creative_id}`,
                    creative_id: c.creative_id,
                    campaign_id: c.campaign_id,
                    title: c.title,
                    description: c.description,
                    image_url: c.image_url,
                    video_url: c.video_url,
                    landing_url: landingUrl,
                    click_id: clickId,
                    imp_id: impId,
                    imp_pixel: `${baseUrl}/tracking/track?imp_id=${impId}&type=imp${trackingQuery}`,
                    click_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=click${trackingQuery}`,
                    conversion_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=conversion${trackingQuery}&conversion_value=\${CONVERSION_VALUE}`,
                };
            })
        );

        return {
            request_id: requestId,
            candidates: enrichedCandidates,
        };
    }
}

@Injectable()
export class VastResponseBuilder implements AdResponseBuilder {
    constructor(
        private readonly macroReplacer: MacroReplacer,
        private readonly redisService: RedisService,
        private readonly vastBuilder: VastBuilder,
    ) { }

    async build(candidates: AdCandidate[], context: UserContext, requestId: string, host: string): Promise<string> {
        if (candidates.length === 0) {
            return this.vastBuilder.buildEmpty();
        }

        // VAST usually returns one ad per response for basic implementations
        const c = candidates[0];
        // Use same UUIDv7 for both imp_id and click_id
        const trackingId = c.click_id || generateUUIDv7();
        const clickId = trackingId;
        const impId = trackingId;

        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Calculate costs (no longer store in Redis here - will store on impression)
        const costToPay = c.actual_cost ?? c.bid;
        const clickCost = c.bid_type === 2 ? costToPay : 0; // CPC = 2
        const convCost = c.bid_type === 3 ? costToPay : 0; // CPA = 3

        // Macro replacement
        const originalLandingUrl = this.macroReplacer.replace(c.landing_url, {
            requestId,
            candidate: c,
            userContext: context,
            timestamp: Date.now(),
        });

        // Internal URL construction
        const urlSeparator = originalLandingUrl.includes('?') ? '&' : '?';
        const internalUrl = `${originalLandingUrl}${urlSeparator}click_id=${clickId}&utm_source=openadserver&utm_medium=video`;

        // External click-through URL
        const ocpmEcpm = (costToPay * (c.pctr || 0) * (c.pcvr || 0) * 1000);
        const impCost = c.bid_type === 1 ? costToPay / 1000 : (c.bid_type === 4 ? ocpmEcpm / 1000 : 0); // CPM = 1, OCPM = 4
        const trackingQuery = `&cid=${c.campaign_id}&crid=${c.creative_id}`;

        const clickThrough = `${baseUrl}/tracking/click?click_id=${clickId}&bid=${c.bid}&rid=${requestId}&to=${encodeURIComponent(internalUrl)}${trackingQuery}`;

        // Video ads use imp_id for all tracking events
        const tracking = {
            impression: `${baseUrl}/tracking/track?imp_id=${impId}&type=imp${trackingQuery}`,
            clickThrough: clickThrough,
            clickTracking: `${baseUrl}/tracking/track?imp_id=${impId}&type=click${trackingQuery}`,
            start: `${baseUrl}/tracking/track?imp_id=${impId}&type=start${trackingQuery}`,
            firstQuartile: `${baseUrl}/tracking/track?imp_id=${impId}&type=firstQuartile${trackingQuery}`,
            midpoint: `${baseUrl}/tracking/track?imp_id=${impId}&type=midpoint${trackingQuery}`,
            thirdQuartile: `${baseUrl}/tracking/track?imp_id=${impId}&type=thirdQuartile${trackingQuery}`,
            complete: `${baseUrl}/tracking/track?imp_id=${impId}&type=complete${trackingQuery}`,
        };

        return this.vastBuilder.build(c, tracking, requestId);
    }
}

@Injectable()
export class ResponseBuilderFactory {
    constructor(
        private readonly jsonBuilder: JsonResponseBuilder,
        private readonly vastBuilder: VastResponseBuilder,
    ) { }

    getBuilder(type: 'json' | 'vast'): AdResponseBuilder {
        if (type === 'vast') {
            return this.vastBuilder;
        }
        return this.jsonBuilder;
    }
}
