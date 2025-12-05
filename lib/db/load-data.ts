#!/usr/bin/env tsx
/**
 * Load promo-product data with embeddings into PostgreSQL
 * Uses streaming to handle large embeddings file
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import Papa from 'papaparse';
import dotenv from 'dotenv';
import { unifiedPromoProduct } from './schema';

dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  embeddingsFile: 'data/processed/embeddings.csv',
  unifiedDataFile: 'data/processed/unified_promo_product_data.csv',
  batchSize: 1000,
  progressInterval: 10000,
};

// ============================================================================
// TYPES
// ============================================================================

interface EmbeddingRow {
  promo_id: string;
  product_id: string;
  embedding_text: string;
  embedding: string; // JSON string
}

interface UnifiedRow {
  promo_id: string;
  product_id: string;
  promo_name: string;
  season_label: string;
  category: string;
  product_name: string;
  product_sku: string;
  brand: string;
  base_price: string;
  supplier_cost: string;
  base_margin_percent: string;
  discount_percent: string;
  promo_type: string;
  date_start: string;
  date_end: string;
  channel: string;
  times_promoted: string;
  total_units_sold: string;
  baseline_units: string;
  units_lift_percent: string;
  revenue_lift_percent: string;
  margin_after_discount_percent: string;
  margin_impact_euros: string;
  profit_impact_euros: string;
  [key: string]: any;
}

// ============================================================================
// UTILITIES
// ============================================================================

async function loadCSV<T>(filePath: string): Promise<T[]> {
  const fileContent = await fs.readFile(filePath, 'utf-8');
  return new Promise((resolve, reject) => {
    Papa.parse<T>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });
}

async function streamCSV<T>(filePath: string): Promise<Map<string, T>> {
  return new Promise((resolve, reject) => {
    const dataMap = new Map<string, T>();
    let rowCount = 0;

    const stream = createReadStream(filePath, { encoding: 'utf-8' });

    Papa.parse<T>(stream, {
      header: true,
      skipEmptyLines: true,
      chunk: (results) => {
        for (const row of results.data) {
          const embeddingRow = row as any as EmbeddingRow;
          const key = `${embeddingRow.promo_id}_${embeddingRow.product_id}`;
          dataMap.set(key, row);
          rowCount++;

          if (rowCount % 10000 === 0) {
            console.log(`   Processed ${rowCount.toLocaleString()} embedding rows...`);
          }
        }
      },
      complete: () => {
        console.log(`   ✓ Loaded ${rowCount.toLocaleString()} embeddings`);
        resolve(dataMap);
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function parseInteger(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseInt(value, 10) : Math.floor(value);
  return isNaN(num) ? 0 : num;
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadData() {
  console.log('🚀 Data Loading Script');
  console.log('======================\n');

  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL not found');
    process.exit(1);
  }

  console.log('📡 Connecting to PostgreSQL...');
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Load embeddings using streaming
    console.log(`\n📂 Loading embeddings from: ${CONFIG.embeddingsFile}`);
    console.log('   Using streaming to handle large file...');
    const embeddingMap = await streamCSV<EmbeddingRow>(CONFIG.embeddingsFile);

    // Load unified data
    console.log(`\n📂 Loading unified data from: ${CONFIG.unifiedDataFile}`);
    const unifiedData = await loadCSV<UnifiedRow>(CONFIG.unifiedDataFile);
    console.log(`   ✓ Loaded ${unifiedData.length.toLocaleString()} rows`);

    // Check existing data
    console.log('\n🔍 Checking existing data...');
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM unified_promo_product`
    );
    const existingCount = Number(countResult?.[0]?.count || 0);

    if (existingCount > 0) {
      console.log(`   ⚠️  Found ${existingCount.toLocaleString()} existing rows`);
      console.log('   Truncating table...');
      await db.execute(sql`TRUNCATE TABLE unified_promo_product RESTART IDENTITY`);
      console.log('   ✓ Table truncated');
    }

    // Prepare data for insertion
    console.log('\n📦 Preparing data for insertion...');
    const rowsToInsert = [];
    let skipped = 0;

    for (const row of unifiedData) {
      const key = `${row.promo_id}_${row.product_id}`;
      const embeddingRow = embeddingMap.get(key);

      if (!embeddingRow) {
        skipped++;
        continue;
      }

      try {
        const embedding = JSON.parse((embeddingRow as any).embedding);

        rowsToInsert.push({
          promoId: row.promo_id,
          productId: row.product_id,
          promoName: row.promo_name || '',
          seasonLabel: row.season_label || '',
          category: row.category || '',
          productName: row.product_name || '',
          productSku: row.product_sku || '',
          brand: row.brand || null,
          basePrice: parseNumber(row.base_price),
          supplierCost: parseNumber(row.supplier_cost),
          baseMarginPercent: parseNumber(row.base_margin_percent),
          discountPercent: parseNumber(row.discount_percent),
          promoType: row.promo_type || '',
          dateStart: row.date_start || null,
          dateEnd: row.date_end || null,
          channel: row.channel || '',
          timesPromoted: parseInteger(row.times_promoted),
          totalUnitsSold: parseInteger(row.total_units_sold),
          baselineUnits: parseInteger(row.baseline_units),
          unitsLiftPercent: parseNumber(row.units_lift_percent),
          revenueLiftPercent: parseNumber(row.revenue_lift_percent),
          marginAfterDiscountPercent: parseNumber(row.margin_after_discount_percent),
          marginImpactEuros: parseNumber(row.margin_impact_euros),
          profitImpactEuros: parseNumber(row.profit_impact_euros),
          embedding: JSON.stringify(embedding),
        });
      } catch (error) {
        console.warn(`   ⚠️  Failed to parse embedding for ${key}`);
        skipped++;
      }
    }

    console.log(`   ✓ Prepared ${rowsToInsert.length.toLocaleString()} rows`);
    if (skipped > 0) {
      console.log(`   ⚠️  Skipped ${skipped.toLocaleString()} rows (no embedding found or parse error)`);
    }

    // Batch insert
    console.log(`\n💾 Inserting data (batch size: ${CONFIG.batchSize.toLocaleString()})...\n`);
    let totalInserted = 0;
    const startTime = Date.now();

    for (let i = 0; i < rowsToInsert.length; i += CONFIG.batchSize) {
      const batch = rowsToInsert.slice(i, i + CONFIG.batchSize);

      await db.insert(unifiedPromoProduct).values(batch);

      totalInserted += batch.length;

      if (totalInserted % CONFIG.progressInterval === 0 || totalInserted === rowsToInsert.length) {
        const progress = ((totalInserted / rowsToInsert.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (totalInserted / (Date.now() - startTime) * 1000).toFixed(0);
        console.log(
          `   Progress: ${progress}% (${totalInserted.toLocaleString()}/${rowsToInsert.length.toLocaleString()}) - ${elapsed}s - ${rate} rows/sec`
        );
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Data loading completed!`);
    console.log(`   Total inserted: ${totalInserted.toLocaleString()} rows`);
    console.log(`   Duration: ${duration.toFixed(1)}s`);
    console.log(`   Average rate: ${(totalInserted / duration).toFixed(0)} rows/sec`);

    // Verify
    console.log('\n🔍 Verifying data...');
    const finalCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM unified_promo_product`
    );
    const finalRows = Number(finalCount?.[0]?.count || 0);
    console.log(`   ✓ Final row count: ${finalRows.toLocaleString()}`);

    // Sample check
    const sample = await db.execute(
      sql`SELECT promo_id, product_id, promo_name, category, season_label, brand
          FROM unified_promo_product
          LIMIT 3`
    );
    console.log('\n📋 Sample rows:');
    sample?.forEach((row: any, idx: number) => {
      console.log(`   ${idx + 1}. ${row.promo_id} - ${row.product_id} - ${row.promo_name} (${row.brand || 'N/A'}, ${row.category}, ${row.season_label})`);
    });

    console.log('\n✨ All done!\n');

  } catch (error) {
    console.error('\n❌ Data loading failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

loadData();
