/**
 * Mock SSP Adapter
 * A test adapter for development and testing purposes
 */

import { Injectable } from '@nestjs/common';
import { BaseSspAdapter } from './base-spp-adapter';
import { SspAdapterMetadata, SspHealthStatus } from '../types/ssp-adapter.types';
import { OpenRtbBidRequest, OpenRtbBidResponse } from '../../rtb/dto/bid-request.dto';

/**
 * Mock SSP Adapter
 * Used for testing and development
 * Simulates a basic SSP with configurable behavior
 */
@Injectable()
export class MockSspAdapter extends BaseSspAdapter {
  private static readonly METADATA: SspAdapterMetadata = {
    id: 'mock-ssp',
    name: 'Mock SSP',
    version: '1.0.0',
    description: 'A mock SSP adapter for testing and development',
    supportedFeatures: ['banner', 'video', 'native'],
    author: 'OpenAdServer',
  };

  constructor() {
    super(MockSspAdapter.METADATA);
  }

  /**
   * Validate request with mock-specific checks
   */
  async validateRequest(bidRequest: OpenRtbBidRequest): Promise<boolean> {
    // First run base validation
    const baseValid = await super.validateRequest(bidRequest);
    if (!baseValid) {
      return false;
    }

    // Mock-specific: Check for test mode
    if (bidRequest.test === 1) {
      this.logger.debug('Request is in test mode');
    }

    // Mock-specific: Validate site/app object exists
    if (!bidRequest.site && !bidRequest.app) {
      this.logger.warn('Mock SSP requires either site or app object');
      // Still return true for testing flexibility
    }

    return true;
  }

  /**
   * Transform request with mock-specific modifications
   */
  async transformRequest(bidRequest: OpenRtbBidRequest): Promise<OpenRtbBidRequest> {
    // Clone the request
    const transformed = JSON.parse(JSON.stringify(bidRequest));

    // Mock-specific: Add test extensions if not present
    if (!transformed.ext) {
      transformed.ext = {};
    }

    // Add mock SSP identifier
    transformed.ext.ssp = 'mock-ssp';

    // Mock-specific: Ensure currency is set
    if (!transformed.cur || transformed.cur.length === 0) {
      transformed.cur = ['USD'];
    }

    this.logger.debug(`Transformed request ${transformed.id} for Mock SSP`);
    return transformed;
  }

  /**
   * Transform response with mock-specific modifications
   */
  async transformResponse(bidResponse: OpenRtbBidResponse): Promise<OpenRtbBidResponse> {
    if (!bidResponse) {
      return bidResponse;
    }

    // Clone the response
    const transformed = JSON.parse(JSON.stringify(bidResponse));

    // Add mock SSP extensions
    if (!transformed.ext) {
      transformed.ext = {};
    }
    transformed.ext.ssp = 'mock-ssp';
    transformed.ext.processedAt = new Date().toISOString();

    this.logger.debug(`Transformed response for request ${transformed.id}`);
    return transformed;
  }

  /**
   * Health check for mock adapter
   */
  async healthCheck(): Promise<SspHealthStatus> {
    const startTime = Date.now();

    // Simulate a quick health check
    await new Promise(resolve => setTimeout(resolve, 1));

    return {
      healthy: this.enabled,
      latency: Date.now() - startTime,
      message: this.enabled ? 'Mock SSP is healthy' : 'Mock SSP is disabled',
      lastChecked: new Date(),
    };
  }
}
