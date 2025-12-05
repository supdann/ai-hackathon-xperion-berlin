#!/usr/bin/env tsx
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

(async () => {
  try {
    console.log('Dropping existing table...');
    await db.execute(sql`DROP TABLE IF EXISTS unified_promo_product CASCADE`);
    console.log('✓ Table dropped');

    console.log('\nCreating new table with updated schema...');
    await db.execute(sql`
      CREATE TABLE unified_promo_product (
        id serial PRIMARY KEY NOT NULL,
        promo_id text NOT NULL,
        product_id text NOT NULL,
        promo_name text NOT NULL,
        season_label text NOT NULL,
        category text NOT NULL,
        product_name text NOT NULL,
        product_sku text NOT NULL,
        brand text,
        base_price real NOT NULL,
        supplier_cost real NOT NULL,
        base_margin_percent real NOT NULL,
        discount_percent real NOT NULL,
        promo_type text NOT NULL,
        date_start text,
        date_end text,
        channel text NOT NULL,
        times_promoted integer NOT NULL,
        total_units_sold integer NOT NULL,
        baseline_units integer,
        units_lift_percent real,
        revenue_lift_percent real,
        margin_after_discount_percent real,
        margin_impact_euros real,
        profit_impact_euros real,
        embedding vector(1536) NOT NULL
      );
    `);
    console.log('✓ Table created');

    console.log('\nCreating indexes...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS season_label_idx ON unified_promo_product USING btree (season_label)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS category_idx ON unified_promo_product USING btree (category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_id_idx ON unified_promo_product USING btree (product_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS embedding_idx ON unified_promo_product USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)`);
    console.log('✓ Indexes created');

    console.log('\n✨ Done!');

    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
