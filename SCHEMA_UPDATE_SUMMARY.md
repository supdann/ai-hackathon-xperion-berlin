# Database Schema Update Summary

## Changes Made

Updated the `unified_promo_product` table schema to match the actual CSV data structure.

### New Columns Added

The following columns were added to match the CSV data:

1. **`brand`** (text, nullable) - Product brand name
2. **`date_start`** (text, nullable) - Promotion start date
3. **`date_end`** (text, nullable) - Promotion end date
4. **`baseline_units`** (integer, nullable) - Baseline sales units before promotion
5. **`profit_impact_euros`** (real, nullable) - Total profit impact in euros

### Columns Renamed

1. **`margin_impact_dollars`** → **`margin_impact_euros`** - Fixed to match CSV column name (uses euros, not dollars)

## CSV Column Mapping

The updated schema now correctly maps to all 25 CSV columns:

```
CSV Column                      → Database Column
================================================
1.  promo_id                   → promoId
2.  product_id                 → productId
3.  promo_name                 → promoName
4.  season_label               → seasonLabel
5.  category                   → category
6.  product_name               → productName
7.  product_sku                → productSku
8.  brand                      → brand (NEW)
9.  base_price                 → basePrice
10. supplier_cost              → supplierCost
11. base_margin_percent        → baseMarginPercent
12. discount_percent           → discountPercent
13. promo_type                 → promoType
14. date_start                 → dateStart (NEW)
15. date_end                   → dateEnd (NEW)
16. channel                    → channel
17. times_promoted             → timesPromoted
18. total_units_sold           → totalUnitsSold
19. baseline_units             → baselineUnits (NEW)
20. units_lift_percent         → unitsLiftPercent
21. revenue_lift_percent       → revenueLiftPercent
22. margin_after_discount_percent → marginAfterDiscountPercent
23. margin_impact_euros        → marginImpactEuros (RENAMED)
24. profit_impact_euros        → profitImpactEuros (NEW)
25. embedding_text             → (not stored, used to generate embedding)
```

## Files Updated

### 1. [lib/db/schema.ts](lib/db/schema.ts)
- Added 5 new columns to `unifiedPromoProduct` table
- Renamed `marginImpactDollars` to `marginImpactEuros`
- Total columns: 26 (including id and embedding)

### 2. [lib/db/load-data.ts](lib/db/load-data.ts)
- Updated `UnifiedRow` interface to include all CSV columns
- Updated data insertion logic to map all 5 new columns
- Updated sample row display to show brand

### 3. [lib/db/migrations/0008_brainy_inhumans.sql](lib/db/migrations/0008_brainy_inhumans.sql)
- New migration file with complete table definition
- Includes pgvector extension creation
- Includes all indexes (btree and ivfflat)

### 4. [lib/db/migrations/meta/_journal.json](lib/db/migrations/meta/_journal.json)
- Updated migration journal to reference correct migration file

## Migration Notes

### Old Migration (Deleted)
- `0008_sleepy_proemial_gods.sql` - Had incorrect schema, missing columns

### New Migration
- `0008_brainy_inhumans.sql` - Complete schema with all 26 columns

## Next Steps

1. **Enable pgvector on Railway** (if not already enabled):
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Run Database Setup**:
   ```bash
   npx tsx lib/db/setup-db.ts
   ```

3. **Load Data**:
   ```bash
   npx tsx lib/db/load-data.ts
   ```

## Data Loading Details

- Source files:
  - `data/processed/embeddings.csv` (72,294 embeddings)
  - `data/processed/unified_promo_product_data.csv` (72,994 rows)

- Expected final row count: ~72,294 rows
  - 700 rows will be skipped (missing embeddings due to CSV parsing issues)

- Batch size: 1,000 rows per insert
- Progress reporting: Every 10,000 rows

## Schema Definition

Final table structure (26 columns):

```sql
CREATE TABLE unified_promo_product (
  id SERIAL PRIMARY KEY,
  promo_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  promo_name TEXT NOT NULL,
  season_label TEXT NOT NULL,
  category TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  brand TEXT,
  base_price REAL NOT NULL,
  supplier_cost REAL NOT NULL,
  base_margin_percent REAL NOT NULL,
  discount_percent REAL NOT NULL,
  promo_type TEXT NOT NULL,
  date_start TEXT,
  date_end TEXT,
  channel TEXT NOT NULL,
  times_promoted INTEGER NOT NULL,
  total_units_sold INTEGER NOT NULL,
  baseline_units INTEGER,
  units_lift_percent REAL,
  revenue_lift_percent REAL,
  margin_after_discount_percent REAL,
  margin_impact_euros REAL,
  profit_impact_euros REAL,
  embedding VECTOR(1536) NOT NULL
);

-- Indexes
CREATE INDEX season_label_idx ON unified_promo_product USING btree (season_label);
CREATE INDEX category_idx ON unified_promo_product USING btree (category);
CREATE INDEX product_id_idx ON unified_promo_product USING btree (product_id);
CREATE INDEX embedding_idx ON unified_promo_product USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
```
