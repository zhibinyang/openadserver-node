
import { Controller, Get, Query, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TrackingService } from './tracking.service';
import { TrackingDto } from './tracking.dto';

@Controller('tracking')
export class TrackingController {
    constructor(private readonly trackingService: TrackingService) { }

    @Get('track')
    async trackPixel(@Query() query: TrackingDto, @Res() res: FastifyReply) {
        // Fire and forget tracking logic
        this.trackingService.track(query).catch(err => console.error(err));

        // Return 1x1 transparent GIF
        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64',
        );

        res.header('Content-Type', 'image/gif');
        res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send(pixel);
    }

    @Get('click')
    async clickThrough(
        @Query('click_id') clickId: string,
        @Query('bid') bid: string,
        @Query('p') pctr: string,
        @Query('rid') requestId: string,
        @Query('to') to: string,
        @Res() res: FastifyReply,
    ) {
        // Validate required parameter
        if (!to) {
            throw new BadRequestException('Missing required parameter: to');
        }

        // Fire and forget: Log the click event
        if (clickId) {
            this.trackingService.track({
                type: 'click' as any,
                click_id: clickId,
            }).catch(err => console.error('Click tracking failed:', err));
        }

        // Direct redirect (302) to the destination URL
        res.status(HttpStatus.FOUND).redirect(to);
    }
}
