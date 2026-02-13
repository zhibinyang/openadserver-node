
import { Controller, Post, Body, Get, Query, Req, Res } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { UserContext, CreativeType } from '../../shared/types';
import { GeoIpService } from './services/geoip.service';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ResponseBuilderFactory } from './services/response-builder.service';
import { UAParser } from 'ua-parser-js';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('ad')
export class EngineController {
    constructor(
        private readonly adEngine: AdEngine,
        private readonly responseFactory: ResponseBuilderFactory,
        private readonly geoIpService: GeoIpService,
        private readonly analyticsService: AnalyticsService,
    ) { }

    async getAd(@Body() body: AdRequestDto, @Req() req: FastifyRequest): Promise<any> {
        const requestId = randomUUID();
        const context = this.buildContext(body, req);
        const candidates = await this.adEngine.recommend(context, body.slot_id);

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
            this.analyticsService.trackEvent({
                request_id: requestId,
                click_id: '', // No click_id yet? Wait, response builder generates it.
                // We can't log click_id here because it's generated in ResponseBuilder!
                // We should move this logic AFTER ResponseBuilder or inside it.
                // But ResponseBuilder is a service.
                // Let's modify EngineController to rely on ResponseBuilder to return the enriched candidates with click_ids,
                // OR modify ResponseBuilder to log to AnalyticsService.
                // Modifying ResponseBuilder seems cleaner as it generates the click_id.
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
        // For GET requests, we map query params to DTO
        const context = this.buildContext(query, req);
        const candidates = await this.adEngine.recommend(context, query.slot_id);

        // Filter for video ads only
        const videoCandidates = candidates.filter(c => c.creative_type === CreativeType.VIDEO);

        const builder = this.responseFactory.getBuilder('vast');
        const xml = await builder.build(videoCandidates, context, requestId);

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
        const candidates = await this.adEngine.recommend(context, body.slot_id);

        // Filter for video ads only
        const videoCandidates = candidates.filter(c => c.creative_type === CreativeType.VIDEO);

        const builder = this.responseFactory.getBuilder('vast');
        const xml = await builder.build(videoCandidates, context, requestId);

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

        // 2. Country Logic
        // Priority: DTO > GeoIP
        let country = dto.country;
        if (!country && ip) {
            const geoCountry = this.geoIpService.getCountry(ip);
            if (geoCountry) {
                console.log(`[EngineController] GeoIP Resolved: ${geoCountry} from IP: ${ip}`);
                country = geoCountry;
            }
        }

        // 3. Initialize context
        const context: UserContext = {
            user_id: dto.user_id || '',
            ip: ip || '',
            os: dto.os || 'unknown', // Default to unknown if not provided
            device: dto.device,
            browser: dto.browser,
            country: country,
            city: dto.city,
            app_id: dto.app_id || 'unknown',
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
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

        if (context.os !== 'unknown') {
            console.log(`[EngineController] Detected OS: ${context.os}`);
        }
        if (context.device) {
            console.log(`[EngineController] Detected Device: ${context.device}`);
        }
        if (context.browser) {
            console.log(`[EngineController] Detected Browser: ${context.browser}`);
        }
        if (country) {
            console.log(`[EngineController] Detected Country: ${country} (From: ${dto.country ? 'DTO' : 'GeoIP'})`);
        }

        return context;
    }
}
