-- ClickHouse Schema for Event Pipeline
-- Flink handles JOINs, so we only need raw event tables and joined result tables

-- =============================================================================
-- Raw Event Tables (written by Flink from Kafka sources)
-- =============================================================================

-- Request Events Table
CREATE TABLE IF NOT EXISTS request_events (
    request_id String,
    event_time DateTime64(3),
    user_id Nullable(String),
    hashed_email Nullable(String),
    hashed_phone Nullable(String),
    device_id Nullable(String),
    cookiesync_id Nullable(String),
    segments Array(String),
    slot_id Nullable(String),
    slot_type String,
    ip Nullable(String),
    country Nullable(String),
    city Nullable(String),
    device Nullable(String),
    browser Nullable(String),
    os Nullable(String),
    referer Nullable(String),
    page_context Nullable(String),
    response_count Int32,
    has_winner UInt8,
    winning_bid Nullable(Decimal(18, 6))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, request_id)
TTL event_time + INTERVAL 90 DAY;

-- Ad Events Table (dimension table with ad details)
CREATE TABLE IF NOT EXISTS ad_events (
    request_id String,
    impression_id Int32,
    click_id String,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Decimal(18, 6),
    ecpm Decimal(18, 6),
    cost Decimal(18, 6),
    creative_type String,
    bid_type String,
    banner_width Nullable(Int32),
    banner_height Nullable(Int32),
    video_duration Nullable(Int32),
    slot_id Nullable(String),
    pctr Nullable(Decimal(10, 6)),
    pcvr Nullable(Decimal(10, 6)),
    landing_url Nullable(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Impression Events Table
CREATE TABLE IF NOT EXISTS impression_events (
    click_id String,
    event_time DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Click Events Table
CREATE TABLE IF NOT EXISTS click_events (
    click_id String,
    event_time DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Conversion Events Table
CREATE TABLE IF NOT EXISTS conversion_events (
    click_id String,
    event_time DateTime64(3),
    conversion_value Nullable(Decimal(18, 6)),
    conversion_type Nullable(String),
    attributes Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Video VTR Events Table
CREATE TABLE IF NOT EXISTS video_vtr_events (
    click_id String,
    event_time DateTime64(3),
    event_type String,
    progress_percent Int32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- =============================================================================
-- Joined Tables (written by Flink after stream JOINs)
-- =============================================================================

-- Ad + Impression Joined (for impression analytics)
CREATE TABLE IF NOT EXISTS ad_impression_joined (
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Decimal(18, 6),
    ecpm Decimal(18, 6),
    cost Decimal(18, 6),
    creative_type String,
    bid_type String,
    banner_width Nullable(Int32),
    banner_height Nullable(Int32),
    video_duration Nullable(Int32),
    slot_id Nullable(String),
    pctr Nullable(Decimal(10, 6)),
    pcvr Nullable(Decimal(10, 6)),
    landing_url Nullable(String),
    impression_time DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Ad + Click Joined (for click analytics)
CREATE TABLE IF NOT EXISTS ad_click_joined (
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Decimal(18, 6),
    ecpm Decimal(18, 6),
    cost Decimal(18, 6),
    creative_type String,
    bid_type String,
    banner_width Nullable(Int32),
    banner_height Nullable(Int32),
    video_duration Nullable(Int32),
    slot_id Nullable(String),
    pctr Nullable(Decimal(10, 6)),
    pcvr Nullable(Decimal(10, 6)),
    landing_url Nullable(String),
    click_time DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Ad + Conversion Joined (for conversion analytics)
CREATE TABLE IF NOT EXISTS ad_conversion_joined (
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Decimal(18, 6),
    ecpm Decimal(18, 6),
    cost Decimal(18, 6),
    creative_type String,
    bid_type String,
    banner_width Nullable(Int32),
    banner_height Nullable(Int32),
    video_duration Nullable(Int32),
    slot_id Nullable(String),
    pctr Nullable(Decimal(10, 6)),
    pcvr Nullable(Decimal(10, 6)),
    landing_url Nullable(String),
    conversion_time DateTime64(3),
    conversion_value Nullable(Decimal(18, 6)),
    conversion_type Nullable(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Ad + Video VTR Joined (for video analytics)
CREATE TABLE IF NOT EXISTS ad_video_vtr_joined (
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    ad_event_time DateTime64(3),
    bid Decimal(18, 6),
    ecpm Decimal(18, 6),
    cost Decimal(18, 6),
    creative_type String,
    bid_type String,
    banner_width Nullable(Int32),
    banner_height Nullable(Int32),
    video_duration Nullable(Int32),
    slot_id Nullable(String),
    pctr Nullable(Decimal(10, 6)),
    pcvr Nullable(Decimal(10, 6)),
    landing_url Nullable(String),
    video_event_time DateTime64(3),
    video_event_type String,
    progress_percent Int32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(ad_event_time)
ORDER BY (ad_event_time, click_id)
TTL ad_event_time + INTERVAL 90 DAY;
