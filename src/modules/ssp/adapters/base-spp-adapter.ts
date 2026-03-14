/**
 * Base SSP Adapter
 * Abstract base class providing default implementations for SSP adapters
 */

import { Logger } from '@nestjs/common';
import {
  SspAdapter,
  SspConfig,
  SspHealthStatus,
  WinNoticeData,
  LossNoticeData,
  ImpressionData,
  ClickData,
  SspAdapterMetadata,
} from '../types/ssp-adapter.types';
import { OpenRtbBidRequest, OpenRtbBidResponse } from '../../rtb/dto/bid-request.dto';

/**
 * Abstract base class for SSP adapters
 * Provides common functionality and default implementations
 */
export abstract class BaseSspAdapter implements SspAdapter {
  protected readonly logger: Logger;
  protected config: SspConfig;

  constructor(protected readonly metadata: SspAdapterMetadata) {
    this.logger = new Logger(`${metadata.name}Adapter`);
  }

  get id(): string {
    return this.metadata.id;
  }

  get name(): string {
    return this.metadata.name;
  }

  get enabled(): boolean {
    return this.config?.enabled ?? false;
  }

  /**
   * Initialize the adapter with configuration
   * Override this method to add custom initialization logic
   */
  async initialize(config: SspConfig): Promise<void> {
    this.config = config;
    this.logger.log(`Initializing ${this.name} adapter with config: ${JSON.stringify({
      id: config.id,
      enabled: config.enabled,
      endpoint: config.endpoint,
    })}`);
  }

  /**
   * Validate incoming request
   * Default implementation checks for required fields
   * Override for SSP-specific validation
   */
  async validateRequest(bidRequest: OpenRtbBidRequest): Promise<boolean> {
    if (!bidRequest || !bidRequest.id) {
      this.logger.warn('Invalid request: missing request ID');
      return false;
    }

    if (!bidRequest.imp || bidRequest.imp.length === 0) {
      this.logger.warn('Invalid request: no impressions');
      return false;
    }

    return true;
  }

  /**
   * Transform incoming request
   * Default implementation passes through unchanged
   * Override for SSP-specific transformations
   */
  async transformRequest(bidRequest: OpenRtbBidRequest): Promise<OpenRtbBidRequest> {
    return bidRequest;
  }

  /**
   * Transform outgoing response
   * Default implementation passes through unchanged
   * Override for SSP-specific response formatting
   */
  async transformResponse(bidResponse: OpenRtbBidResponse): Promise<OpenRtbBidResponse> {
    return bidResponse;
  }

  /**
   * Handle win notice
   * Default implementation logs the event
   */
  async onWin(data: WinNoticeData): Promise<void> {
    this.logger.log(
      `Win notice received: BidId=${data.bidId}, Price=${data.price}, ` +
      `Campaign=${data.campaignId}, Creative=${data.creativeId}`
    );
  }

  /**
   * Handle loss notice
   * Default implementation logs the event
   */
  async onLoss(data: LossNoticeData): Promise<void> {
    this.logger.log(
      `Loss notice received: BidId=${data.bidId}, WinningPrice=${data.winningPrice || 'N/A'}, ` +
      `Campaign=${data.campaignId}, Creative=${data.creativeId}`
    );
  }

  /**
   * Handle impression event
   * Default implementation logs the event
   */
  async onImpression(data: ImpressionData): Promise<void> {
    this.logger.log(
      `Impression: BidId=${data.bidId}, ImpId=${data.impId}, ` +
      `Campaign=${data.campaignId}, Creative=${data.creativeId}`
    );
  }

  /**
   * Handle click event
   * Default implementation logs the event
   */
  async onClick(data: ClickData): Promise<void> {
    this.logger.log(
      `Click: BidId=${data.bidId}, ImpId=${data.impId}, ` +
      `Campaign=${data.campaignId}, Creative=${data.creativeId}`
    );
  }

  /**
   * Health check
   * Default implementation returns healthy
   * Override for actual health checking
   */
  async healthCheck(): Promise<SspHealthStatus> {
    return {
      healthy: this.enabled,
      message: this.enabled ? 'Adapter is enabled' : 'Adapter is disabled',
      lastChecked: new Date(),
    };
  }

  /**
   * Cleanup
   * Override for custom cleanup logic
   */
  async dispose(): Promise<void> {
    this.logger.log(`Disposing ${this.name} adapter`);
  }
}
