/**
 * Event type enumeration for Kafka topics
 */
export enum EventType {
  REQUEST = 'request',
  AD = 'ad',
  IMPRESSION = 'impression',
  CLICK = 'click',
  CONVERSION = 'conversion',
  VIDEO_VTR = 'video_vtr',
}

/**
 * Slot type enumeration
 */
export enum SlotType {
  UNKNOWN = 0,
  BANNER = 1,
  NATIVE = 2,
  VIDEO = 3,
  INTERSTITIAL = 4,
}

/**
 * Creative type enumeration
 */
export enum CreativeType {
  UNKNOWN = 0,
  BANNER = 1,
  NATIVE = 2,
  VIDEO = 3,
  INTERSTITIAL = 4,
  GEO_SNIPPET = 5,
}

/**
 * Bid type enumeration
 */
export enum BidType {
  UNKNOWN = 0,
  CPM = 1,
  CPC = 2,
  CPA = 3,
  OCPM = 4,
  GEO = 5,
}

/**
 * Video VTR event type enumeration
 */
export enum VideoEventType {
  UNKNOWN = 0,
  START = 1,
  FIRST_QUARTILE = 2,
  MIDPOINT = 3,
  THIRD_QUARTILE = 4,
  COMPLETE = 5,
}

/**
 * User identity with multiple ID types
 */
export interface UserIdentity {
  userId?: string;
  hashedEmail?: string;
  hashedPhone?: string;
  deviceId?: string;
  cookiesyncId?: string;
  extendedIds?: Record<string, string>;
}

/**
 * Request event - records ad request context
 */
export interface RequestEvent {
  requestId: string;
  eventTime: number;
  userIds?: UserIdentity;
  segments?: string[];
  slotId?: string;
  slotType: SlotType;
  ip?: string;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  referer?: string;
  pageContext?: string;
  responseCount: number;
  hasWinner: boolean;
  winningBid?: number;
}

/**
 * Ad event - records details of each returned ad
 */
export interface AdEvent {
  requestId: string;
  impressionId: number;
  clickId: string;
  campaignId: number;
  creativeId: number;
  advertiserId: number;
  eventTime: number;
  bid: number;
  ecpm: number;
  cost: number;
  bidType: BidType;
  creativeType: CreativeType;
  bannerWidth?: number;
  bannerHeight?: number;
  videoDuration?: number;
  slotId?: string;
  pctr?: number;
  pcvr?: number;
  landingUrl?: string;
}

/**
 * Impression event - records ad impression callback
 */
export interface ImpressionEvent {
  clickId: string;
  eventTime: number;
}

/**
 * Click event - records ad click callback
 */
export interface ClickEvent {
  clickId: string;
  eventTime: number;
}

/**
 * Conversion event - records conversion callback
 */
export interface ConversionEvent {
  clickId: string;
  eventTime: number;
  conversionValue?: number;
  conversionType?: string;
  attributes?: Record<string, string>;
}

/**
 * Video VTR event - records video playback progress
 */
export interface VideoVTREvent {
  clickId: string;
  eventTime: number;
  eventType: VideoEventType;
  progressPercent: number;
}

/**
 * Union type for all events
 */
export type AnyEvent =
  | RequestEvent
  | AdEvent
  | ImpressionEvent
  | ClickEvent
  | ConversionEvent
  | VideoVTREvent;

/**
 * Event with metadata for storage
 */
export interface StoredEvent {
  id: string;
  eventType: EventType;
  timestamp: number;
  data: Buffer;
  retryCount: number;
}
