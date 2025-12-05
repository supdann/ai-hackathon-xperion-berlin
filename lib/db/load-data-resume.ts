#!/usr/bin/env tsx
/**
 * Load promo-product data with embeddings into PostgreSQL
 * Optimized version with resume capability
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
  batchSize: 500,
  progressInterval: 5000,
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
// GET ALREADY INSERTED KEYS
// ============================================================================

async function getInsertedKeys(db: any): Promise<Set<string>> {
  console.log('\n🔍 Checking already inserted rows...');
  const result = await db.execute(
    sql`SELECT promo_id, product_id FROM unified_promo_product`
  );

  const insertedKeys = new Set<string>();
  for (const row of result) {
    const key = `${row.promo_id}_${row.product_id}`;
    insertedKeys.add(key);
  }

  console.log(`   ✓ Found ${insertedKeys.size.toLocaleString()} already inserted rows`);
  return insertedKeys;
}

// ============================================================================
// STREAMING PROCESSOR
// ============================================================================

async function processAndInsertData(db: any, insertedKeys: Set<string>) {
  console.log('\n📂 Loading unified data from: ' + CONFIG.unifiedDataFile);
  const unifiedData = await loadCSV<UnifiedRow>(CONFIG.unifiedDataFile);
  console.log(`   ✓ Loaded ${unifiedData.length.toLocaleString()} rows`);

  // Create a lookup by key
  const unifiedMap = new Map<string, UnifiedRow>();
  for (const row of unifiedData) {
    const key = `${row.promo_id}_${row.product_id}`;
    unifiedMap.set(key, row);
  }

  console.log('\n📂 Processing embeddings and inserting data...');
  console.log('   Skipping already inserted rows\n');

  return new Promise<number>((resolve, reject) => {
    const rowsToInsert: any[] = [];
    let totalInserted = 0;
    let skipped = 0;
    let processed = 0;
    const startTime = Date.now();

    const stream = createReadStream(CONFIG.embeddingsFile, { encoding: 'utf-8' });

    Papa.parse<EmbeddingRow>(stream, {
      header: true,
      skipEmptyLines: true,
      chunk: async (results, parser) => {
        // Pause the stream while we process
        parser.pause();

        for (const embeddingRow of results.data) {
          processed++;
          const key = `${embeddingRow.promo_id}_${embeddingRow.product_id}`;

          // Skip if already inserted
          if (insertedKeys.has(key)) {
            skipped++;
            continue;
          }

          const unifiedRow = unifiedMap.get(key);

          if (!unifiedRow) {
            skipped++;
            continue;
          }

          try {
            const embedding = JSON.parse(embeddingRow.embedding);

            rowsToInsert.push({
              promoId: unifiedRow.promo_id,
              productId: unifiedRow.product_id,
              promoName: unifiedRow.promo_name || '',
              seasonLabel: unifiedRow.season_label || '',
              category: unifiedRow.category || '',
              productName: unifiedRow.product_name || '',
              productSku: unifiedRow.product_sku || '',
              brand: unifiedRow.brand || null,
              basePrice: parseNumber(unifiedRow.base_price),
              supplierCost: parseNumber(unifiedRow.supplier_cost),
              baseMarginPercent: parseNumber(unifiedRow.base_margin_percent),
              discountPercent: parseNumber(unifiedRow.discount_percent),
              promoType: unifiedRow.promo_type || '',
              dateStart: unifiedRow.date_start || null,
              dateEnd: unifiedRow.date_end || null,
              channel: unifiedRow.channel || '',
              timesPromoted: parseInteger(unifiedRow.times_promoted),
              totalUnitsSold: parseInteger(unifiedRow.total_units_sold),
              baselineUnits: parseInteger(unifiedRow.baseline_units),
              unitsLiftPercent: parseNumber(unifiedRow.units_lift_percent),
              revenueLiftPercent: parseNumber(unifiedRow.revenue_lift_percent),
              marginAfterDiscountPercent: parseNumber(unifiedRow.margin_after_discount_percent),
              marginImpactEuros: parseNumber(unifiedRow.margin_impact_euros),
              profitImpactEuros: parseNumber(unifiedRow.profit_impact_euros),
              embedding,
            });
          } catch (error) {
            skipped++;
          }

          // Insert when we reach batch size
          if (rowsToInsert.length >= CONFIG.batchSize) {
            try {
              await db.insert(unifiedPromoProduct).values(rowsToInsert);
              totalInserted += rowsToInsert.length;
              rowsToInsert.length = 0; // Clear array

              if (totalInserted % CONFIG.progressInterval === 0) {
                const progress = ((processed / 72994) * 100).toFixed(1);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const rate = (totalInserted / (Date.now() - startTime) * 1000).toFixed(0);
                console.log(
                  `   Progress: ${progress}% (${totalInserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped) - ${elapsed}s - ${rate} rows/sec`
                );
              }
            } catch (error) {
              parser.abort();
              reject(error);
              return;
            }
          }
        }

        // Resume the stream
        parser.resume();
      },
      complete: async () => {
        try {
          // Insert remaining rows
          if (rowsToInsert.length > 0) {
            await db.insert(unifiedPromoProduct).values(rowsToInsert);
            totalInserted += rowsToInsert.length;
          }

          const duration = (Date.now() - startTime) / 1000;
          console.log(`\n✅ Data loading completed!`);
          console.log(`   Total inserted: ${totalInserted.toLocaleString()} rows`);
          console.log(`   Total skipped: ${skipped.toLocaleString()} rows`);
          console.log(`   Duration: ${duration.toFixed(1)}s`);
          console.log(`   Average rate: ${(totalInserted / duration).toFixed(0)} rows/sec`);

          resolve(totalInserted);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadData() {
  console.log('🚀 Data Loading Script (Resume Mode)');
  console.log('====================================\n');

  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL not found');
    process.exit(1);
  }

  console.log('📡 Connecting to PostgreSQL...');
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Get already inserted keys
    const insertedKeys = await getInsertedKeys(db);

    // Process and insert remaining data
    await processAndInsertData(db, insertedKeys);

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
