
import { Controller, Post, Body, Get, Query, Req, Res } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { UserContext, CreativeType } from '../../shared/types';
import { GeoIpService } from './services/geoip.service';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ResponseBuilderFactory } from './services/response-builder.service';
import { UAParser } from 'ua-parser-js';

@Controller('ad')
export class EngineController {
    constructor(
        private readonly adEngine: AdEngine,
        private readonly responseFactory: ResponseBuilderFactory,
        private readonly geoIpService: GeoIpService,
    ) { }

    @Post('get')
    async getAd(@Body() body: AdRequestDto, @Req() req: FastifyRequest): Promise<any> {
        const requestId = randomUUID();
        const context = this.buildContext(body, req);
        const candidates = await this.adEngine.recommend(context, body.slot_id);

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
            device_model: dto.device_model,
            country: country,
            city: dto.city,
            app_id: dto.app_id || 'unknown',
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
        };

        // 4. Fallback: Parse User-Agent / Client Hints if OS not provided
        if (context.os === 'unknown' || !context.device_model) {
            try {
                // @ts-ignore
                const parser = new UAParser(req.headers);
                const result = parser.getResult();

                if (context.os === 'unknown' && result.os.name) {
                    context.os = result.os.name;
                }
            } catch (e) {
                // Silent failure
            }
        }

        if (context.os !== 'unknown') {
            console.log(`[EngineController] Detected OS: ${context.os} (From: ${dto.os ? 'DTO' : 'Header'})`);
        }
        if (country) {
            console.log(`[EngineController] Detected Country: ${country} (From: ${dto.country ? 'DTO' : 'GeoIP'})`);
        }

        return context;
    }
}
