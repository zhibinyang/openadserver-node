
import { Controller, Post, Body, Get, Query, Req, Res, BadRequestException, Logger } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { GeoAdRequestDto } from './dto/geo-ad-request.dto';
import { UserContext, CreativeType, EventType } from '../../shared/types';
import { GeoIpService } from './services/geoip.service';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ResponseBuilderFactory } from './services/response-builder.service';
import { UAParser } from 'ua-parser-js';
import { AnalyticsService } from '../analytics/analytics.service';
import { CacheService } from './services/cache.service';
import { RedisService } from '../../shared/redis/redis.service';
import { RedisUserService } from './services/redis-user.service';
import { EventProducerService } from '../events/producers/event-producer.service';
import {
  RequestEvent,
  AdEvent,
  SlotType,
  CreativeType as EventCreativeType,
  BidType as EventBidType,
} from '../events/types/event.types';

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
        private readonly redisUserService: RedisUserService,
        private readonly eventProducer: EventProducerService,
    ) { }

    /**
     * Convert shared CreativeType to event CreativeType enum
     */
    private toEventCreativeType(type: CreativeType): EventCreativeType {
        const map: Record<CreativeType, EventCreativeType> = {
            [CreativeType.BANNER]: EventCreativeType.BANNER,
            [CreativeType.NATIVE]: EventCreativeType.NATIVE,
            [CreativeType.VIDEO]: EventCreativeType.VIDEO,
            [CreativeType.INTERSTITIAL]: EventCreativeType.INTERSTITIAL,
            [CreativeType.GEO_SNIPPET]: EventCreativeType.GEO_SNIPPET,
        };
        return map[type] ?? EventCreativeType.UNKNOWN;
    }

    /**
     * Convert shared BidType to event BidType enum
     */
    private toEventBidType(type: number): EventBidType {
        const map: Record<number, EventBidType> = {
            1: EventBidType.CPM,
            2: EventBidType.CPC,
            3: EventBidType.CPA,
            4: EventBidType.OCPM,
            5: EventBidType.GEO,
        };
        return map[type] ?? EventBidType.UNKNOWN;
    }

    /**
     * Convert slot_type number to SlotType enum
     */
    private toSlotType(type: number | undefined): SlotType {
        const map: Record<number, SlotType> = {
            1: SlotType.BANNER,
            2: SlotType.NATIVE,
            3: SlotType.VIDEO,
            4: SlotType.INTERSTITIAL,
        };
        return map[type ?? 0] ?? SlotType.UNKNOWN;
    }

    /**
     * Produce RequestEvent and AdEvents for the new Kafka pipeline
     */
    private async produceEventsToKafka(
        requestId: string,
        context: UserContext,
        candidates: any[],
    ): Promise<void> {
        const eventTime = Date.now();

        // Produce RequestEvent
        const requestEvent: RequestEvent = {
            requestId,
            eventTime,
            userIds: context.internal_uid ? { userId: context.internal_uid } : undefined,
            segments: context.segment_ids?.map(String),
            slotId: context.slot_id,
            slotType: this.toSlotType(context.slot_type),
            ip: context.ip,
            country: context.country,
            city: context.city,
            device: context.device,
            browser: context.browser,
            os: context.os,
            referer: context.referer,
            pageContext: context.page_context,
            responseCount: candidates.length,
            hasWinner: candidates.length > 0,
            winningBid: candidates[0]?.actual_cost ?? candidates[0]?.bid,
        };

        // Fire and forget - don't await to avoid blocking response
        this.eventProducer.produceRequest(requestEvent).catch(e =>
            this.logger.warn(`Failed to produce request event: ${e}`),
        );

        // Produce AdEvent for each candidate
        for (const c of candidates) {
            const adEvent: AdEvent = {
                requestId,
                impressionId: c.impression_id ?? 0,
                clickId: c.click_id!,
                campaignId: c.campaign_id,
                creativeId: c.creative_id,
                advertiserId: c.advertiser_id,
                eventTime,
                bid: c.bid,
                ecpm: c.ecpm ?? 0,
                cost: c.actual_cost ?? c.bid ?? 0,
                bidType: this.toEventBidType(c.bid_type),
                creativeType: this.toEventCreativeType(c.creative_type),
                bannerWidth: context.slot_width ?? c.width,
                bannerHeight: context.slot_height ?? c.height,
                videoDuration: c.duration ?? c.metadata?.video_duration,
                slotId: context.slot_id,
                pctr: c.pctr,
                pcvr: c.pcvr,
                landingUrl: c.landing_url,
            };

            this.eventProducer.produceAd(adEvent).catch(e =>
                this.logger.warn(`Failed to produce ad event: ${e}`),
            );
        }
    }

    @Post('get')
    async getAd(@Body() body: AdRequestDto, @Req() req: FastifyRequest): Promise<any> {
        if (!body.slot_type) {
            throw new BadRequestException('slot_type is required for /ad/get');
        }
        const requestId = randomUUID();
        const context = await this.buildContext(body, req);
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

        // Produce events to Kafka pipeline (fire and forget)
        this.produceEventsToKafka(requestId, context, candidates).catch(e =>
            this.logger.warn(`Failed to produce events to Kafka: ${e}`),
        );

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
        const context = await this.buildContext(query, req);
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

        // Produce events to Kafka pipeline (fire and forget)
        this.produceEventsToKafka(requestId, context, candidates).catch(e =>
            this.logger.warn(`Failed to produce events to Kafka: ${e}`),
        );

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
        const context = await this.buildContext(body, req);
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

        // Produce events to Kafka pipeline (fire and forget)
        this.produceEventsToKafka(requestId, context, candidates).catch(e =>
            this.logger.warn(`Failed to produce events to Kafka: ${e}`),
        );

        const builder = this.responseFactory.getBuilder('vast');
        const xml = await builder.build(candidates, context, requestId);

        res.header('Content-Type', 'text/xml');
        res.send(xml);
    }

    private async buildContext(dto: AdRequestDto, req: FastifyRequest): Promise<UserContext> {
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

        // 4. Redis-based identity resolution and user data retrieval
        if (dto.identity_type && dto.identity_value) {
            try {
                const userData = await this.redisUserService.getUserDataByIdentity(
                    dto.identity_type,
                    dto.identity_value,
                    true, // Create if not exists
                );

                if (userData) {
                    context.identity_type = dto.identity_type;
                    context.identity_value = dto.identity_value;
                    context.internal_uid = userData.internal_uid;

                    // Populate profile data if available
                    if (userData.profile) {
                        // Use profile data as fallback if not provided in DTO
                        if (!context.user_id) {
                            context.user_id = userData.internal_uid;
                        }
                        if (!context.age && userData.profile.age) {
                            context.age = userData.profile.age;
                        }
                        if (!context.gender && userData.profile.gender) {
                            context.gender = userData.profile.gender;
                        }
                        if (!context.interests?.length && userData.profile.interests?.length) {
                            context.interests = userData.profile.interests;
                        }
                    }

                    // Populate segment IDs for targeting
                    if (userData.segmentIds?.length) {
                        context.segment_ids = userData.segmentIds;
                    }
                }
            } catch (e) {
                this.logger.warn(`Failed to resolve identity: ${e}`);
            }
        } else if (dto.user_id) {
            // Legacy: Try to resolve by user_id as device_id for backward compatibility
            try {
                const userData = await this.redisUserService.getUserDataByIdentity(
                    'device_id',
                    dto.user_id,
                    true,
                );

                if (userData) {
                    context.internal_uid = userData.internal_uid;

                    if (userData.segmentIds?.length) {
                        context.segment_ids = userData.segmentIds;
                    }
                }
            } catch (e) {
                this.logger.warn(`Failed to resolve legacy user_id: ${e}`);
            }
        }

        // 5. Fallback: Parse User-Agent / Client Hints if OS/Device/Browser not provided
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

    @Post('geo')
    async getGeoAd(@Body() body: GeoAdRequestDto, @Req() req: FastifyRequest): Promise<any> {
        if (!body.query) {
            throw new BadRequestException('query is required for /ad/geo');
        }

        const requestId = randomUUID();
        const context = await this.buildContext(body as any, req);
        context.is_geo_request = true;
        context.query = body.query;
        context.num_ads = body.num_ads || 3;
        context.min_score = body.min_score ?? 0.6;

        const candidates = await this.adEngine.recommend(context, body.slot_id || 'geo');

        // Log as IMPRESSION (reusing existing event type)
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
                event_type: EventType.IMPRESSION,
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
                slot_id: context.slot_id || 'geo',
                bid_type: c.bid_type,
                ecpm: c.ecpm || null,
                page_context: context.page_context || body.query,
                pctr: c.pctr || null,
                pcvr: c.pcvr || null,
            });
        });

        // Produce events to Kafka pipeline (fire and forget)
        this.produceEventsToKafka(requestId, context, candidates).catch(e =>
            this.logger.warn(`Failed to produce events to Kafka: ${e}`),
        );

        // Build GEO-specific response
        return {
            request_id: requestId,
            query: body.query,
            results: candidates.map(c => ({
                knowledge_id: c.knowledge_id,
                creative_id: c.creative_id,
                campaign_id: c.campaign_id,
                title: c.title,
                snippet: c.snippet,
                source_url: c.landing_url,
                score: c.score,
                geo_score: c.geo_score,
                relevance_score: c.relevance_score,
                click_id: c.click_id,
            })),
        };
    }
}
