
import { Controller, Post, Body, Get, Query, Req, Res } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { UserContext, CreativeType } from '../../shared/types';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ResponseBuilderFactory } from './services/response-builder.service';

@Controller('ad')
export class EngineController {
    constructor(
        private readonly adEngine: AdEngine,
        private readonly responseFactory: ResponseBuilderFactory,
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
        return {
            user_id: dto.user_id || '',
            ip: dto.ip || req.ip,
            os: dto.os || 'unknown',
            device_model: dto.device_model,
            country: dto.country,
            city: dto.city,
            app_id: dto.app_id || 'unknown',
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
        };
    }
}
