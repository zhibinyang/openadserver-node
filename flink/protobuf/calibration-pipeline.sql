-- Calibration Global Factor Calculation Pipeline
-- This Flink SQL job computes global CTR/CVR calibration factors using 24h sliding window

-- Kafka Source Tables (Protobuf format, matching existing event schemas)
CREATE TABLE ad_events_kafka (
    click_id STRING,
    campaign_id INT,
    slot_id STRING,
    pctr DOUBLE,
    pcvr DOUBLE,
    event_time_ts TIMESTAMP(3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' MINUTE
) WITH (
    'connector' = 'kafka',
    'topic' = 'ad_events',
    'properties.bootstrap.servers' = 'localhost:9092',
    'properties.group.id' = 'flink-calibration-pipeline',
    'format' = 'protobuf',
    'protobuf.message-class' = 'com.openadserver.protobuf.AdEvent',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE impression_events_kafka (
    click_id STRING,
    event_time_ts TIMESTAMP(3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' MINUTE
) WITH (
    'connector' = 'kafka',
    'topic' = 'impression_events',
    'properties.bootstrap.servers' = 'localhost:9092',
    'properties.group.id' = 'flink-calibration-pipeline',
    'format' = 'protobuf',
    'protobuf.message-class' = 'com.openadserver.protobuf.ImpressionEvent',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE click_events_kafka (
    click_id STRING,
    event_time_ts TIMESTAMP(3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' MINUTE
) WITH (
    'connector' = 'kafka',
    'topic' = 'click_events',
    'properties.bootstrap.servers' = 'localhost:9092',
    'properties.group.id' = 'flink-calibration-pipeline',
    'format' = 'protobuf',
    'protobuf.message-class' = 'com.openadserver.protobuf.ClickEvent',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE conversion_events_kafka (
    click_id STRING,
    event_time_ts TIMESTAMP(3),
    WATERMARK FOR event_time_ts AS event_time_ts - INTERVAL '5' MINUTE
) WITH (
    'connector' = 'kafka',
    'topic' = 'conversion_events',
    'properties.bootstrap.servers' = 'localhost:9092',
    'properties.group.id' = 'flink-calibration-pipeline',
    'format' = 'protobuf',
    'protobuf.message-class' = 'com.openadserver.protobuf.ConversionEvent',
    'scan.startup.mode' = 'latest-offset'
);

-- Step 1: Ad dimension view, stores metadata for each click_id
CREATE TEMPORARY VIEW ad_dim AS
SELECT click_id, campaign_id, slot_id, pctr, pcvr, event_time_ts
FROM ad_events_kafka;

-- Step 2: Join impression events with ad dimension to get full attributes
CREATE TEMPORARY VIEW impression_with_attr AS
SELECT
    a.campaign_id,
    a.slot_id,
    a.pctr,
    i.event_time_ts
FROM impression_events_kafka i
INNER JOIN ad_dim a
ON i.click_id = a.click_id
AND a.event_time_ts BETWEEN i.event_time_ts - INTERVAL '1' HOUR AND i.event_time_ts;

-- Step 3: Join click events with ad dimension to get full attributes
CREATE TEMPORARY VIEW click_with_attr AS
SELECT
    a.campaign_id,
    a.slot_id,
    a.pcvr,
    c.event_time_ts
FROM click_events_kafka c
INNER JOIN ad_dim a
ON c.click_id = a.click_id
AND a.event_time_ts BETWEEN c.event_time_ts - INTERVAL '1' HOUR AND c.event_time_ts;

-- Step 4: Join conversion events with ad dimension to get full attributes
CREATE TEMPORARY VIEW conversion_with_attr AS
SELECT
    a.campaign_id,
    a.slot_id,
    cv.event_time_ts
FROM conversion_events_kafka cv
INNER JOIN ad_dim a
ON cv.click_id = a.click_id
AND a.event_time_ts BETWEEN cv.event_time_ts - INTERVAL '24' HOUR AND cv.event_time_ts;

-- Step 5: Unify all events into a single stream with aligned fields
CREATE TEMPORARY VIEW unified_events AS
SELECT
    campaign_id,
    slot_id,
    event_time_ts,
    pctr AS expected_clicks,
    0.0 AS actual_clicks,
    0.0 AS expected_convs,
    0.0 AS actual_convs
FROM impression_with_attr
UNION ALL
SELECT
    campaign_id,
    slot_id,
    event_time_ts,
    0.0,
    1.0,
    pcvr,
    0.0
FROM click_with_attr
UNION ALL
SELECT
    campaign_id,
    slot_id,
    event_time_ts,
    0.0,
    0.0,
    0.0,
    1.0
FROM conversion_with_attr;

-- Step 6: Calculate calibration factors using 24h sliding window
CREATE TEMPORARY VIEW calibration_result AS
SELECT
    campaign_id,
    slot_id,
    HOP_END(event_time_ts, INTERVAL '5' MINUTE, INTERVAL '24' HOUR) as update_time,
    -- Same calculation logic as original TypeScript code: Laplace smoothing + threshold clamping
    GREATEST(0.2, LEAST(2.0, (SUM(actual_clicks) + 10) / (SUM(expected_clicks) + 10))) AS ctr_factor,
    GREATEST(0.2, LEAST(2.0, (SUM(actual_convs) + 10) / (SUM(expected_convs) + 10))) AS cvr_factor
FROM unified_events
GROUP BY
    campaign_id,
    slot_id,
    -- Sliding window configuration: 24h window size, 5min slide interval
    HOP(event_time_ts, INTERVAL '5' MINUTE, INTERVAL '24' HOUR);

-- Redis Sink Table
CREATE TABLE redis_calibration_sink (
    key STRING PRIMARY KEY,
    value STRING
) WITH (
    'connector' = 'redis',
    'host' = 'localhost',
    'port' = '6379',
    'command' = 'SET',
    'key.ttl' = '7200' -- 2 hours expiration
);

-- Step 7: Write results to Redis
INSERT INTO redis_calibration_sink
SELECT
    CONCAT('calib:global:', campaign_id, ':', slot_id) as key,
    JSON_OBJECT(
        'ctr_factor', ctr_factor,
        'cvr_factor', cvr_factor,
        'update_time', update_time
    ) as value
FROM calibration_result;
