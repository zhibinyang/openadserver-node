/**
 * SSP Adapter Types
 * Defines the interface and types for SSP (Supply-Side Platform) connectors
 */

import { OpenRtbBidRequest, OpenRtbBidResponse } from '../../rtb/dto/bid-request.dto';

/**
 * SSP Configuration
 */
export interface SspConfig {
  /** Unique identifier for this SSP */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether this SSP is enabled */
  enabled: boolean;
  /** Endpoint URL for this SSP (if applicable) */
  endpoint?: string;
  /** API key or authentication token */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional configuration specific to the SSP */
  extra?: Record<string, unknown>;
}

/**
 * SSP Adapter Interface
 * All SSP adapters must implement this interface
 */
export interface SspAdapter {
  /**
   * Unique identifier for this SSP adapter
   */
  readonly id: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Whether this adapter is currently enabled
   */
  readonly enabled: boolean;

  /**
   * Initialize the adapter with configuration
   * Called once when the adapter is registered
   */
  initialize(config: SspConfig): Promise<void>;

  /**
   * Validate incoming request from this SSP
   * Returns true if the request is valid, false otherwise
   */
  validateRequest(bidRequest: OpenRtbBidRequest): Promise<boolean>;

  /**
   * Transform incoming request from SSP format to standard OpenRTB
   * Some SSPs may have slight variations in their implementation
   */
  transformRequest?(bidRequest: OpenRtbBidRequest): Promise<OpenRtbBidRequest>;

  /**
   * Transform outgoing response to SSP format
   * Some SSPs may require specific response formats
   */
  transformResponse?(bidResponse: OpenRtbBidResponse): Promise<OpenRtbBidResponse>;

  /**
   * Handle win notice (nurl) from SSP
   */
  onWin?(data: WinNoticeData): Promise<void>;

  /**
   * Handle loss notice from SSP
   */
  onLoss?(data: LossNoticeData): Promise<void>;

  /**
   * Handle impression event
   */
  onImpression?(data: ImpressionData): Promise<void>;

  /**
   * Handle click event
   */
  onClick?(data: ClickData): Promise<void>;

  /**
   * Health check for this adapter
   */
  healthCheck?(): Promise<SspHealthStatus>;

  /**
   * Cleanup when adapter is unregistered
   */
  dispose?(): Promise<void>;
}

/**
 * Win Notice Data
 */
export interface WinNoticeData {
  bidId: string;
  impId: string;
  campaignId: number;
  creativeId: number;
  price: number;
  currency?: string;
  timestamp?: Date;
  extra?: Record<string, unknown>;
}

/**
 * Loss Notice Data
 */
export interface LossNoticeData {
  bidId: string;
  impId: string;
  campaignId: number;
  creativeId: number;
  winningPrice?: number;
  currency?: string;
  timestamp?: Date;
  extra?: Record<string, unknown>;
}

/**
 * Impression Data
 */
export interface ImpressionData {
  bidId: string;
  impId: string;
  campaignId: number;
  creativeId: number;
  timestamp?: Date;
  extra?: Record<string, unknown>;
}

/**
 * Click Data
 */
export interface ClickData {
  bidId: string;
  impId: string;
  campaignId: number;
  creativeId: number;
  timestamp?: Date;
  extra?: Record<string, unknown>;
}

/**
 * SSP Health Status
 */
export interface SspHealthStatus {
  healthy: boolean;
  latency?: number;
  message?: string;
  lastChecked?: Date;
}

/**
 * SSP Adapter Metadata
 * Static information about an adapter
 */
export interface SspAdapterMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  supportedFeatures?: string[];
  author?: string;
}
