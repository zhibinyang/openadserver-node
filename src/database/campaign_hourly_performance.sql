-- Create the ad_events table if it doesn't already exist from the previous schema
CREATE SCHEMA IF NOT EXISTS `analytics`
OPTIONS(
  location = 'us-central1'
);

-- Create the campaign_hourly_performance table
CREATE TABLE IF NOT EXISTS `analytics.campaign_hourly_performance` (
  log_timestamp TIMESTAMP NOT NULL,
  campaign_id INT64 NOT NULL,
  campaign_name STRING,
  advertiser_id INT64,
  status INT64,
  is_active BOOLEAN,
  bid_type INT64,
  bid_amount FLOAT64,
  pacing_type INT64,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  budget_daily FLOAT64,
  budget_total FLOAT64,
  spent_today FLOAT64,
  spent_total FLOAT64,
  billable_count_today INT64,
  billable_count_total INT64
)
PARTITION BY DATE(log_timestamp)
CLUSTER BY campaign_id;
