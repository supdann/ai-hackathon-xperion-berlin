import { createReadStream } from 'fs';
import { spawn } from 'child_process';
import Papa from 'papaparse';
import dotenv from 'dotenv';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

dotenv.config({ path: '.env.local' });

interface UnifiedRow {
    [key: string]: any;
}

interface EmbeddingRow {
    promo_id: string;
    product_id: string;
    embedding_text: string;
    embedding: string;
}

(async () => {
    try {
        console.log('🚀 Starting memory-safe batched data reload...');

        // 1. Load embeddings with streaming (avoid loading all at once)
        console.log('📥 Loading embeddings...');
        const embeddingsMap = new Map<string, string>();
        
        await new Promise<void>((resolve, reject) => {
            const embeddingStream = createReadStream('data/processed/embeddings.csv', {
                encoding: 'utf-8',
                highWaterMark: 32 * 1024 * 1024 // 32MB chunks
            });
            const embeddingParser = Papa.parse(Papa.NODE_STREAM_INPUT, {
                header: false,
                skipEmptyLines: true
            });

            embeddingStream.pipe(embeddingParser);

            embeddingParser.on('data', (row: string[]) => {
                if (row.length >= 4 && row[0] && row[1] && row[3]) {
                    const compositeKey = `${row[0]}_${row[1]}`;
                    embeddingsMap.set(compositeKey, row[3]);
                }
            });

            embeddingParser.on('end', () => {
                console.log(`✓ Loaded ${embeddingsMap.size.toLocaleString()} embeddings.`);
                resolve();
            });

            embeddingParser.on('error', reject);
        });

        // 2. Truncate table
        console.log('\n🗑️  Truncating table...');
        await new Promise<void>((resolve, reject) => {
            const psqlTruncate = spawn('psql', [
                process.env.POSTGRES_URL!,
                '-c',
                'TRUNCATE TABLE unified_promo_product;'
            ]);
            psqlTruncate.on('close', (code) => {
                if (code === 0) {
                    console.log('✓ Table truncated.');
                    resolve();
                } else {
                    reject(new Error(`Truncate failed with code ${code}`));
                }
            });
            psqlTruncate.stderr.on('data', (data) => {
                console.error(`Truncate error: ${data.toString()}`);
            });
        });

        // 3. Stream with backpressure control
        console.log('\n🚀 Streaming with COPY (backpressure-aware)...');
        
        const columns = [
            'promo_id', 'product_id', 'promo_name', 'season_label', 'category', 'product_name',
            'product_sku', 'brand', 'base_price', 'supplier_cost', 'base_margin_percent',
            'discount_percent', 'promo_type', 'date_start', 'date_end', 'channel',
            'times_promoted', 'total_units_sold', 'baseline_units', 'units_lift_percent',
            'revenue_lift_percent', 'margin_after_discount_percent', 'margin_impact_euros',
            'profit_impact_euros', 'embedding'
        ];

        const psqlCopy = spawn('psql', [
            process.env.POSTGRES_URL!,
            '-c',
            `COPY unified_promo_product (${columns.join(', ')}) FROM STDIN WITH (FORMAT CSV, NULL '\\N');`
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let rowCount = 0;
        let skippedCount = 0;

        // Transform stream to convert rows to CSV with backpressure
        const csvTransform = new Transform({
            objectMode: true,
            highWaterMark: 5000, // Process 5000 objects at a time
            transform(row: UnifiedRow, encoding, callback) {
                const compositeKey = `${row.promo_id}_${row.product_id}`;
                const embedding = embeddingsMap.get(compositeKey);

                if (!embedding) {
                    skippedCount++;
                    if (skippedCount % 1000 === 0) {
                        console.warn(`⚠️  Skipped ${skippedCount} rows without embeddings`);
                    }
                    callback();
                    return;
                }

                // Parse integer columns to handle malformed data
                const timesPromoted = row.times_promoted ? Math.round(parseFloat(row.times_promoted.toString().replace(/[^0-9.-]/g, ''))) : 0; // Default to 0 for NOT NULL
                const totalUnitsSold = row.total_units_sold ? Math.round(parseFloat(row.total_units_sold.toString().replace(/[^0-9.-]/g, ''))) : 0; // Default to 0 for NOT NULL
                const baselineUnits = row.baseline_units ? Math.round(parseFloat(row.baseline_units.toString().replace(/[^0-9.-]/g, ''))) : null;

                // Parse real columns to handle malformed data
                const basePrice = row.base_price ? parseFloat(row.base_price.toString().replace(/[^0-9.-]/g, '')) : 0; // Default to 0 for NOT NULL
                const supplierCost = row.supplier_cost ? parseFloat(row.supplier_cost.toString().replace(/[^0-9.-]/g, '')) : 0; // Default to 0 for NOT NULL
                const baseMarginPercent = row.base_margin_percent ? parseFloat(row.base_margin_percent.toString().replace(/[^0-9.-]/g, '')) : 0; // Default to 0 for NOT NULL
                const discountPercent = row.discount_percent ? parseFloat(row.discount_percent.toString().replace(/[^0-9.-]/g, '')) : 0; // Default to 0 for NOT NULL
                const unitsLiftPercent = row.units_lift_percent ? parseFloat(row.units_lift_percent.toString().replace(/[^0-9.-]/g, '')) : null;
                const revenueLiftPercent = row.revenue_lift_percent ? parseFloat(row.revenue_lift_percent.toString().replace(/[^0-9.-]/g, '')) : null;
                const marginAfterDiscountPercent = row.margin_after_discount_percent ? parseFloat(row.margin_after_discount_percent.toString().replace(/[^0-9.-]/g, '')) : null;
                const marginImpactEuros = row.margin_impact_euros ? parseFloat(row.margin_impact_euros.toString().replace(/[^0-9.-]/g, '')) : null;
                const profitImpactEuros = row.profit_impact_euros ? parseFloat(row.profit_impact_euros.toString().replace(/[^0-9.-]/g, '')) : null;

                const csvRow = [
                    escapeCsv(row.promo_id),
                    escapeCsv(row.product_id),
                    escapeCsv(row.promo_name),
                    escapeCsv(row.season_label),
                    escapeCsv(row.category),
                    escapeCsv(row.product_name),
                    escapeCsv(row.product_sku),
                    escapeCsv(row.brand),
                    basePrice,
                    supplierCost,
                    baseMarginPercent,
                    discountPercent,
                    escapeCsv(row.promo_type),
                    escapeCsv(row.date_start),
                    escapeCsv(row.date_end),
                    escapeCsv(row.channel),
                    timesPromoted,
                    totalUnitsSold,
                    baselineUnits ?? '\\N',
                    unitsLiftPercent ?? '\\N',
                    revenueLiftPercent ?? '\\N',
                    marginAfterDiscountPercent ?? '\\N',
                    marginImpactEuros ?? '\\N',
                    profitImpactEuros ?? '\\N',
                    escapeCsv(embedding)
                ].join(',') + '\n';

                rowCount++;
                if (rowCount % 1000 === 0) {
                    console.log(`   Processed ${rowCount.toLocaleString()} rows...`);
                }

                callback(null, csvRow);
            }
        });

        const unifiedStream = createReadStream('data/processed/unified_promo_product_data.csv', {
            encoding: 'utf-8',
            highWaterMark: 128 * 1024 * 1024 // 128MB chunks
        });

        const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        // Error handling
        psqlCopy.stderr.on('data', (data) => {
            const message = data.toString();
            if (!message.includes('NOTICE:')) {
                console.error(`psql stderr: ${message}`);
            }
        });

        // Pipeline with automatic backpressure
        await pipeline(
            unifiedStream,
            parser,
            csvTransform,
            psqlCopy.stdin
        );

        // Wait for psql to finish
        await new Promise<void>((resolve, reject) => {
            psqlCopy.on('close', (code) => {
                if (code === 0) {
                    console.log(`✓ Bulk insert completed. Total rows: ${rowCount.toLocaleString()}`);
                    if (skippedCount > 0) {
                        console.log(`⚠️  Skipped ${skippedCount.toLocaleString()} rows without embeddings`);
                    }
                    resolve();
                } else {
                    reject(new Error(`psql copy failed with code ${code}`));
                }
            });
        });

        // 4. Verify count
        console.log('\n📊 Verifying insertions...');
        await new Promise<void>((resolve, reject) => {
            const psqlCount = spawn('psql', [
                process.env.POSTGRES_URL!,
                '-c',
                'SELECT COUNT(*) FROM unified_promo_product;'
            ]);
            psqlCount.stdout.on('data', (data) => console.log(data.toString()));
            psqlCount.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Count query failed`));
            });
        });

        console.log('\n✅ Memory-safe batch reload complete!');
        console.log(`📊 Final stats: ${rowCount.toLocaleString()} inserted, ${skippedCount.toLocaleString()} skipped`);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
})();

function escapeCsv(value: any): string {
    if (value === null || value === undefined || value === '') return '\\N';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}