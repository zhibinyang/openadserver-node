-- Flink SQL Job for Event Pipeline
-- Kafka → Flink (JOIN) → ClickHouse

-- Add required JARs
ADD JAR '/opt/flink/protobuf/events.jar';

-- =============================================================================
-- Kafka Source Tables (Protobuf format)
-- =============================================================================

-- Request Events Source
CREATE TABLE IF NOT EXISTS request_events_kafka (
    request_id STRING,
    event_time BIGINT,
    user_ids ROW<
        user_id STRING,
        hashed_email STRING,
        hashed_phone STRING,
        device_id STRING,
        cookiesync_id STRING,
        extended_ids MAP<STRING, STRING>
    >,
    segments ARRAY<STRING>,
    slot_id STRING,
    slot_type STRING,
    ip STRING,
    country STRING,
    city STRING,
    device STRING,
    browser STRING,
    os STRING,
    referer STRING,
    page_context STRING,
    response_count INT,
    has_winner BOOLEAN,
    winning_bid DOUBLE,
    -- Metadata
    `timestamp` TIMESTAMP(3) METADATA FROM 'timestamp',
    `partition` INT METADATA FROM 'partition',
    `offset` BIGINT METADATA FROM 'offset'
) WITH (
    'connector' = 'kafka',
    'topic' = 'REQUEST',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-request-processor',
    'format' = 'protobuf',
    'protobuf.message-class-name' = 'events.Events$RequestEvent',
    'scan.startup.mode' = 'latest-offset'
);

-- Ad Events Source
CREATE TABLE IF NOT EXISTS ad_events_kafka (
    request_id STRING,
    impression_id INT,
    click_id STRING,
    campaign_id INT,
    creative_id INT,
    advertiser_id INT,
    event_time BIGINT,
    bid DOUBLE,
    ecpm DOUBLE,
    cost DOUBLE,
    bid_type STRING,
    creative_type STRING,
    banner_width INT,
    banner_height INT,
    video_duration INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    landing_url STRING,
    -- Time attribute for temporal join
    event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3),
    -- Define watermark for event time (required for temporal join)
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' SECOND,
    -- Metadata
    `timestamp` TIMESTAMP(3) METADATA FROM 'timestamp',
    `partition` INT METADATA FROM 'partition',
    `offset` BIGINT METADATA FROM 'offset'
) WITH (
    'connector' = 'kafka',
    'topic' = 'AD',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-ad-processor',
    'format' = 'protobuf',
    'protobuf.message-class-name' = 'events.Events$AdEvent',
    'scan.startup.mode' = 'latest-offset'
);

-- Impression Events Source
CREATE TABLE IF NOT EXISTS impression_events_kafka (
    click_id STRING,
    event_time BIGINT,
    -- Time attribute and watermark (required for temporal join)
    event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' SECOND,
    -- Primary key on click_id (required for versioned table)
    PRIMARY KEY (click_id) NOT ENFORCED,
    -- Metadata
    `timestamp` TIMESTAMP(3) METADATA FROM 'timestamp',
    `partition` INT METADATA FROM 'partition',
    `offset` BIGINT METADATA FROM 'offset'
) WITH (
    'connector' = 'kafka',
    'topic' = 'IMPRESSION',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-impression-processor',
    'format' = 'protobuf',
    'protobuf.message-class-name' = 'events.Events$ImpressionEvent',
    'scan.startup.mode' = 'latest-offset'
);

-- Click Events Source
CREATE TABLE IF NOT EXISTS click_events_kafka (
    click_id STRING,
    event_time BIGINT,
    -- Time attribute and watermark (required for temporal join)
    event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' SECOND,
    -- Primary key on click_id (required for versioned table)
    PRIMARY KEY (click_id) NOT ENFORCED,
    -- Metadata
    `timestamp` TIMESTAMP(3) METADATA FROM 'timestamp',
    `partition` INT METADATA FROM 'partition',
    `offset` BIGINT METADATA FROM 'offset'
) WITH (
    'connector' = 'kafka',
    'topic' = 'CLICK',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-click-processor',
    'format' = 'protobuf',
    'protobuf.message-class-name' = 'events.Events$ClickEvent',
    'scan.startup.mode' = 'latest-offset'
);

-- Conversion Events Source
CREATE TABLE IF NOT EXISTS conversion_events_kafka (
    click_id STRING,
    event_time BIGINT,
    conversion_value DOUBLE,
    conversion_type STRING,
    attributes MAP<STRING, STRING>,
    -- Time attribute and watermark (required for temporal join)
    event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' SECOND,
    -- Primary key on click_id (required for versioned table)
    PRIMARY KEY (click_id) NOT ENFORCED,
    -- Metadata
    `timestamp` TIMESTAMP(3) METADATA FROM 'timestamp',
    `partition` INT METADATA FROM 'partition',
    `offset` BIGINT METADATA FROM 'offset'
) WITH (
    'connector' = 'kafka',
    'topic' = 'CONVERSION',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-conversion-processor',
    'format' = 'protobuf',
    'protobuf.message-class-name' = 'events.Events$ConversionEvent',
    'scan.startup.mode' = 'latest-offset'
);

