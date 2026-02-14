-- Create the dataset if it doesn't exist
CREATE SCHEMA IF NOT EXISTS `analytics`;

-- Create the ad_events table
CREATE TABLE IF NOT EXISTS `analytics.ad_events` (
  request_id STRING NOT NULL,
  click_id STRING,
  campaign_id INT64,
  creative_id INT64,
  user_id STRING,
  device STRING,
  browser STRING,
  event_type INT64 NOT NULL,   -- 1=Impression, 2=Click, 3=Conversion
  event_time TIMESTAMP NOT NULL,
  cost FLOAT64,                -- Cost/Spend (CPM/CPC)
  ip STRING,
  country STRING,
  city STRING,
  bid FLOAT64,                 -- Bid Amount
  price FLOAT64,               -- Actual Price Paid
  os STRING,
  conversion_value FLOAT64,    -- Conversion value (NULL for non-conversions)
  video_duration INT64,        -- Video duration in seconds
  banner_width INT64,
  banner_height INT64,
  referer STRING,
  slot_type INT64,             -- CreativeType enum (1=Banner, 2=Native, 3=Video, 4=Interstitial)
  slot_id STRING,
  bid_type INT64,              -- BidType enum (1=CPM, 2=CPC, 3=CPA, 4=OCPM)
  ecpm FLOAT64,                -- Effective CPM
  page_context STRING           -- Page context info from the requesting page
)
PARTITION BY DATE(event_time)  -- Partition by day for cost/performance optimization
CLUSTER BY campaign_id, event_type; -- Cluster for faster filtering
