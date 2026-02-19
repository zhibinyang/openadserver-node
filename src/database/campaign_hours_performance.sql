CREATE MATERIALIZED VIEW `analytics.mv_campaign_hourly_performance`
OPTIONS (
  enable_refresh = true,
  refresh_interval_minutes = 5, -- 近实时刷新
  max_staleness = INTERVAL "0" MINUTE -- 保证数据最新
) AS
SELECT
  -- 1. 时间维度：截断到小时
  TIMESTAMP_TRUNC(t1.event_time, HOUR) AS event_hour,
  
  -- 2. 维度：ID 和 渲染名称
  t3.name AS advertiser_name,
  t1.campaign_id,
  t2.name AS campaign_name,
  t1.device,
  t1.country,

  -- 3. 指标：聚合计算
  COUNTIF(t1.event_type = 1) AS impressions,
  COUNTIF(t1.event_type = 2) AS clicks,
  COUNTIF(t1.event_type = 3) AS conversions,
  SUM(t1.price) AS total_spend,
  SUM(t1.conversion_value) AS total_conversion_value

FROM `analytics.ad_events` AS t1
-- 注意：这里 JOIN 的必须是 Datastream 同步过来的表
LEFT JOIN `pg_public.campaigns` AS t2 ON t1.campaign_id = t2.id
LEFT JOIN `pg_public.advertisers` AS t3 ON t2.advertiser_id = t3.id
WHERE slot_type = 1
GROUP BY 1, 2, 3, 4, 5, 6;