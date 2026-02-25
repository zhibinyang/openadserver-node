
import { Controller, Post, Body, Get, Query, Req, Res, BadRequestException, Logger } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { UserContext, CreativeType, EventType } from '../../shared/types';
import { GeoIpService } from './services/geoip.service';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ResponseBuilderFactory } from './services/response-builder.service';
import { UAParser } from 'ua-parser-js';
import { AnalyticsService } from '../analytics/analytics.service';
import { CacheService } from './services/cache.service';
import { RedisService } from '../../shared/redis/redis.service';

@Controller('ad')
export class EngineController {
    private readonly logger = new Logger(EngineController.name);

    constructor(
        private readonly adEngine: AdEngine,
        private readonly responseFactory: ResponseBuilderFactory,
        private readonly geoIpService: GeoIpService,
        private readonly analyticsService: AnalyticsService,
        private readonly cacheService: CacheService,
        private readonly redisService: RedisService,
    ) { }

    @Post('get')
    async getAd(@Body() body: AdRequestDto, @Req() req: FastifyRequest): Promise<any> {
        if (!body.slot_type) {
            throw new BadRequestException('slot_type is required for /ad/get');
        }
        const requestId = randomUUID();
        const context = this.buildContext(body, req);
        const candidates = await this.adEngine.recommend(context, body.slot_id);

        // Log winning campaign's current budget and spend asynchronously
        this.logWinningCampaignPacing(candidates).catch(e => this.logger.warn(e));

        // Access AnalyticsService from module ref or inject it? Best to inject.
        // But for now, let's assume valid candidates are "Impressions" or at least "Bids".
        // Actually, "Impression" happens on the client.
        // Server-side, we log the "Decision" (Bid).
        // User asked for "Click Event -> BQ".
        // If we want pCTR training data, we need negatives (Impressions that didn't click).
        // So we should log the "Impression" here with label=0.
        // But wait, the client loads the ad -> Impression.
        // If we log here, we log "Bid Response".
        // Let's log it as EventType.IMPRESSION for now, effectively "Bid".

        candidates.forEach(c => {
            // Generate click_id here so we can log it with the request
            c.click_id = randomUUID();

            this.analyticsService.trackEvent({
                request_id: requestId,
                click_id: c.click_id,
                campaign_id: c.campaign_id,
                creative_id: c.creative_id,
                user_id: context.user_id,
                device: context.device,
                browser: context.browser,
                event_type: EventType.REQUEST,
                event_time: Date.now(),
                cost: 0,
                ip: context.ip,
                country: context.country,
                city: context.city,
                bid: c.bid,
                price: c.actual_cost ?? c.bid,
                os: context.os,
                referer: context.referer,
                slot_type: context.slot_type,
                slot_id: context.slot_id,
                banner_width: context.slot_width || c.width || null,
                banner_height: context.slot_height || c.height || null,
                video_duration: c.duration || c.metadata?.video_duration || null,
                bid_type: c.bid_type,
                ecpm: c.ecpm || null,
                page_context: context.page_context || null,
                pctr: c.pctr || null,
                pcvr: c.pcvr || null,
            });
        });

        const builder = this.responseFactory.getBuilder('json');
        return builder.build(candidates, context, requestId);
    }

