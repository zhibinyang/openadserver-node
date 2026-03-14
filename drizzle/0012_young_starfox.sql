CREATE TABLE "segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL DEFAULT 'custom', -- custom, behavior, lookalike
	"status" smallint NOT NULL DEFAULT 1, -- 1:active, 0:inactive
	"user_count" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "segment_users" (
	"segment_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	PRIMARY KEY ("segment_id", "user_id")
);

CREATE INDEX idx_segment_users_user_id ON "segment_users" ("user_id");
CREATE INDEX idx_segment_users_expires_at ON "segment_users" ("expires_at");

ALTER TABLE "segment_users" ADD CONSTRAINT "segment_users_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE;
