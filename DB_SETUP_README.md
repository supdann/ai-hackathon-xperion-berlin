# Database Setup Guide

## Prerequisites

Your Railway PostgreSQL database must have the **pgvector** extension installed.

## Step 1: Enable pgvector Extension

### Option A: Using Railway CLI
```bash
railway connect postgres
\i scripts/enable-pgvector.sql
\q
```

### Option B: Using Railway Dashboard
1. Go to your Railway project
2. Click on your PostgreSQL service
3. Click "Query" tab
4. Run this SQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Option C: Using psql directly
```bash
psql $POSTGRES_URL -f scripts/enable-pgvector.sql
```

## Step 2: Run Database Migrations

After enabling pgvector, run the setup script:

```bash
npx tsx scripts/setup-db.ts
```

This will:
- Create the `unified_promo_product` table
- Create indexes on:
  - `season_label` (btree)
  - `category` (btree)
  - `product_id` (btree)
  - `embedding` (ivfflat for vector similarity search)

## Step 3: Verify Setup

The setup script will automatically verify:
- ✓ pgvector extension is enabled
- ✓ Table `unified_promo_product` exists
- ✓ All indexes are created
- ✓ Current row count

## Alternative: Using API Route

You can also setup the database via the API:

```bash
curl -X POST http://localhost:3000/api/db/setup
```

Or check status:

```bash
curl http://localhost:3000/api/db/setup
```

## Table Schema

The `unified_promo_product` table contains:

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| promo_id | text | Promotion identifier |
| product_id | text | Product identifier |
| promo_name | text | Promotion name |
| season_label | text | Season (blackfriday, christmas, etc.) |
| category | text | Product category |
| product_name | text | Product name |
| product_sku | text | Product SKU |
| base_price | real | Base price in euros |
| supplier_cost | real | Cost from supplier |
| base_margin_percent | real | Base margin percentage |
| discount_percent | real | Discount percentage |
| promo_type | text | Type of promotion |
| channel | text | Sales channel (stores/web) |
| times_promoted | integer | Number of times promoted |
| total_units_sold | integer | Total units sold |
| units_lift_percent | real | Units lift percentage |
| revenue_lift_percent | real | Revenue lift percentage |
| margin_after_discount_percent | real | Margin after discount |
| margin_impact_dollars | real | Margin impact in euros |
| embedding | vector(1536) | OpenAI text-embedding-3-small vector |

## Troubleshooting

### Error: extension "vector" is not available

This means pgvector is not installed on your PostgreSQL instance. You need to:

1. Check if you're using Railway's pgvector template
2. Or manually install pgvector on your PostgreSQL server
3. Railway may require you to use their pgvector-enabled template

### Migration fails

If migrations fail, you can:

1. Check the migration files in `lib/db/migrations/`
2. Run migrations manually using drizzle-kit:
   ```bash
   npx drizzle-kit push
   ```
3. Or drop the table and re-run:
   ```sql
   DROP TABLE IF EXISTS unified_promo_product CASCADE;
   ```

## Next Steps

After setup, you're ready to load data into the table. See the data loading guide for next steps.
