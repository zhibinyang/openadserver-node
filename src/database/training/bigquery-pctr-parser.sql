WITH 
-- 1. 基础请求数据提取 (仅限 Banner)
base_requests AS (
  SELECT
    click_id,
    user_id,
    campaign_id,
    creative_id,
    slot_id,
    page_context,
    device,
    browser,
    os,
    country,
    city,
    banner_width,
    banner_height,
    bid_type,
    bid,
    event_time,
    -- 时间特征提取
    EXTRACT(HOUR FROM event_time) AS req_hour,
    EXTRACT(DAYOFWEEK FROM event_time) AS req_dow,
    -- 数据切分逻辑
    CASE 
      WHEN event_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR) 
           AND event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) THEN 'TRAIN'
      WHEN event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR) 
           AND event_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 0 HOUR) THEN 'VALIDATE'
      ELSE 'IGNORE' -- 忽略太旧或太新的数据
    END AS data_split
  FROM `analytics.ad_events`
  WHERE event_type = 9  -- REQUEST
    AND slot_type = 1   -- BANNER ONLY
    AND campaign_id > 0 -- 过滤空填充
),

-- 2. 基础点击数据提取 (去重)
base_clicks AS (
  SELECT
    click_id,
    1 AS is_clicked
  FROM `analytics.ad_events`
  WHERE event_type = 2 -- CLICK
  QUALIFY ROW_NUMBER() OVER(PARTITION BY click_id ORDER BY event_time) = 1
)

-- 3. 最终组装
SELECT
  r.*,
  COALESCE(c.is_clicked, 0) AS label
FROM base_requests r
LEFT JOIN base_clicks c ON r.click_id = c.click_id
WHERE r.data_split != 'IGNORE'
  AND r.click_id IS NOT NULL