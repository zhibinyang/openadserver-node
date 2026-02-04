CREATE TABLE "ad_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"click_id" varchar(64),
	"campaign_id" integer,
	"creative_id" integer,
	"user_id" varchar(255),
	"event_type" integer DEFAULT 1,
	"event_time" timestamp NOT NULL,
	"cost" numeric(12, 6) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "advertisers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"contact_email" varchar(255),
	"balance" numeric(12, 4) DEFAULT '0',
	"daily_budget" numeric(12, 4) DEFAULT '0',
	"status" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiser_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"budget_daily" numeric(12, 4) DEFAULT '0',
	"budget_total" numeric(12, 4) DEFAULT '0',
	"spent_today" numeric(12, 4) DEFAULT '0',
	"spent_total" numeric(12, 4) DEFAULT '0',
	"bid_type" integer DEFAULT 1,
	"bid_amount" numeric(12, 4) DEFAULT '0',
	"freq_cap_daily" integer DEFAULT 10,
	"freq_cap_hourly" integer DEFAULT 3,
	"start_time" timestamp,
	"end_time" timestamp,
	"status" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"image_url" varchar(1024),
	"video_url" varchar(1024),
	"landing_url" varchar(1024) NOT NULL,
	"creative_type" integer DEFAULT 1,
	"width" integer DEFAULT 0,
	"height" integer DEFAULT 0,
	"status" integer DEFAULT 1,
	"quality_score" integer DEFAULT 80,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hourly_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"stat_hour" timestamp NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"spend" numeric(12, 4) DEFAULT '0',
	"ctr" numeric(8, 6) DEFAULT '0',
	"cvr" numeric(8, 6) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "targeting_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"rule_type" varchar(50) NOT NULL,
	"rule_value" json NOT NULL,
	"is_include" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_id_advertisers_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertisers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hourly_stats" ADD CONSTRAINT "hourly_stats_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targeting_rules" ADD CONSTRAINT "targeting_rules_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_events_click_id_idx" ON "ad_events" USING btree ("click_id");