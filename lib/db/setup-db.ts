#!/usr/bin/env tsx
/**
 * Setup PostgreSQL database with pgvector extension and create tables
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function setupDatabase() {
  console.log('🚀 Database Setup Script');
  console.log('========================\n');

  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL not found in environment variables');
    process.exit(1);
  }

  console.log('📡 Connecting to PostgreSQL...');

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // Check if pgvector extension exists
    console.log('\n🔍 Checking pgvector extension...');
    const vectorCheck = await db.execute(
      sql`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector`
    );

    const hasVector = vectorCheck?.[0]?.has_vector || false;
    if (hasVector) {
      console.log('   ✓ pgvector extension already enabled');
    } else {
      console.log('   ℹ️  pgvector will be enabled during migration');
    }

    // Run migrations
    console.log('\n📦 Running migrations...');
    const migrationsFolder = path.join(process.cwd(), 'lib/db/migrations');
    console.log(`   Migrations folder: ${migrationsFolder}`);

    await migrate(db, { migrationsFolder });

    console.log('   ✓ Migrations completed successfully');

    // Verify table creation
    console.log('\n✅ Verifying database setup...');

    const tableCheck = await db.execute(
      sql`SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'unified_promo_product'
      ) as has_table`
    );

    const hasTable = tableCheck?.[0]?.has_table || false;
    if (hasTable) {
      console.log('   ✓ Table "unified_promo_product" created');

      // Check row count
      const countResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM unified_promo_product`
      );
      const rowCount = Number(countResult?.[0]?.count || 0);
      console.log(`   ✓ Current row count: ${rowCount.toLocaleString()}`);

      // Check indexes
      const indexCheck = await db.execute(
        sql`SELECT indexname FROM pg_indexes WHERE tablename = 'unified_promo_product'`
      );
      console.log(`   ✓ Indexes created: ${indexCheck?.length || 0}`);
      indexCheck?.forEach((row: any) => {
        console.log(`      - ${row.indexname}`);
      });
    } else {
      console.error('   ❌ Table not found!');
    }

    console.log('\n✨ Database setup completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
