-- ClickHouse Schema for Event Pipeline
-- Each event type has its own table for efficient querying

-- Request Events Table
CREATE TABLE IF NOT EXISTS request_events (
    request_id String,
    event_time DateTime64(3),
    user_ids Tuple(
        hashed_email Nullable(String),
        hashed_phone Nullable(String),
        device_id Nullable(String),
        cookie_id Nullable(String)
    ),
    segments Array(String),
    slot_id String,
    slot_type Enum8('UNKNOWN' = 0, 'BANNER' = 1, 'NATIVE' = 2, 'VIDEO' = 3, 'INTERSTITIAL' = 4),
    ip Nullable(String),
    country Nullable(String),
    city Nullable(String),
    user_agent Nullable(String),
    device_type Nullable(String),
    os Nullable(String),
    browser Nullable(String)
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
    event_time DateTime64(3),
    bid Decimal(18, 6),
    ecpm Decimal(18, 6),
    cost Decimal(18, 6),
    creative_type Enum8('UNKNOWN' = 0, 'BANNER' = 1, 'NATIVE' = 2, 'VIDEO' = 3),
    bid_type Enum8('UNKNOWN' = 0, 'CPM' = 1, 'CPC' = 2, 'CPA' = 3),
    pctr Decimal(10, 6),
    pcvr Decimal(10, 6),
    slot_id String
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
    conversion_type Nullable(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Video VTR Events Table
CREATE TABLE IF NOT EXISTS video_vtr_events (
    click_id String,
    event_time DateTime64(3),
    event_type Enum8('UNKNOWN' = 0, 'START' = 1, 'FIRST_QUARTILE' = 2, 'MIDPOINT' = 3, 'THIRD_QUARTILE' = 4, 'COMPLETE' = 5),
    progress_percent Int32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY;

-- Materialized View for joined ad + impression events
CREATE MATERIALIZED VIEW IF NOT EXISTS ad_impression_joined
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY
AS SELECT
    a.click_id,
    a.request_id,
    a.impression_id,
    a.campaign_id,
    a.creative_id,
    a.event_time,
    a.bid,
    a.ecpm,
    a.cost,
    a.creative_type,
    a.bid_type,
    a.pctr,
    a.pcvr,
    a.slot_id
FROM ad_events a
INNER JOIN impression_events i ON a.click_id = i.click_id;

-- Materialized View for joined ad + click events
CREATE MATERIALIZED VIEW IF NOT EXISTS ad_click_joined
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, click_id)
TTL event_time + INTERVAL 90 DAY
AS SELECT
    a.click_id,
    a.request_id,
    a.impression_id,
    a.campaign_id,
    a.creative_id,
    a.event_time,
    a.bid,
    a.ecpm,
    a.cost,
    a.creative_type,
    a.bid_type,
    a.pctr,
    a.pcvr,
    a.slot_id
FROM ad_events a
INNER JOIN click_events c ON a.click_id = c.click_id;
