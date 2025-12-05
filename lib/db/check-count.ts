#!/usr/bin/env tsx
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.POSTGRES_URL!);

(async () => {
  try {
    const result = await client`SELECT COUNT(*) as count FROM unified_promo_product`;
    console.log(`\nCurrent row count: ${Number(result[0].count).toLocaleString()}\n`);
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