-- Video VTR Events Source
CREATE TABLE IF NOT EXISTS video_vtr_events_kafka (
    click_id STRING,
    event_time BIGINT,
    event_type STRING,
    progress_percent INT,
    -- Time attribute and watermark (required for temporal join)
    event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' SECOND,
    -- Primary key on click_id (required for versioned table)
    PRIMARY KEY (click_id) NOT ENFORCED,
    -- Metadata
    `timestamp` TIMESTAMP(3) METADATA FROM 'timestamp',
    `partition` INT METADATA FROM 'partition',
    `offset` BIGINT METADATA FROM 'offset'
) WITH (
    'connector' = 'kafka',
    'topic' = 'VIDEO_VTR',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-video-vtr-processor',
    'format' = 'protobuf',
    'protobuf.message-class-name' = 'events.Events$VideoVTREvent',
    'scan.startup.mode' = 'latest-offset'
);

-- =============================================================================
-- Kafka Sink Tables (JSON format)
-- =============================================================================

-- Request Events Sink
CREATE TABLE IF NOT EXISTS request_events_kafka_sink (
    request_id STRING,
    event_time TIMESTAMP(3),
    user_id STRING,
    hashed_email STRING,
    hashed_phone STRING,
    device_id STRING,
    cookiesync_id STRING,
    segments ARRAY<STRING>,
    slot_id STRING,
    slot_type STRING,
    ip STRING,
    country STRING,
    city STRING,
    device STRING,
    browser STRING,
    os STRING,
    referer STRING,
    page_context STRING,
    response_count INT,
    has_winner BOOLEAN,
    winning_bid DOUBLE
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_REQUEST',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- Ad Events Sink
CREATE TABLE IF NOT EXISTS ad_events_kafka_sink (
    request_id STRING,
    impression_id INT,
    click_id STRING,
    campaign_id INT,
    creative_id INT,
    advertiser_id INT,
    event_time TIMESTAMP(3),
    bid DOUBLE,
    ecpm DOUBLE,
    cost DOUBLE,
    creative_type STRING,
    bid_type STRING,
    banner_width INT,
    banner_height INT,
    video_duration INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    landing_url STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- Ad + Impression Joined Sink
CREATE TABLE IF NOT EXISTS ad_impression_joined_kafka_sink (
    click_id STRING,
    request_id STRING,
    impression_id INT,
    campaign_id INT,
    creative_id INT,
    advertiser_id INT,
    event_time TIMESTAMP(3),
    bid DOUBLE,
    ecpm DOUBLE,
    cost DOUBLE,
    creative_type STRING,
    bid_type STRING,
    banner_width INT,
    banner_height INT,
    video_duration INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    landing_url STRING,
    impression_time TIMESTAMP(3)
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD_IMPRESSION',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- Ad + Click Joined Sink
CREATE TABLE IF NOT EXISTS ad_click_joined_kafka_sink (
    click_id STRING,
    request_id STRING,
    impression_id INT,
    campaign_id INT,
    creative_id INT,
    advertiser_id INT,
    event_time TIMESTAMP(3),
    bid DOUBLE,
    ecpm DOUBLE,
    cost DOUBLE,
    creative_type STRING,
    bid_type STRING,
    banner_width INT,
    banner_height INT,
    video_duration INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    landing_url STRING,
    click_time TIMESTAMP(3)
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD_CLICK',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- Ad + Conversion Joined Sink
CREATE TABLE IF NOT EXISTS ad_conversion_joined_kafka_sink (
    click_id STRING,
    request_id STRING,
    impression_id INT,
    campaign_id INT,
    creative_id INT,
    advertiser_id INT,
    event_time TIMESTAMP(3),
    bid DOUBLE,
    ecpm DOUBLE,
    cost DOUBLE,
    creative_type STRING,
    bid_type STRING,
    banner_width INT,
    banner_height INT,
    video_duration INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    landing_url STRING,
    conversion_time TIMESTAMP(3),
    conversion_value DOUBLE,
    conversion_type STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD_CONVERSION',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- Video VTR Events Sink
CREATE TABLE IF NOT EXISTS video_vtr_events_kafka_sink (
    click_id STRING,
    event_time TIMESTAMP(3),
    event_type STRING,
    progress_percent INT
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_VIDEO_VTR',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- Ad + Video VTR Joined Sink
CREATE TABLE IF NOT EXISTS ad_video_vtr_joined_kafka_sink (
    click_id STRING,
    request_id STRING,
    impression_id INT,
    campaign_id INT,
    creative_id INT,
    advertiser_id INT,
    ad_event_time TIMESTAMP(3),
    bid DOUBLE,
    ecpm DOUBLE,
    cost DOUBLE,
    creative_type STRING,
    bid_type STRING,
    banner_width INT,
    banner_height INT,
    video_duration INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    landing_url STRING,
    video_event_time TIMESTAMP(3),
    video_event_type STRING,
    progress_percent INT
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD_VIDEO_VTR',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- =============================================================================
-- Streaming Jobs
-- =============================================================================

-- Job 1: Request Events → Kafka
INSERT INTO request_events_kafka_sink
SELECT
    request_id,
    TO_TIMESTAMP_LTZ(event_time, 3) AS event_time,
    user_ids.user_id,
    user_ids.hashed_email,
    user_ids.hashed_phone,
    user_ids.device_id,
    user_ids.cookiesync_id,
    segments,
    slot_id,
    slot_type,
    ip,
    country,
    city,
    device,
    browser,
    os,
    referer,
    page_context,
    response_count,
    has_winner,
    winning_bid
FROM request_events_kafka;

-- Job 2: Ad Events → Kafka
INSERT INTO ad_events_kafka_sink
SELECT
    request_id,
    impression_id,
    click_id,
    campaign_id,
    creative_id,
    advertiser_id,
    TO_TIMESTAMP_LTZ(event_time, 3) AS event_time,
    bid,
    ecpm,
    cost,
    creative_type,
    bid_type,
    banner_width,
    banner_height,
    video_duration,
    slot_id,
    pctr,
    pcvr,
    landing_url
FROM ad_events_kafka;

-- Job 3: Ad + Impression JOIN → Kafka
-- Using temporal join with state retention
INSERT INTO ad_impression_joined_kafka_sink
SELECT
    a.click_id,
    a.request_id,
    a.impression_id,
    a.campaign_id,
    a.creative_id,
    a.advertiser_id,
    TO_TIMESTAMP_LTZ(a.event_time, 3) AS event_time,
    a.bid,
    a.ecpm,
    a.cost,
    a.creative_type,
    a.bid_type,
    a.banner_width,
    a.banner_height,
    a.video_duration,
    a.slot_id,
    a.pctr,
    a.pcvr,
    a.landing_url,
    TO_TIMESTAMP_LTZ(i.event_time, 3) AS impression_time
FROM ad_events_kafka AS a
INNER JOIN impression_events_kafka FOR SYSTEM_TIME AS OF a.event_time_ts AS i
ON a.click_id = i.click_id;

-- Job 4: Ad + Click JOIN → Kafka
INSERT INTO ad_click_joined_kafka_sink
SELECT
    a.click_id,
    a.request_id,
    a.impression_id,
    a.campaign_id,
    a.creative_id,
    a.advertiser_id,
    TO_TIMESTAMP_LTZ(a.event_time, 3) AS event_time,
    a.bid,
    a.ecpm,
    a.cost,
    a.creative_type,
    a.bid_type,
    a.banner_width,
    a.banner_height,
    a.video_duration,
    a.slot_id,
    a.pctr,
    a.pcvr,
    a.landing_url,
    TO_TIMESTAMP_LTZ(c.event_time, 3) AS click_time
FROM ad_events_kafka AS a
INNER JOIN click_events_kafka FOR SYSTEM_TIME AS OF a.event_time_ts AS c
ON a.click_id = c.click_id;

-- Job 5: Ad + Conversion JOIN → Kafka
INSERT INTO ad_conversion_joined_kafka_sink
SELECT
    a.click_id,
    a.request_id,
    a.impression_id,
    a.campaign_id,
    a.creative_id,
    a.advertiser_id,
    TO_TIMESTAMP_LTZ(a.event_time, 3) AS event_time,
    a.bid,
    a.ecpm,
    a.cost,
    a.creative_type,
    a.bid_type,
    a.banner_width,
    a.banner_height,
    a.video_duration,
    a.slot_id,
    a.pctr,
    a.pcvr,
    a.landing_url,
    TO_TIMESTAMP_LTZ(cv.event_time, 3) AS conversion_time,
    cv.conversion_value,
    cv.conversion_type
FROM ad_events_kafka AS a
INNER JOIN conversion_events_kafka FOR SYSTEM_TIME AS OF a.event_time_ts AS cv
ON a.click_id = cv.click_id;

-- Job 6: Video VTR Events → Kafka
INSERT INTO video_vtr_events_kafka_sink
SELECT
    click_id,
    TO_TIMESTAMP_LTZ(event_time, 3) AS event_time,
    event_type,
    progress_percent
FROM video_vtr_events_kafka;

-- Job 7: Ad + Video VTR JOIN → Kafka
INSERT INTO ad_video_vtr_joined_kafka_sink
SELECT
    a.click_id,
    a.request_id,
    a.impression_id,
    a.campaign_id,
    a.creative_id,
    a.advertiser_id,
    TO_TIMESTAMP_LTZ(a.event_time, 3) AS ad_event_time,
    a.bid,
    a.ecpm,
    a.cost,
    a.creative_type,
    a.bid_type,
    a.banner_width,
    a.banner_height,
    a.video_duration,
    a.slot_id,
    a.pctr,
    a.pcvr,
    a.landing_url,
    TO_TIMESTAMP_LTZ(v.event_time, 3) AS video_event_time,
    v.event_type,
    v.progress_percent
FROM ad_events_kafka AS a
INNER JOIN video_vtr_events_kafka FOR SYSTEM_TIME AS OF a.event_time_ts AS v
ON a.click_id = v.click_id;
