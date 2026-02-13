ALTER TABLE "ad_events" ADD COLUMN "device" varchar(255);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "browser" varchar(255);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "ip" varchar(45);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "bid" numeric(12, 6) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "price" numeric(12, 6) DEFAULT '0';