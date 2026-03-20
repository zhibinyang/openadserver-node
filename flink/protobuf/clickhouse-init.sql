-- =============================================================================
-- ClickHouse Initialization for Event Pipeline
-- Kafka Engine → Materialized View → MergeTree
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. request_events
-- -----------------------------------------------------------------------------

-- Kafka Engine table (virtual, consumes from FLINK_REQUEST topic)
CREATE TABLE IF NOT EXISTS request_events_kafka
(
    request_id String,
    event_time DateTime64(3),
    user_id String,
    hashed_email String,
    hashed_phone String,
    device_id String,
    cookiesync_id String,
    segments Array(String),
    slot_id String,
    slot_type String,
    ip String,
    country String,
    city String,
    device String,
    browser String,
    os String,
    referer String,
    page_context String,
    response_count Int32,
    has_winner UInt8,
    winning_bid Float64
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_REQUEST',
    kafka_group_name = 'clickhouse-request-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

-- Final MergeTree table
CREATE TABLE IF NOT EXISTS request_events
(
    request_id String,
    event_time DateTime64(3),
    user_id String,
    hashed_email String,
    hashed_phone String,
    device_id String,
    cookiesync_id String,
    segments Array(String),
    slot_id String,
    slot_type String,
    ip String,
    country String,
    city String,
    device String,
    browser String,
    os String,
    referer String,
    page_context String,
    response_count Int32,
    has_winner UInt8,
    winning_bid Float64
)
ENGINE = MergeTree()
ORDER BY (toDate(event_time), event_time, request_id);

-- Materialized View to automatically move data from Kafka to MergeTree
CREATE MATERIALIZED VIEW IF NOT EXISTS request_events_mv TO request_events AS
SELECT * FROM request_events_kafka;

-- -----------------------------------------------------------------------------
-- 2. ad_events
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_events_kafka
(
    request_id String,
    impression_id Int32,
    click_id String,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_AD',
    kafka_group_name = 'clickhouse-ad-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

CREATE TABLE IF NOT EXISTS ad_events
(
    request_id String,
    impression_id Int32,
    click_id String,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String
)
ENGINE = MergeTree()
ORDER BY (toDate(event_time), event_time, request_id, impression_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS ad_events_mv TO ad_events AS
SELECT * FROM ad_events_kafka;

-- -----------------------------------------------------------------------------
-- 3. ad_impression_joined
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_impression_joined_kafka
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    impression_time DateTime64(3)
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_AD_IMPRESSION',
    kafka_group_name = 'clickhouse-ad-impression-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

CREATE TABLE IF NOT EXISTS ad_impression_joined
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    impression_time DateTime64(3)
)
ENGINE = MergeTree()
ORDER BY (toDate(event_time), event_time, click_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS ad_impression_joined_mv TO ad_impression_joined AS
SELECT * FROM ad_impression_joined_kafka;

-- -----------------------------------------------------------------------------
-- 4. ad_click_joined
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_click_joined_kafka
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    click_time DateTime64(3)
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_AD_CLICK',
    kafka_group_name = 'clickhouse-ad-click-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

CREATE TABLE IF NOT EXISTS ad_click_joined
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    click_time DateTime64(3)
)
ENGINE = MergeTree()
ORDER BY (toDate(event_time), event_time, click_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS ad_click_joined_mv TO ad_click_joined AS
SELECT * FROM ad_click_joined_kafka;

-- -----------------------------------------------------------------------------
-- 5. ad_conversion_joined
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_conversion_joined_kafka
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    conversion_time DateTime64(3),
    conversion_value Float64,
    conversion_type String
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_AD_CONVERSION',
    kafka_group_name = 'clickhouse-ad-conversion-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

CREATE TABLE IF NOT EXISTS ad_conversion_joined
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    conversion_time DateTime64(3),
    conversion_value Float64,
    conversion_type String
)
ENGINE = MergeTree()
ORDER BY (toDate(event_time), event_time, click_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS ad_conversion_joined_mv TO ad_conversion_joined AS
SELECT * FROM ad_conversion_joined_kafka;

-- -----------------------------------------------------------------------------
-- 6. video_vtr_events
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_vtr_events_kafka
(
    click_id String,
    event_time DateTime64(3),
    event_type String,
    progress_percent Int32
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_VIDEO_VTR',
    kafka_group_name = 'clickhouse-video-vtr-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

CREATE TABLE IF NOT EXISTS video_vtr_events
(
    click_id String,
    event_time DateTime64(3),
    event_type String,
    progress_percent Int32
)
ENGINE = MergeTree()
ORDER BY (toDate(event_time), event_time, click_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS video_vtr_events_mv TO video_vtr_events AS
SELECT * FROM video_vtr_events_kafka;

-- -----------------------------------------------------------------------------
-- 7. ad_video_vtr_joined
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_video_vtr_joined_kafka
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    ad_event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    video_event_time DateTime64(3),
    video_event_type String,
    progress_percent Int32
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'FLINK_AD_VIDEO_VTR',
    kafka_group_name = 'clickhouse-ad-video-vtr-consumer',
    kafka_format = 'JSON',
    kafka_row_delimiter = '\n';

CREATE TABLE IF NOT EXISTS ad_video_vtr_joined
(
    click_id String,
    request_id String,
    impression_id Int32,
    campaign_id Int32,
    creative_id Int32,
    advertiser_id Int32,
    ad_event_time DateTime64(3),
    bid Float64,
    ecpm Float64,
    cost Float64,
    creative_type String,
    bid_type String,
    banner_width Int32,
    banner_height Int32,
    video_duration Int32,
    slot_id String,
    pctr Float64,
    pcvr Float64,
    landing_url String,
    video_event_time DateTime64(3),
    video_event_type String,
    progress_percent Int32
)
ENGINE = MergeTree()
ORDER BY (toDate(ad_event_time), ad_event_time, click_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS ad_video_vtr_joined_mv TO ad_video_vtr_joined AS
SELECT * FROM ad_video_vtr_joined_kafka;

-- =============================================================================
-- 8. Hourly & Daily Event Counts (Aggregated Materialized Views)
-- =============================================================================

-- 统一的聚合汇总表 (使用 SummingMergeTree 自动累加 total_count)
CREATE TABLE IF NOT EXISTS hourly_events_count
(
    event_date Date,
    event_hour DateTime,
    event_type String,
    total_count UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (event_date, event_hour, event_type);

-- Request 计数物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS request_hourly_mv TO hourly_events_count AS
SELECT
    toDate(event_time) AS event_date,
    toStartOfHour(event_time) AS event_hour,
    'request' AS event_type,
    toUInt64(count()) AS total_count
FROM request_events
GROUP BY event_date, event_hour;

-- Ad Event (Impression/Bid 等) 计数物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS ad_events_hourly_mv TO hourly_events_count AS
SELECT
    toDate(event_time) AS event_date,
    toStartOfHour(event_time) AS event_hour,
    'ad_event' AS event_type,
    toUInt64(count()) AS total_count
FROM ad_events
GROUP BY event_date, event_hour;

-- Click 计数物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS click_hourly_mv TO hourly_events_count AS
SELECT
    toDate(click_time) AS event_date,
    toStartOfHour(click_time) AS event_hour,
    'click' AS event_type,
    toUInt64(count()) AS total_count
FROM ad_click_joined
GROUP BY event_date, event_hour;

-- Conversion 计数物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS conversion_hourly_mv TO hourly_events_count AS
SELECT
    toDate(conversion_time) AS event_date,
    toStartOfHour(conversion_time) AS event_hour,
    'conversion' AS event_type,
    toUInt64(count()) AS total_count
FROM ad_conversion_joined
GROUP BY event_date, event_hour;

-- =============================================================================
-- 9. Query Views (普通查询视图：封装过滤与实时聚合逻辑)
-- =============================================================================

-- Request 查询视图：严格保证每小时1条记录，且只包含 request
CREATE VIEW IF NOT EXISTS request_hourly_view AS
SELECT
    event_date,
    event_hour,
    event_type,
    sum(total_count) AS total_count
FROM hourly_events_count
WHERE event_type = 'request'
GROUP BY event_date, event_hour, event_type;

-- Ad Event 查询视图
CREATE VIEW IF NOT EXISTS ad_events_hourly_view AS
SELECT
    event_date,
    event_hour,
    event_type,
    sum(total_count) AS total_count
FROM hourly_events_count
WHERE event_type = 'ad_event'
GROUP BY event_date, event_hour, event_type;

-- Click 查询视图
CREATE VIEW IF NOT EXISTS click_hourly_view AS
SELECT
    event_date,
    event_hour,
    event_type,
    sum(total_count) AS total_count
FROM hourly_events_count
WHERE event_type = 'click'
GROUP BY event_date, event_hour, event_type;

-- Conversion 查询视图
CREATE VIEW IF NOT EXISTS conversion_hourly_view AS
SELECT
    event_date,
    event_hour,
    event_type,
    sum(total_count) AS total_count
FROM hourly_events_count
WHERE event_type = 'conversion'
GROUP BY event_date, event_hour, event_type;
