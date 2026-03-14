CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"age" integer,
	"gender" varchar(20) DEFAULT 'unknown',
	"interests" json DEFAULT '[]'::json,
	"tags" json DEFAULT '[]'::json,
	"custom_attributes" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
