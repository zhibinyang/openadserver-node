import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AdEngine } from '../engine/ad-engine.service';
import { RequestMapper, RtbContext } from './mappers/request.mapper';
import { ResponseMapper } from './mappers/response.mapper';
import {
  OpenRtbBidRequest,
  OpenRtbBidResponse,
  OpenRtbNoBidReason,
} from './dto/bid-request.dto';
import { AdCandidate } from '../../shared/types';

/**
 * RTB Service - Orchestrates the bidding process
 */
@Injectable()
export class RtbService implements OnModuleInit {
  private readonly logger = new Logger(RtbService.name);

  // Default timeout for bidding (ms)
  private readonly DEFAULT_TMAX = 100;

  constructor(
    private readonly adEngine: AdEngine,
    private readonly requestMapper: RequestMapper,
    private readonly responseMapper: ResponseMapper,
  ) {}

  onModuleInit() {
    this.logger.log('RTB Service initialized');
  }

  /**
   * Process a BidRequest and return a BidResponse
   */
  async processBidRequest(bidRequest: OpenRtbBidRequest): Promise<OpenRtbBidResponse> {
    const startTime = Date.now();
    const requestId = bidRequest.id;

    this.logger.log(`Processing BidRequest: ${requestId}`);

    try {
      // 1. Map request to internal context
      const rtbContext = this.requestMapper.map(bidRequest);

      // 2. Check for valid impressions
      if (rtbContext.impressions.length === 0) {
        this.logger.warn(`No valid impressions in request ${requestId}`);
        return this.responseMapper.mapNoBid(requestId, OpenRtbNoBidReason.INVALID_REQUEST);
      }

      // 3. Calculate timeout
      const tmax = bidRequest.tmax || this.DEFAULT_TMAX;
      const elapsed = Date.now() - startTime;
      const remainingTime = tmax - elapsed;

      if (remainingTime <= 0) {
        this.logger.warn(`Request ${requestId} timed out during mapping`);
        return this.responseMapper.mapNoBid(requestId, OpenRtbNoBidReason.TECHNICAL_ERROR);
      }

      // 4. Process each impression (for now, just the first one)
      const allCandidates: AdCandidate[] = [];

      for (const imp of rtbContext.impressions) {
        // Build slot-specific context
        const context = {
          ...rtbContext.userContext,
          slot_id: imp.slotId,
          slot_type: imp.slotType,
          slot_width: imp.slotWidth,
          slot_height: imp.slotHeight,
        };

        // Check bid floor
        if (imp.bidFloor > 0) {
          // We'll let the engine handle this via bid comparison
          this.logger.debug(`Impression ${imp.impId} has bid floor: ${imp.bidFloor} ${imp.bidFloorCur}`);
        }

        // Run the ad engine with timeout
        const candidates = await this.runWithTimeout(
          this.adEngine.recommend(context, imp.slotId),
          remainingTime - 10, // Leave 10ms buffer for response building
        );

        // Filter by bid floor
        const filteredCandidates = candidates.filter((c: AdCandidate) => {
          const ecpm = c.ecpm || c.bid;
          return ecpm >= imp.bidFloor;
        });

        if (filteredCandidates.length > 0) {
          // Take top candidate for this impression
          allCandidates.push(filteredCandidates[0]);
        }
      }

      // 5. Build response
      if (allCandidates.length === 0) {
        this.logger.log(`No eligible ads for request ${requestId}`);
        return this.responseMapper.mapNoBid(requestId, OpenRtbNoBidReason.SUPPLY_FLOOR_NOT_MET);
      }

      const response = this.responseMapper.map(
        requestId,
        allCandidates,
        rtbContext.impressions,
        rtbContext.cur[0] || 'USD',
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `BidRequest ${requestId} completed in ${duration}ms: ` +
        `${allCandidates.length} bids, top eCPM=${allCandidates[0]?.ecpm?.toFixed(4) || 'N/A'}`
      );

      return response!;

    } catch (error) {
      this.logger.error(`Error processing BidRequest ${requestId}:`, error);
      return this.responseMapper.mapNoBid(requestId, OpenRtbNoBidReason.TECHNICAL_ERROR);
    }
  }

  /**
   * Run a promise with timeout
   */
  private async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Handle win notice from SSP
   */
  async handleWinNotice(data: {
    campaignId: number;
    creativeId: number;
    price: number;
    bidId?: string;
    impId?: string;
  }): Promise<void> {
    this.logger.log(
      `Win Notice: Campaign=${data.campaignId}, Creative=${data.creativeId}, ` +
      `Price=${data.price}, BidId=${data.bidId || 'N/A'}`
    );

    // TODO: Log win event for analytics and billing
    // This will be implemented in Phase 4
  }

  /**
   * Handle loss notice from SSP
   */
  async handleLossNotice(data: {
    campaignId: number;
    creativeId: number;
    winningPrice?: number;
    bidId?: string;
  }): Promise<void> {
    this.logger.log(
      `Loss Notice: Campaign=${data.campaignId}, Creative=${data.creativeId}, ` +
      `WinningPrice=${data.winningPrice || 'N/A'}, BidId=${data.bidId || 'N/A'}`
    );

    // TODO: Log loss event for analytics
  }
}
