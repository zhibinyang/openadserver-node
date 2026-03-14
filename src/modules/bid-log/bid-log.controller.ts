/**
 * Bid Log Controller
 * REST API for bid log and statistics
 */

import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { BidLogService } from './bid-log.service';

@Controller('bid-log')
export class BidLogController {
  constructor(private readonly bidLogService: BidLogService) {}

  /**
   * Get overall bid statistics
   * GET /bid-log/stats?start=2024-01-01&end=2024-01-31
   */
  @Get('stats')
  async getStats(
    @Query('start') startStr?: string,
    @Query('end') endStr?: string,
  ) {
    const end = endStr ? new Date(endStr) : new Date();
    const start = startStr ? new Date(startStr) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const stats = await this.bidLogService.getStats(start, end);

    return {
      success: true,
      data: {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        stats,
      },
    };
  }

  /**
   * Get statistics grouped by SSP
   * GET /bid-log/stats/ssp?start=2024-01-01&end=2024-01-31
   */
  @Get('stats/ssp')
  async getStatsBySsp(
    @Query('start') startStr?: string,
    @Query('end') endStr?: string,
  ) {
    const end = endStr ? new Date(endStr) : new Date();
    const start = startStr ? new Date(startStr) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const stats = await this.bidLogService.getStatsBySsp(start, end);

    return {
      success: true,
      data: {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        stats,
      },
    };
  }

  /**
   * Get statistics grouped by campaign
   * GET /bid-log/stats/campaign?start=2024-01-01&end=2024-01-31&limit=20
   */
  @Get('stats/campaign')
  async getStatsByCampaign(
    @Query('start') startStr?: string,
    @Query('end') endStr?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    const end = endStr ? new Date(endStr) : new Date();
    const start = startStr ? new Date(startStr) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const stats = await this.bidLogService.getStatsByCampaign(start, end, limit || 20);

    return {
      success: true,
      data: {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        stats,
      },
    };
  }

  /**
   * Trigger daily stats aggregation
   * POST /bid-log/aggregate
   */
  @Get('aggregate')
  async aggregateStats() {
    await this.bidLogService.aggregateDailyStats();

    return {
      success: true,
      message: 'Daily stats aggregation completed',
    };
  }
}
