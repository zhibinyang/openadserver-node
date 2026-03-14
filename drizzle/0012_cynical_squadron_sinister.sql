CREATE TABLE "bid_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"bid_id" varchar(64),
	"imp_id" varchar(64),
	"ssp_id" varchar(50) NOT NULL,
	"campaign_id" integer,
	"creative_id" integer,
	"bid_price" numeric(12, 6) DEFAULT '0',
	"win_price" numeric(12, 6),
	"currency" varchar(3) DEFAULT 'USD',
	"result" varchar(20) NOT NULL,
	"response_time_ms" integer,
	"error_message" text,
	"user_id" varchar(255),
	"ip" varchar(45),
	"country" varchar(2),
	"device" varchar(255),
	"browser" varchar(255),
	"os" varchar(50),
	"slot_id" varchar(255),
	"slot_type" integer,
	"slot_width" integer,
	"slot_height" integer,
	"ext" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_users" (
	"segment_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "segment_users_segment_id_user_id_pk" PRIMARY KEY("segment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) DEFAULT 'custom' NOT NULL,
	"status" integer DEFAULT 1,
	"user_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ssp_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"ssp_id" varchar(50) NOT NULL,
	"stat_date" timestamp NOT NULL,
	"total_requests" integer DEFAULT 0,
	"valid_requests" integer DEFAULT 0,
	"bid_responses" integer DEFAULT 0,
	"no_bid_responses" integer DEFAULT 0,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0,
	"timeouts" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"total_bid_value" numeric(16, 6) DEFAULT '0',
	"total_win_value" numeric(16, 6) DEFAULT '0',
	"avg_response_time_ms" numeric(10, 2),
	"avg_bid_price" numeric(12, 6),
	"win_rate" numeric(6, 4) DEFAULT '0',
	"bid_rate" numeric(6, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bid_logs" ADD CONSTRAINT "bid_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_logs" ADD CONSTRAINT "bid_logs_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_users" ADD CONSTRAINT "segment_users_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bid_logs_request_id_idx" ON "bid_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "bid_logs_ssp_id_idx" ON "bid_logs" USING btree ("ssp_id");--> statement-breakpoint
CREATE INDEX "bid_logs_campaign_id_idx" ON "bid_logs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "bid_logs_result_idx" ON "bid_logs" USING btree ("result");--> statement-breakpoint
CREATE INDEX "bid_logs_created_at_idx" ON "bid_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "segment_users_user_id_idx" ON "segment_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "segment_users_expires_at_idx" ON "segment_users" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ssp_daily_stats_ssp_date_idx" ON "ssp_daily_stats" USING btree ("ssp_id","stat_date");