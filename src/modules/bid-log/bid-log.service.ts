/**
 * Bid Log Service
 * Records and aggregates bidding events for analytics
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { bid_logs, ssp_daily_stats } from '../../database/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { BidResult } from '../../shared/types';

/**
 * Bid log entry for creating new records
 */
export interface CreateBidLogInput {
  requestId: string;
  bidId?: string;
  impId?: string;
  sspId: string;
  campaignId?: number;
  creativeId?: number;
  bidPrice: number;
  winPrice?: number;
  currency?: string;
  result: BidResult;
  responseTimeMs?: number;
  errorMessage?: string;
  userId?: string;
  ip?: string;
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  slotId?: string;
  slotType?: number;
  slotWidth?: number;
  slotHeight?: number;
  ext?: Record<string, unknown>;
}

/**
 * Bid statistics for a time period
 */
export interface BidStats {
  totalRequests: number;
  bidResponses: number;
  noBidResponses: number;
  wins: number;
  losses: number;
  timeouts: number;
  errors: number;
  totalBidValue: number;
  totalWinValue: number;
  avgResponseTimeMs: number;
  avgBidPrice: number;
  bidRate: number;
  winRate: number;
}

/**
 * SSP statistics for a time period
 */
export interface SspStats extends BidStats {
  sspId: string;
  sspName?: string;
}

/**
 * Campaign bid statistics
 */
export interface CampaignBidStats extends BidStats {
  campaignId: number;
  campaignName?: string;
}