    @Get('vast')
    async getVastAd(
        @Query() query: AdRequestDto,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ): Promise<void> {
        const requestId = randomUUID();
        const context = this.buildContext(query, req);
        context.slot_type = CreativeType.VIDEO; // VAST = always VIDEO
        const candidates = await this.adEngine.recommend(context, query.slot_id);

        // Log winning campaign's current budget and spend asynchronously
        this.logWinningCampaignPacing(candidates).catch(e => this.logger.warn(e));

        // Log REQUEST event for each candidate (same as /ad/get)
        candidates.forEach(c => {
            c.click_id = randomUUID();
            this.analyticsService.trackEvent({
                request_id: requestId,
                click_id: c.click_id,
                campaign_id: c.campaign_id,
                creative_id: c.creative_id,
                user_id: context.user_id,
                device: context.device,
                browser: context.browser,
                event_type: EventType.REQUEST,
                event_time: Date.now(),
                cost: 0,
                ip: context.ip,
                country: context.country,
                city: context.city,
                bid: c.bid,
                price: c.actual_cost ?? c.bid,
                os: context.os,
                referer: context.referer,
                slot_type: context.slot_type,
                slot_id: context.slot_id,
                banner_width: context.slot_width || c.width || null,
                banner_height: context.slot_height || c.height || null,
                video_duration: c.duration || c.metadata?.video_duration || null,
                bid_type: c.bid_type,
                ecpm: c.ecpm || null,
                page_context: context.page_context || null,
                pctr: c.pctr || null,
                pcvr: c.pcvr || null,
            });
        });

        const builder = this.responseFactory.getBuilder('vast');
        const xml = await builder.build(candidates, context, requestId);

        res.header('Content-Type', 'text/xml');
        res.send(xml);
    }

    @Post('vast')
    async postVastAd(
        @Body() body: AdRequestDto,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ): Promise<void> {
        const requestId = randomUUID();
        const context = this.buildContext(body, req);
        context.slot_type = CreativeType.VIDEO; // VAST = always VIDEO
        const candidates = await this.adEngine.recommend(context, body.slot_id);

        // Log winning campaign's current budget and spend asynchronously
        this.logWinningCampaignPacing(candidates).catch(e => this.logger.warn(e));

        // Log REQUEST event for each candidate (same as /ad/get)
        candidates.forEach(c => {
            c.click_id = randomUUID();
            this.analyticsService.trackEvent({
                request_id: requestId,
                click_id: c.click_id,
                campaign_id: c.campaign_id,
                creative_id: c.creative_id,
                user_id: context.user_id,
                device: context.device,
                browser: context.browser,
                event_type: EventType.REQUEST,
                event_time: Date.now(),
                cost: 0,
                ip: context.ip,
                country: context.country,
                city: context.city,
                bid: c.bid,
                price: c.bid,
                os: context.os,
                referer: context.referer,
                slot_type: context.slot_type,
                slot_id: context.slot_id,
                banner_width: context.slot_width || c.width || null,
                banner_height: context.slot_height || c.height || null,
                video_duration: c.duration || c.metadata?.video_duration || null,
                bid_type: c.bid_type,
                ecpm: c.ecpm || null,
                page_context: context.page_context || null,
            });
        });

        const builder = this.responseFactory.getBuilder('vast');
        const xml = await builder.build(candidates, context, requestId);

        res.header('Content-Type', 'text/xml');
        res.send(xml);
    }

