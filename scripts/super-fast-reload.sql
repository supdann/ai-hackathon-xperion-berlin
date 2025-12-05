-- This script provides a high-performance method to reload the promo product data.
-- It leverages temporary tables and PostgreSQL's native COPY and JOIN operations
-- to be significantly faster and more efficient than client-side processing.

-- Step 1: Clear the main table to prepare for the new data load.
-- TRUNCATE is used for performance as it's faster than DELETE for large tables.
\echo 'Step 1: Truncating unified_promo_product table...'
TRUNCATE unified_promo_product;

-- Step 2: Create temporary tables to stage the raw data from CSV files.
-- These tables are session-specific and will be dropped automatically upon completion.
-- Using TEXT for all columns initially simplifies the COPY process and avoids type errors.
\echo 'Step 2: Creating temporary staging tables...'
CREATE TEMP TABLE temp_unified_data (
    promo_id TEXT,
    product_id TEXT,
    promo_name TEXT,
    season_label TEXT,
    category TEXT,
    product_name TEXT,
    product_sku TEXT,
    brand TEXT,
    base_price TEXT,
    supplier_cost TEXT,
    base_margin_percent TEXT,
    discount_percent TEXT,
    promo_type TEXT,
    date_start TEXT,
    date_end TEXT,
    channel TEXT,
    times_promoted TEXT,
    total_units_sold TEXT,
    baseline_units TEXT,
    units_lift_percent TEXT,
    revenue_lift_percent TEXT,
    margin_after_discount_percent TEXT,
    margin_impact_euros TEXT,
    profit_impact_euros TEXT
);

CREATE TEMP TABLE temp_embeddings (
    promo_id TEXT,
    product_id TEXT,
    embedding_text TEXT,
    embedding TEXT
);

-- Step 3: Use the highly-efficient \COPY command to bulk load data from CSVs into the staging tables.
-- This is significantly faster than row-by-row INSERTs.
\echo 'Step 3: Copying CSV data into temporary tables...'
\COPY temp_unified_data FROM 'data/processed/unified_promo_product_data.csv' WITH (FORMAT CSV, HEADER);
\COPY temp_embeddings FROM 'data/processed/embeddings.csv' WITH (FORMAT CSV, HEADER);

-- Step 4: Perform the main data insertion.
-- This single query joins the two temporary tables, casts data to the correct types,
-- and inserts the final, joined data into the main table. This offloads all the heavy
-- processing to the highly-optimized PostgreSQL engine.
\echo 'Step 4: Joining data and inserting into final table...'
INSERT INTO unified_promo_product (
    promo_id,
    product_id,
    promo_name,
    season_label,
    category,
    product_name,
    product_sku,
    brand,
    base_price,
    supplier_cost,
    base_margin_percent,
    discount_percent,
    promo_type,
    date_start,
    date_end,
    channel,
    times_promoted,
    total_units_sold,
    baseline_units,
    units_lift_percent,
    revenue_lift_percent,
    margin_after_discount_percent,
    margin_impact_euros,
    profit_impact_euros,
    embedding
)
SELECT
    d.promo_id,
    d.product_id,
    d.promo_name,
    d.season_label,
    d.category,
    d.product_name,
    d.product_sku,
    d.brand,
    NULLIF(d.base_price, '')::real,
    NULLIF(d.supplier_cost, '')::real,
    NULLIF(d.base_margin_percent, '')::real,
    NULLIF(d.discount_percent, '')::real,
    d.promo_type,
    d.date_start,
    d.date_end,
    d.channel,
    NULLIF(d.times_promoted, '')::integer,
    NULLIF(d.total_units_sold, '')::integer,
    NULLIF(d.baseline_units, '')::integer,
    NULLIF(d.units_lift_percent, '')::real,
    NULLIF(d.revenue_lift_percent, '')::real,
    NULLIF(d.margin_after_discount_percent, '')::real,
    NULLIF(d.margin_impact_euros, '')::real,
    NULLIF(d.profit_impact_euros, '')::real,
    t_emb.embedding::vector
FROM
    temp_unified_data d
JOIN
    temp_embeddings t_emb ON d.promo_id = t_emb.promo_id AND d.product_id = t_emb.product_id;

\echo 'Step 5: Data reload complete!'

-- The temporary tables will be automatically dropped at the end of this session.
