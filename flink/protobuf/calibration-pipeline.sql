-- Set idle timeout to prevent empty streams (like conversions) from holding back the watermark
-- If a partition/stream has no data for 10 seconds, it's marked as idle and its watermark is ignored.
SET 'table.exec.source.idle-timeout' = '10 s';

-- Enable early firing to output partial results before the 5min window closes (True real-time updates)
SET 'table.exec.emit.early-fire.enabled' = 'true';
SET 'table.exec.emit.early-fire.delay' = '5 s';

-- Calibration Global Factor Calculation Pipeline
-- This Flink SQL job computes global CTR/CVR calibration factors using 24h sliding window

-- =============================================================================
-- Downstream JSON Source Tables (Pre-Joined from event-pipeline)
-- =============================================================================
CREATE TABLE ad_impression_joined_source (
    campaign_id INT,
    slot_id STRING,
    pctr DOUBLE,
    impression_time TIMESTAMP(3),
    WATERMARK FOR impression_time AS impression_time - INTERVAL '5' MINUTE
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD_IMPRESSION',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-calibration-pipeline',
    'format' = 'json',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE ad_click_joined_source (
    campaign_id INT,
    slot_id STRING,
    pcvr DOUBLE,
    click_time TIMESTAMP(3),
    WATERMARK FOR click_time AS click_time - INTERVAL '5' MINUTE
) WITH (
    'connector' = 'kafka',
    'topic' = 'FLINK_AD_CLICK',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-calibration-pipeline',
    'format' = 'json',
    'scan.startup.mode' = 'latest-offset'
);


-- =============================================================================
-- Processing & Aggregation
-- =============================================================================

-- Step 1: Unify impression and click events for CTR calculation
CREATE TEMPORARY VIEW unified_events AS
SELECT
    campaign_id,
    slot_id,
    impression_time AS event_time_ts,
    pctr AS expected_clicks,
    0.0 AS actual_clicks
FROM ad_impression_joined_source
UNION ALL
SELECT
    campaign_id,
    slot_id,
    click_time AS event_time_ts,
    0.0 AS expected_clicks,
    1.0 AS actual_clicks
FROM ad_click_joined_source;

-- Step 2: Calculate CTR calibration factor using 24h sliding window
-- CVR calibration is now done via offline batch processing
CREATE TEMPORARY VIEW calibration_result AS
SELECT
    campaign_id,
    slot_id,
    HOP_END(event_time_ts, INTERVAL '5' MINUTE, INTERVAL '24' HOUR) as update_time,
    -- Same calculation logic as original TypeScript code: Laplace smoothing + threshold clamping
    GREATEST(0.2, LEAST(2.0, (SUM(actual_clicks) + 10) / (SUM(expected_clicks) + 10))) AS ctr_factor
FROM unified_events
GROUP BY
    campaign_id,
    slot_id,
    -- Sliding window configuration: 24h window size, 5min slide interval
    HOP(event_time_ts, INTERVAL '5' MINUTE, INTERVAL '24' HOUR);

-- =============================================================================
-- Redis Sink
-- =============================================================================

CREATE TABLE redis_calibration_sink (
    `key` STRING PRIMARY KEY NOT ENFORCED,
    `value` STRING
) WITH (
    'connector' = 'redis',
    'host' = 'redis',
    'port' = '6379',
    'redis-mode' = 'single',
    'command' = 'SET',
    'ttl' = '7200' -- 2 hours expiration
);

-- Step 3: Write CTR calibration factor to Redis
-- Key format: calib:global:ctr:{campaign_id}:{slot_id}
-- Value: plain float number (no JSON, for better performance)
INSERT INTO redis_calibration_sink
SELECT
    CONCAT('calib:global:ctr:', CAST(campaign_id AS STRING), ':', slot_id) as `key`,
    CAST(ctr_factor AS STRING) as `value`
FROM calibration_result;
