-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unified_promo_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"promo_id" text NOT NULL,
	"product_id" text NOT NULL,
	"promo_name" text NOT NULL,
	"season_label" text NOT NULL,
	"category" text NOT NULL,
	"product_name" text NOT NULL,
	"product_sku" text NOT NULL,
	"brand" text,
	"base_price" real NOT NULL,
	"supplier_cost" real NOT NULL,
	"base_margin_percent" real NOT NULL,
	"discount_percent" real NOT NULL,
	"promo_type" text NOT NULL,
	"date_start" text,
	"date_end" text,
	"channel" text NOT NULL,
	"times_promoted" integer NOT NULL,
	"total_units_sold" integer NOT NULL,
	"baseline_units" integer,
	"units_lift_percent" real,
	"revenue_lift_percent" real,
	"margin_after_discount_percent" real,
	"margin_impact_euros" real,
	"profit_impact_euros" real,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "season_label_idx" ON "unified_promo_product" USING btree ("season_label");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_idx" ON "unified_promo_product" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_id_idx" ON "unified_promo_product" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_idx" ON "unified_promo_product" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);