
import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TrackingService } from './tracking.service';
import { TrackingDto } from './tracking.dto';

@Controller('track')
export class TrackingController {
    constructor(private readonly trackingService: TrackingService) { }

    @Get()
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
}
