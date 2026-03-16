CREATE TABLE "geo_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiser_id" integer NOT NULL,
	"campaign_id" integer,
	"creative_id" integer,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"source_url" varchar(1024),
	"embedding_status" varchar(20) DEFAULT 'pending',
	"milvus_pk" varchar(64),
	"status" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"user_id" varchar(255) NOT NULL,
	"identity_type" varchar(50) NOT NULL,
	"identity_value" varchar(255) NOT NULL,
	"source" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_identities_identity_type_identity_value_pk" PRIMARY KEY("identity_type","identity_value")
);
--> statement-breakpoint
ALTER TABLE "advertisers" ADD COLUMN "brand_weight" numeric(6, 4) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "geo_knowledge" ADD CONSTRAINT "geo_knowledge_advertiser_id_advertisers_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertisers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_knowledge" ADD CONSTRAINT "geo_knowledge_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_knowledge" ADD CONSTRAINT "geo_knowledge_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_knowledge_advertiser_id_idx" ON "geo_knowledge" USING btree ("advertiser_id");--> statement-breakpoint
CREATE INDEX "geo_knowledge_campaign_id_idx" ON "geo_knowledge" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "geo_knowledge_status_idx" ON "geo_knowledge" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_identities_user_id_idx" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_identities_type_idx" ON "user_identities" USING btree ("identity_type");