    private buildContext(dto: AdRequestDto, req: FastifyRequest): UserContext {
        // 1. IP Detection Logic
        // Priority: DTO > X-Forwarded-For (Last) > Req IP
        let ip = dto.ip;
        if (!ip) {
            const forwarded = req.headers['x-forwarded-for'];
            if (forwarded) {
                // x-forwarded-for can be string or string[]
                const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
                // User asked for LAST IP from XFF.
                const parts = forwardedStr.split(',').map(s => s.trim());
                if (parts.length > 0) {
                    ip = parts[parts.length - 1];
                }
            }
        }
        if (!ip) {
            ip = req.ip;
        }

        // 2. Geo Logic
        // Priority: DTO > GeoIP
        let country = dto.country;
        let city = dto.city;
        if ((!country || !city) && ip) {
            const geo = this.geoIpService.resolve(ip);
            if (!country && geo.country) {
                country = geo.country;
            }
            if (!city && geo.city) {
                city = geo.city;
            }
            if (geo.country || geo.city) {
                console.log(`[EngineController] GeoIP Resolved: country=${geo.country}, city=${geo.city} from IP: ${ip}`);
            }
        }

        // 3. Initialize context
        const context: UserContext = {
            user_id: dto.user_id || '',
            ip: ip || '',
            os: dto.os || 'unknown',
            device: dto.device,
            browser: dto.browser,
            country: country,
            city: city,
            app_id: dto.app_id || 'unknown',
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
            slot_type: dto.slot_type,
            slot_id: dto.slot_id,
            slot_width: dto.slot_width,
            slot_height: dto.slot_height,
            referer: (req.headers['referer'] || req.headers['referrer'] || '') as string,
            page_context: dto.page_context,
            num_ads: dto.num_ads || 1,
        };

        // 4. Fallback: Parse User-Agent / Client Hints if OS/Device/Browser not provided
        if (context.os === 'unknown' || !context.device || !context.browser) {
            try {
                // @ts-ignore
                const parser = new UAParser(req.headers);
                const result = parser.getResult();

                // OS
                if (context.os === 'unknown' && result.os.name) {
                    context.os = result.os.name;
                }

                // Device
                if (!context.device && result.device.model) {
                    // Prefer 'Vendor Model', e.g. 'Apple iPhone'
                    context.device = [result.device.vendor, result.device.model].filter(Boolean).join(' ');
                }

                // Browser
                if (!context.browser && result.browser.name) {
                    context.browser = result.browser.name;
                }

            } catch (e) {
                // Silent failure
            }
        }
        if (process.env.DEBUG_PREDICTION || process.env.NODE_ENV !== 'production') {
            if (context.os !== 'unknown') {
                this.logger.debug(`Detected OS: ${context.os}`);
            }
            if (context.device) {
                this.logger.debug(`Detected Device: ${context.device}`);
            }
            if (context.browser) {
                this.logger.debug(`Detected Browser: ${context.browser}`);
            }
            if (country) {
                this.logger.debug(`Detected Country: ${country} (From: ${dto.country ? 'DTO' : 'GeoIP'})`);
            }
        }

        return context;
    }

    private async logWinningCampaignPacing(candidates: any[]): Promise<void> {
        if (!process.env.DEBUG_PREDICTION || candidates.length === 0) return;

        try {
            const winner = candidates[0];
            const campaign = this.cacheService.getCampaign(winner.campaign_id);
            if (!campaign) return;

            const date = new Date().toISOString().split('T')[0];
            const dailyKey = `budget:${winner.campaign_id}:${date}`;
            const totalKey = `budget:total:${winner.campaign_id}`;

            const pipeline = this.redisService.client.pipeline();
            pipeline.hget(dailyKey, 'spent_today');
            pipeline.hget(totalKey, 'spent_total');
            const results = await pipeline.exec();

            const spentToday = parseFloat((results?.[0]?.[1] as string) || '0');
            const spentTotal = parseFloat((results?.[1]?.[1] as string) || '0');

            const dailyLimit = campaign.budget_daily ? parseFloat(campaign.budget_daily) : 0;
            // @ts-ignore
            const pacingType = campaign.pacing_type || 1;

            const now = new Date();
            const secSinceMidnight = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
            const dailyTimeProgress = secSinceMidnight / 86400;

            let targetToday = 0;
            if (pacingType === 1) { // Even
                targetToday = dailyLimit * dailyTimeProgress;
            } else if (pacingType === 2) { // Aggressive
                targetToday = dailyLimit * Math.min(dailyTimeProgress * 1.3, 1.0);
            } else if (pacingType === 3) { // Daily ASAP
                targetToday = dailyLimit;
            }

            this.logger.debug(
                `[Winner Pacing] Campaign ${winner.campaign_id} (Type: ${pacingType}) ` +
                `| Daily: $${spentToday.toFixed(2)} / Target: $${targetToday.toFixed(2)} / Limit: $${dailyLimit.toFixed(2)} ` +
                `| Total: $${spentTotal.toFixed(2)} / $${campaign.budget_total || 0}`
            );
        } catch (err) {
            this.logger.warn(`Failed to log winning campaign pacing: ${err}`);
        }
    }
}
