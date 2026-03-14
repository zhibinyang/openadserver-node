/**
 * Common status enum.
 */
export enum Status {
    INACTIVE = 0,
    ACTIVE = 1,
    PAUSED = 2,
    DELETED = 3,
    PENDING = 4,
}

/**
 * Bid type enum.
 */
export enum BidType {
    CPM = 1, // Cost per mille (1000 impressions)
    CPC = 2, // Cost per click
    CPA = 3, // Cost per action/conversion
    OCPM = 4, // Optimized CPM
}

/**
 * Pacing type enum.
 */
export enum PacingType {
    EVEN = 1,          // Spend evenly over the remaining time
    AGGRESSIVE = 2,    // Spend slightly ahead of schedule
    DAILY_ASAP = 3,    // Spend as fast as possible until daily budget hits
    FLIGHT_ASAP = 4,   // Ignore daily budget, spend total budget ASAP
    EVER_GREEN = 5,    // Fallback tier: Never drop, ignore budgets/caps
}

/**
 * Creative type enum.
 */
export enum CreativeType {
    BANNER = 1,
    NATIVE = 2,
    VIDEO = 3,
    INTERSTITIAL = 4,
}

/**
 * Event type enum.
 */
export enum EventType {
    IMPRESSION = 1,
    CLICK = 2,
    CONVERSION = 3,
    VIDEO_START = 4,
    VIDEO_FIRST_QUARTILE = 5,
    VIDEO_MIDPOINT = 6,
    VIDEO_THIRD_QUARTILE = 7,
    VIDEO_COMPLETE = 8,
    REQUEST = 9, // Ad Request / Decision Log
}

/**
 * Targeting rule type enum.
 */
export enum TargetingRuleType {
    GEO = 'geo',
    OS = 'os',
    DEVICE = 'device',
    BROWSER = 'browser',
    AGE = 'age',
    GENDER = 'gender',
    INTEREST_INCLUDE = 'interest_include',
    INTEREST_EXCLUDE = 'interest_exclude',
    SEGMENT_INCLUDE = 'segment_include',
    SEGMENT_EXCLUDE = 'segment_exclude',
}

/**
 * Ad candidate for ranking.
 * Internal structure passed through the pipeline.
 */
export interface AdCandidate {
    campaign_id: number;
    creative_id: number;
    advertiser_id: number;
    bid: number;
    bid_type: BidType;

    // Targeting match info
    targeting_score?: number;

    // Predicted scores
    pctr?: number; // Predicted CTR
    pcvr?: number; // Predicted CVR
    ctr_factor?: number; // CTR Calibration Factor
    cvr_factor?: number; // CVR Calibration Factor

    // Calculated scores
    ecpm?: number; // Effective CPM
    score?: number; // Final ranking score
    actual_cost?: number; // The exact price to pay based on GSP

    // Creative info
    title?: string;
    description?: string;
    image_url?: string;
    video_url?: string;
    landing_url: string;
    creative_type: CreativeType;
    width?: number;
    height?: number;
    duration?: number;

    // Tracking ID (generated at response time)
    click_id?: string;

    // Extra info
    metadata?: Record<string, any>;
}

/**
 * User context used for targeting and prediction.
 */
export interface UserContext {
    user_id?: string;
    user_hash?: number; // Hash for bucketing

    // Device
    os: string;
    os_version?: string;
    device?: string;
    browser?: string;
    device_brand?: string;

    // Geo
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;

    // Context
    app_id: string;
    app_name?: string;
    network?: string;
    carrier?: string;

    // Slot & Referer
    slot_type?: number;  // CreativeType enum
    slot_id?: string;
    slot_width?: number;
    slot_height?: number;
    referer?: string;
    page_context?: string;
    num_ads?: number;

    // Features (for ML)
    age?: number;
    gender?: string;
    interests?: string[];
    app_categories?: string[];
    custom_features?: Record<string, any>;
}
