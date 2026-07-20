CREATE TABLE "admin_credentials" (
	"id" text PRIMARY KEY DEFAULT 'admin',
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_codes" (
	"id" text PRIMARY KEY,
	"tier" text NOT NULL,
	"date" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_matches" (
	"id" text PRIMARY KEY,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"prediction" text NOT NULL,
	"league" text NOT NULL,
	"odds" text,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vip_tips" (
	"id" text PRIMARY KEY,
	"tier" text NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"prediction" text NOT NULL,
	"league" text NOT NULL,
	"time" text NOT NULL,
	"date" text NOT NULL,
	"odds" text,
	"confidence" text DEFAULT 'Medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_codes_tier_date_key" ON "booking_codes" ("tier","date");