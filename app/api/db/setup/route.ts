import { NextResponse } from 'next/server';
import { db, pgClient } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';

/**
 * Setup database: enable pgvector and run migrations
 * POST /api/db/setup
 */
export async function POST() {
  try {
    const connectionString = process.env.POSTGRES_URL;

    if (!connectionString) {
      return NextResponse.json(
        { error: 'POSTGRES_URL not configured' },
        { status: 500 }
      );
    }

    // Create migration client
    const migrationClient = postgres(connectionString, { max: 1 });
    const migrationDb = postgres(connectionString, { max: 1 });

    // Run migrations
    console.log('Running migrations...');
    const migrationsFolder = path.join(process.cwd(), 'lib/db/migrations');
    await migrate(db, { migrationsFolder });

    console.log('Migrations completed successfully');

    await migrationClient.end();
    await migrationDb.end();

    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      tables: ['unified_promo_product'],
      extensions: ['vector'],
    });

  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Check database status
 * GET /api/db/setup
 */
export async function GET() {
  try {
    // Check if pgvector extension exists
    const vectorCheck = await db.execute(
      sql`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector`
    );

    // Check if table exists
    const tableCheck = await db.execute(
      sql`SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'unified_promo_product'
      ) as has_table`
    );

    // Get row count if table exists
    let rowCount = 0;
    if ((tableCheck[0] as any).has_table) {
      const countResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM unified_promo_product`
      );
      rowCount = Number((countResult[0] as any).count);
    }

    return NextResponse.json({
      vectorExtension: (vectorCheck[0] as any).has_vector,
      tableExists: (tableCheck[0] as any).has_table,
      rowCount,
    });

  } catch (error) {
    console.error('Database status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
