ALTER TABLE "ad_events" ADD COLUMN "os" varchar(50);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "conversion_value" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "video_duration" integer;--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "banner_width" integer;--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "banner_height" integer;--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "referer" varchar(2048);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "slot_type" integer;--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "slot_id" varchar(255);