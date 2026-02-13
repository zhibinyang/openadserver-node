
import { Injectable } from '@nestjs/common';
import { AdCandidate, UserContext } from '../../../shared/types';
import { MacroReplacer } from './macro-replacer.service';
import { RedisService } from '../../../shared/redis/redis.service';
import { randomUUID } from 'crypto';
import { VastBuilder } from './vast-builder';

export interface AdResponseBuilder {
    build(
        candidates: AdCandidate[],
        context: UserContext,
        requestId: string
    ): Promise<any>;
}

@Injectable()
export class JsonResponseBuilder implements AdResponseBuilder {
    private readonly CLICK_ID_TTL = 30 * 24 * 60 * 60; // 30 days

    constructor(
        private readonly macroReplacer: MacroReplacer,
        // private readonly redisService: RedisService, // Removed for lightweight tracking
    ) { }

    async build(candidates: AdCandidate[], context: UserContext, requestId: string): Promise<any> {
        const numAds = candidates.length; // Or limit handled before
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        const enrichedCandidates = await Promise.all(
            candidates.map(async (c) => {
                const clickId = c.click_id || randomUUID();

                // Store click metadata in Redis -> REMOVED
                // We now rely on Request Log in BigQuery for context.

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
                const landingUrl = `${baseUrl}/tracking/click?click_id=${clickId}&bid=${c.bid}&p=${c.pctr || 0}&rid=${requestId}&to=${encodeURIComponent(internalUrl)}`;

                return {
                    ad_id: `ad_${c.campaign_id}_${c.creative_id}`,
                    creative_id: c.creative_id,
                    campaign_id: c.campaign_id,
                    title: c.title,
                    description: c.description,
                    image_url: c.image_url,
                    video_url: c.video_url,
                    landing_url: landingUrl,
                    imp_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=imp`,
                    click_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=click`,
                    conversion_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=conversion&conversion_value=\${CONVERSION_VALUE}`,
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
    private readonly CLICK_ID_TTL = 30 * 24 * 60 * 60; // 30 days

    constructor(
        private readonly macroReplacer: MacroReplacer,
        // private readonly redisService: RedisService,
        private readonly vastBuilder: VastBuilder,
    ) { }

    async build(candidates: AdCandidate[], context: UserContext, requestId: string): Promise<string> {
        if (candidates.length === 0) {
            return this.vastBuilder.buildEmpty();
        }

        // VAST usually returns one ad per response for basic implementations
        const c = candidates[0];
        const clickId = c.click_id || randomUUID();
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        // Store click metadata in Redis -> REMOVED
        // We now rely on Request Log in BigQuery for context.

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
        const clickThrough = `${baseUrl}/tracking/click?click_id=${clickId}&bid=${c.bid}&p=${c.pctr || 0}&rid=${requestId}&to=${encodeURIComponent(internalUrl)}`;

        const tracking = {
            impression: `${baseUrl}/tracking/track?click_id=${clickId}&type=imp`,
            clickThrough: clickThrough,
            clickTracking: `${baseUrl}/tracking/track?click_id=${clickId}&type=click`,
            start: `${baseUrl}/tracking/track?click_id=${clickId}&type=start`,
            firstQuartile: `${baseUrl}/tracking/track?click_id=${clickId}&type=firstQuartile`,
            midpoint: `${baseUrl}/tracking/track?click_id=${clickId}&type=midpoint`,
            thirdQuartile: `${baseUrl}/tracking/track?click_id=${clickId}&type=thirdQuartile`,
            complete: `${baseUrl}/tracking/track?click_id=${clickId}&type=complete`,
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
