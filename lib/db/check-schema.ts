#!/usr/bin/env tsx
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.POSTGRES_URL!);

(async () => {
  try {
    const result = await client`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'unified_promo_product'
      ORDER BY ordinal_position
    `;

    console.log('\nColumns in unified_promo_product table:');
    console.log('========================================');
    result.forEach((row: any) => {
      console.log(`  ${row.column_name.padEnd(35)} ${row.data_type}`);
    });
    console.log(`\nTotal columns: ${result.length}\n`);

    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
