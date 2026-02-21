CREATE TABLE "campaign_hourly_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_timestamp" timestamp NOT NULL,
	"campaign_id" integer NOT NULL,
	"campaign_name" varchar(255),
	"advertiser_id" integer,
	"status" integer,
	"is_active" boolean,
	"bid_type" integer,
	"bid_amount" numeric(12, 4),
	"pacing_type" integer,
	"start_time" timestamp,
	"end_time" timestamp,
	"budget_daily" numeric(12, 4),
	"budget_total" numeric(12, 4),
	"spent_today" numeric(12, 4),
	"spent_total" numeric(12, 4)
);