@Injectable()
export class BidLogService {
  private readonly logger = new Logger(BidLogService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Record a bid event
   */
  async recordBid(input: CreateBidLogInput): Promise<number> {
    try {
      const [result] = await this.db
        .insert(bid_logs)
        .values({
          request_id: input.requestId,
          bid_id: input.bidId,
          imp_id: input.impId,
          ssp_id: input.sspId,
          campaign_id: input.campaignId,
          creative_id: input.creativeId,
          bid_price: input.bidPrice.toString(),
          win_price: input.winPrice?.toString(),
          currency: input.currency || 'USD',
          result: input.result,
          response_time_ms: input.responseTimeMs,
          error_message: input.errorMessage,
          user_id: input.userId,
          ip: input.ip,
          country: input.country,
          device: input.device,
          browser: input.browser,
          os: input.os,
          slot_id: input.slotId,
          slot_type: input.slotType,
          slot_width: input.slotWidth,
          slot_height: input.slotHeight,
          ext: input.ext,
        })
        .returning({ id: bid_logs.id });

      this.logger.debug(`Recorded bid log: ${result.id}, result=${input.result}`);
      return result.id;
    } catch (error) {
      this.logger.error('Failed to record bid log:', error);
      throw error;
    }
  }

  /**
   * Record a win event (update existing bid log)
   */
  async recordWin(bidId: string, winPrice: number): Promise<void> {
    try {
      await this.db
        .update(bid_logs)
        .set({
          result: BidResult.WIN,
          win_price: winPrice.toString(),
        })
        .where(eq(bid_logs.bid_id, bidId));

      this.logger.debug(`Recorded win for bid ${bidId}, price=${winPrice}`);
    } catch (error) {
      this.logger.error(`Failed to record win for bid ${bidId}:`, error);
    }
  }

  /**
   * Record a loss event (update existing bid log)
   */
  async recordLoss(bidId: string, winningPrice?: number): Promise<void> {
    try {
      await this.db
        .update(bid_logs)
        .set({
          result: BidResult.LOSS,
          win_price: winningPrice?.toString(),
        })
        .where(eq(bid_logs.bid_id, bidId));

      this.logger.debug(`Recorded loss for bid ${bidId}`);
    } catch (error) {
      this.logger.error(`Failed to record loss for bid ${bidId}:`, error);
    }
  }

  /**
   * Get bid statistics for a time period
   */
  async getStats(startTime: Date, endTime: Date): Promise<BidStats> {
    const stats = await this.db
      .select({
        total_requests: sql<number>`COUNT(*)`,
        bid_responses: sql<number>`SUM(CASE WHEN result IN ('bid', 'win', 'loss') THEN 1 ELSE 0 END)`,
        no_bid_responses: sql<number>`SUM(CASE WHEN result = 'no_bid' THEN 1 ELSE 0 END)`,
        wins: sql<number>`SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)`,
        losses: sql<number>`SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)`,
        timeouts: sql<number>`SUM(CASE WHEN result = 'timeout' THEN 1 ELSE 0 END)`,
        errors: sql<number>`SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END)`,
        total_bid_value: sql<number>`COALESCE(SUM(CAST(bid_price AS NUMERIC)), 0)`,
        total_win_value: sql<number>`COALESCE(SUM(CASE WHEN result = 'win' THEN CAST(win_price AS NUMERIC) ELSE 0 END), 0)`,
        avg_response_time_ms: sql<number>`AVG(response_time_ms)`,
        avg_bid_price: sql<number>`AVG(CAST(bid_price AS NUMERIC))`,
      })
      .from(bid_logs)
      .where(
        and(
          gte(bid_logs.created_at, startTime),
          lte(bid_logs.created_at, endTime)
        )
      );

    const s = stats[0];
    const totalRequests = Number(s.total_requests) || 0;
    const bidResponses = Number(s.bid_responses) || 0;
    const wins = Number(s.wins) || 0;

    return {
      totalRequests,
      bidResponses,
      noBidResponses: Number(s.no_bid_responses) || 0,
      wins,
      losses: Number(s.losses) || 0,
      timeouts: Number(s.timeouts) || 0,
      errors: Number(s.errors) || 0,
      totalBidValue: Number(s.total_bid_value) || 0,
      totalWinValue: Number(s.total_win_value) || 0,
      avgResponseTimeMs: Number(s.avg_response_time_ms) || 0,
      avgBidPrice: Number(s.avg_bid_price) || 0,
      bidRate: totalRequests > 0 ? bidResponses / totalRequests : 0,
      winRate: bidResponses > 0 ? wins / bidResponses : 0,
    };
  }

  /**
   * Get statistics grouped by SSP
   */
  async getStatsBySsp(startTime: Date, endTime: Date): Promise<SspStats[]> {
    const stats = await this.db
      .select({
        ssp_id: bid_logs.ssp_id,
        total_requests: sql<number>`COUNT(*)`,
        bid_responses: sql<number>`SUM(CASE WHEN result IN ('bid', 'win', 'loss') THEN 1 ELSE 0 END)`,
        no_bid_responses: sql<number>`SUM(CASE WHEN result = 'no_bid' THEN 1 ELSE 0 END)`,
        wins: sql<number>`SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)`,
        losses: sql<number>`SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)`,
        timeouts: sql<number>`SUM(CASE WHEN result = 'timeout' THEN 1 ELSE 0 END)`,
        errors: sql<number>`SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END)`,
        total_bid_value: sql<number>`COALESCE(SUM(CAST(bid_price AS NUMERIC)), 0)`,
        total_win_value: sql<number>`COALESCE(SUM(CASE WHEN result = 'win' THEN CAST(win_price AS NUMERIC) ELSE 0 END), 0)`,
        avg_response_time_ms: sql<number>`AVG(response_time_ms)`,
        avg_bid_price: sql<number>`AVG(CAST(bid_price AS NUMERIC))`,
      })
      .from(bid_logs)
      .where(
        and(
          gte(bid_logs.created_at, startTime),
          lte(bid_logs.created_at, endTime)
        )
      )
      .groupBy(bid_logs.ssp_id);

    return stats.map((s: any) => {
      const totalRequests = Number(s.total_requests) || 0;
      const bidResponses = Number(s.bid_responses) || 0;
      const wins = Number(s.wins) || 0;

      return {
        sspId: s.ssp_id,
        totalRequests,
        bidResponses,
        noBidResponses: Number(s.no_bid_responses) || 0,
        wins,
        losses: Number(s.losses) || 0,
        timeouts: Number(s.timeouts) || 0,
        errors: Number(s.errors) || 0,
        totalBidValue: Number(s.total_bid_value) || 0,
        totalWinValue: Number(s.total_win_value) || 0,
        avgResponseTimeMs: Number(s.avg_response_time_ms) || 0,
        avgBidPrice: Number(s.avg_bid_price) || 0,
        bidRate: totalRequests > 0 ? bidResponses / totalRequests : 0,
        winRate: bidResponses > 0 ? wins / bidResponses : 0,
      };
    });
  }

  /**
   * Get statistics grouped by campaign
   */
  async getStatsByCampaign(
    startTime: Date,
    endTime: Date,
    limit: number = 20,
  ): Promise<CampaignBidStats[]> {
    const stats = await this.db
      .select({
        campaign_id: bid_logs.campaign_id,
        total_requests: sql<number>`COUNT(*)`,
        bid_responses: sql<number>`SUM(CASE WHEN result IN ('bid', 'win', 'loss') THEN 1 ELSE 0 END)`,
        no_bid_responses: sql<number>`SUM(CASE WHEN result = 'no_bid' THEN 1 ELSE 0 END)`,
        wins: sql<number>`SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)`,
        losses: sql<number>`SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)`,
        timeouts: sql<number>`SUM(CASE WHEN result = 'timeout' THEN 1 ELSE 0 END)`,
        errors: sql<number>`SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END)`,
        total_bid_value: sql<number>`COALESCE(SUM(CAST(bid_price AS NUMERIC)), 0)`,
        total_win_value: sql<number>`COALESCE(SUM(CASE WHEN result = 'win' THEN CAST(win_price AS NUMERIC) ELSE 0 END), 0)`,
        avg_response_time_ms: sql<number>`AVG(response_time_ms)`,
        avg_bid_price: sql<number>`AVG(CAST(bid_price AS NUMERIC))`,
      })
      .from(bid_logs)
      .where(
        and(
          gte(bid_logs.created_at, startTime),
          lte(bid_logs.created_at, endTime)
        )
      )
      .groupBy(bid_logs.campaign_id)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    return stats.map((s: any) => {
      const totalRequests = Number(s.total_requests) || 0;
      const bidResponses = Number(s.bid_responses) || 0;
      const wins = Number(s.wins) || 0;

      return {
        campaignId: s.campaign_id || 0,
        totalRequests,
        bidResponses,
        noBidResponses: Number(s.no_bid_responses) || 0,
        wins,
        losses: Number(s.losses) || 0,
        timeouts: Number(s.timeouts) || 0,
        errors: Number(s.errors) || 0,
        totalBidValue: Number(s.total_bid_value) || 0,
        totalWinValue: Number(s.total_win_value) || 0,
        avgResponseTimeMs: Number(s.avg_response_time_ms) || 0,
        avgBidPrice: Number(s.avg_bid_price) || 0,
        bidRate: totalRequests > 0 ? bidResponses / totalRequests : 0,
        winRate: bidResponses > 0 ? wins / bidResponses : 0,
      };
    });
  }

  /**
   * Aggregate daily stats for SSPs
   * Call this periodically (e.g., every hour or at end of day)
   */
  async aggregateDailyStats(date: Date = new Date()): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sspStats = await this.getStatsBySsp(startOfDay, endOfDay);

    for (const stat of sspStats) {
      try {
        await this.db
          .insert(ssp_daily_stats)
          .values({
            ssp_id: stat.sspId,
            stat_date: startOfDay,
            total_requests: stat.totalRequests,
            valid_requests: stat.totalRequests,
            bid_responses: stat.bidResponses,
            no_bid_responses: stat.noBidResponses,
            wins: stat.wins,
            losses: stat.losses,
            timeouts: stat.timeouts,
            errors: stat.errors,
            total_bid_value: stat.totalBidValue.toString(),
            total_win_value: stat.totalWinValue.toString(),
            avg_response_time_ms: stat.avgResponseTimeMs.toString(),
            avg_bid_price: stat.avgBidPrice.toString(),
            win_rate: stat.winRate.toString(),
            bid_rate: stat.bidRate.toString(),
          })
          .onConflictDoUpdate({
            target: [ssp_daily_stats.ssp_id, ssp_daily_stats.stat_date],
            set: {
              total_requests: stat.totalRequests,
              valid_requests: stat.totalRequests,
              bid_responses: stat.bidResponses,
              no_bid_responses: stat.noBidResponses,
              wins: stat.wins,
              losses: stat.losses,
              timeouts: stat.timeouts,
              errors: stat.errors,
              total_bid_value: stat.totalBidValue.toString(),
              total_win_value: stat.totalWinValue.toString(),
              avg_response_time_ms: stat.avgResponseTimeMs.toString(),
              avg_bid_price: stat.avgBidPrice.toString(),
              win_rate: stat.winRate.toString(),
              bid_rate: stat.bidRate.toString(),
              updated_at: new Date(),
            },
          });

        this.logger.debug(`Aggregated daily stats for SSP ${stat.sspId}`);
      } catch (error) {
        this.logger.error(`Failed to aggregate stats for SSP ${stat.sspId}:`, error);
      }
    }

    this.logger.log(`Aggregated daily stats for ${sspStats.length} SSPs`);
  }
}
