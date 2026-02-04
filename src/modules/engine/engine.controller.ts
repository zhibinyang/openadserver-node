
import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { UserContext } from '../../shared/types';
import { MacroReplacer } from './services/macro-replacer.service';
import { RedisService } from '../../shared/redis/redis.service';
import { randomUUID } from 'crypto';

@Controller('ad')
export class EngineController {
    // Click ID TTL: 30 days in seconds
    private readonly CLICK_ID_TTL = 30 * 24 * 60 * 60;

    constructor(
        private readonly adEngine: AdEngine,
        private readonly macroReplacer: MacroReplacer,
        private readonly redisService: RedisService,
    ) { }

    @Post('get')
    @HttpCode(HttpStatus.OK)
    async getAds(@Body() dto: AdRequestDto) {
        // Map DTO to UserContext
        const context: UserContext = {
            user_id: dto.user_id,
            ip: dto.ip || '127.0.0.1',
            os: dto.os || 'unknown',
            country: dto.country || 'US',
            city: dto.city,
            app_id: dto.app_id || 'default_app',
            device_model: dto.device_model,
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
        };

        const candidates = await this.adEngine.recommend(context, dto.slot_id);
        const numAds = Math.min(dto.num_ads || 1, 10);

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const requestId = randomUUID();

        // Generate click_id for each candidate and store in Redis
        const enrichedCandidates = await Promise.all(
            candidates.slice(0, numAds).map(async (c) => {
                const clickId = randomUUID();

                // Store click metadata in Redis with TTL
                const clickData = {
                    request_id: requestId,
                    campaign_id: c.campaign_id,
                    creative_id: c.creative_id,
                    advertiser_id: c.advertiser_id,
                    user_id: context.user_id || '',
                    bid: c.bid,
                    bid_type: c.bid_type,
                    ecpm: c.ecpm || 0,
                    pctr: c.pctr || 0,
                    pcvr: c.pcvr || 0,
                    timestamp: Date.now(),
                    os: context.os,
                    country: context.country,
                    app_id: context.app_id,
                };

                await this.redisService.set(
                    `click:${clickId}`,
                    JSON.stringify(clickData),
                    this.CLICK_ID_TTL
                );

                // Step 1: Apply macro replacement to original landing URL
                const originalLandingUrl = this.macroReplacer.replace(c.landing_url, {
                    requestId,
                    candidate: c,
                    userContext: context,
                    timestamp: Date.now(),
                });

                // Step 2: Construct internal URL (to) with click_id and UTM parameters
                const urlSeparator = originalLandingUrl.includes('?') ? '&' : '?';
                const internalUrl = `${originalLandingUrl}${urlSeparator}click_id=${clickId}&utm_source=openadserver&utm_medium=cpc&utm_campaign=${c.campaign_id}`;

                // Step 3: Construct external click-through URL
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
                    // Use click_id in tracking pixels
                    imp_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=imp`,
                    click_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=click`,
                    conversion_pixel: `${baseUrl}/tracking/track?click_id=${clickId}&type=conversion`,
                };
            })
        );

        return {
            request_id: requestId,
            candidates: enrichedCandidates,
        };
    }
}
