import "server-only";

import { eq, and, sql, desc, asc, inArray, or, like, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { unifiedPromoProduct, type UnifiedPromoProduct } from "./schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// ============================================================================
// TYPES
// ============================================================================

export interface PromoProductFilters {
  seasonLabel?: string;
  category?: string;
  channel?: string;
  promoType?: string;
  productId?: string;
  promoId?: string;
  minPrice?: number;
  maxPrice?: number;
  minMargin?: number;
  search?: string;
}

export interface VectorSearchOptions {
  query: string;
  embedding: number[];
  limit?: number;
  filters?: PromoProductFilters;
  minSimilarity?: number;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'margin' | 'price' | 'units_sold' | 'revenue_lift';
  order?: 'asc' | 'desc';
}

// ============================================================================
// CREATE
// ============================================================================

export async function createPromoProduct(data: Omit<UnifiedPromoProduct, 'id'>) {
  try {
    const [result] = await db.insert(unifiedPromoProduct).values(data).returning();
    return result;
  } catch (error) {
    console.error('Error creating promo product:', error);
    throw error;
  }
}

export async function bulkInsertPromoProducts(data: Omit<UnifiedPromoProduct, 'id'>[]) {
  try {
    const result = await db.insert(unifiedPromoProduct).values(data).returning();
    return result;
  } catch (error) {
    console.error('Error bulk inserting promo products:', error);
    throw error;
  }
}

// ============================================================================
// READ
// ============================================================================

export async function getPromoProductById(id: number) {
  try {
    const [result] = await db
      .select()
      .from(unifiedPromoProduct)
      .where(eq(unifiedPromoProduct.id, id));
    return result || null;
  } catch (error) {
    console.error('Error getting promo product by ID:', error);
    throw error;
  }
}

export async function getPromoProductsByPromoId(promoId: string) {
  try {
    return await db
      .select()
      .from(unifiedPromoProduct)
      .where(eq(unifiedPromoProduct.promoId, promoId));
  } catch (error) {
    console.error('Error getting promo products by promo ID:', error);
    throw error;
  }
}

export async function getPromoProductsByProductId(productId: string) {
  try {
    return await db
      .select()
      .from(unifiedPromoProduct)
      .where(eq(unifiedPromoProduct.productId, productId));
  } catch (error) {
    console.error('Error getting promo products by product ID:', error);
    throw error;
  }
}

export async function getPromoProductsByFilters(
  filters: PromoProductFilters,
  pagination?: PaginationOptions
) {
  try {
    const conditions: SQL[] = [];

    if (filters.seasonLabel) {
      conditions.push(eq(unifiedPromoProduct.seasonLabel, filters.seasonLabel));
    }

    if (filters.category) {
      conditions.push(eq(unifiedPromoProduct.category, filters.category));
    }

    if (filters.channel) {
      conditions.push(eq(unifiedPromoProduct.channel, filters.channel));
    }

    if (filters.promoType) {
      conditions.push(eq(unifiedPromoProduct.promoType, filters.promoType));
    }

    if (filters.productId) {
      conditions.push(eq(unifiedPromoProduct.productId, filters.productId));
    }

    if (filters.promoId) {
      conditions.push(eq(unifiedPromoProduct.promoId, filters.promoId));
    }

    if (filters.minPrice !== undefined) {
      conditions.push(sql`${unifiedPromoProduct.basePrice} >= ${filters.minPrice}`);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(sql`${unifiedPromoProduct.basePrice} <= ${filters.maxPrice}`);
    }

    if (filters.minMargin !== undefined) {
      conditions.push(sql`${unifiedPromoProduct.baseMarginPercent} >= ${filters.minMargin}`);
    }

    if (filters.search) {
      const searchCondition = or(
        like(unifiedPromoProduct.productName, `%${filters.search}%`),
        like(unifiedPromoProduct.promoName, `%${filters.search}%`),
        like(unifiedPromoProduct.category, `%${filters.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build base query
    const baseQuery = db.select().from(unifiedPromoProduct);

    // Apply where clause
    const queryWithWhere = conditions.length > 0
      ? baseQuery.where(and(...conditions)!)
      : baseQuery;

    // Apply ordering
    let finalQuery = queryWithWhere;
    if (pagination?.orderBy) {
      const orderFn = pagination.order === 'desc' ? desc : asc;
      switch (pagination.orderBy) {
        case 'margin':
          finalQuery = queryWithWhere.orderBy(orderFn(unifiedPromoProduct.baseMarginPercent)) as typeof queryWithWhere;
          break;
        case 'price':
          finalQuery = queryWithWhere.orderBy(orderFn(unifiedPromoProduct.basePrice)) as typeof queryWithWhere;
          break;
        case 'units_sold':
          finalQuery = queryWithWhere.orderBy(orderFn(unifiedPromoProduct.totalUnitsSold)) as typeof queryWithWhere;
          break;
        case 'revenue_lift':
          finalQuery = queryWithWhere.orderBy(orderFn(unifiedPromoProduct.revenueLiftPercent)) as typeof queryWithWhere;
          break;
      }
    }

    // Apply pagination
    if (pagination?.limit) {
      finalQuery = finalQuery.limit(pagination.limit) as typeof finalQuery;
    }

    if (pagination?.offset) {
      finalQuery = finalQuery.offset(pagination.offset) as typeof finalQuery;
    }

    return await finalQuery;
  } catch (error) {
    console.error('Error getting promo products by filters:', error);
    throw error;
  }
}

// ============================================================================
// VECTOR SEARCH
// ============================================================================

export async function searchPromoProductsBySimilarity(options: VectorSearchOptions) {
  try {
    const { embedding, limit = 10, filters, minSimilarity = 0.0 } = options;

    // Build WHERE clause
    let whereSQL = sql``;
    const conditions = [];

    if (filters?.seasonLabel) {
      conditions.push(sql`season_label = ${filters.seasonLabel}`);
    }

    if (filters?.category) {
      conditions.push(sql`category = ${filters.category}`);
    }

    if (filters?.channel) {
      conditions.push(sql`channel = ${filters.channel}`);
    }

    if (filters?.promoType) {
      conditions.push(sql`promo_type = ${filters.promoType}`);
    }

    if (conditions.length > 0) {
      whereSQL = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    }

    const results = await db.execute(sql`
      SELECT
        id,
        promo_id,
        product_id,
        promo_name,
        season_label,
        category,
        product_name,
        product_sku,
        base_price,
        supplier_cost,
        base_margin_percent,
        discount_percent,
        promo_type,
        channel,
        times_promoted,
        total_units_sold,
        units_lift_percent,
        revenue_lift_percent,
        margin_after_discount_percent,
        margin_impact_dollars,
        1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
      FROM unified_promo_product
      ${whereSQL}
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT ${limit}
    `);

    return results.filter((row: any) => row.similarity >= minSimilarity);
  } catch (error) {
    console.error('Error searching promo products by similarity:', error);
    throw error;
  }
}

export async function findSimilarPromoProducts(
  productId: string,
  limit: number = 10,
  filters?: PromoProductFilters
) {
  try {
    // Get the embedding for the given product
    const [product] = await db
      .select({ embedding: unifiedPromoProduct.embedding })
      .from(unifiedPromoProduct)
      .where(eq(unifiedPromoProduct.productId, productId))
      .limit(1);

    if (!product || !product.embedding) {
      throw new Error('Product not found or has no embedding');
    }

    // Parse embedding (it's stored as JSON string)
    const embedding = typeof product.embedding === 'string'
      ? JSON.parse(product.embedding)
      : product.embedding;

    return await searchPromoProductsBySimilarity({
      query: `Similar to product ${productId}`,
      embedding,
      limit: limit + 1, // +1 to exclude self
      filters,
    });
  } catch (error) {
    console.error('Error finding similar promo products:', error);
    throw error;
  }
}

// ============================================================================
// AGGREGATIONS
// ============================================================================

export async function getPromoStatsByCategory() {
  try {
    return await db.execute(sql`
      SELECT
        category,
        COUNT(*) as product_count,
        AVG(base_margin_percent) as avg_margin,
        AVG(base_price) as avg_price,
        SUM(total_units_sold) as total_units_sold,
        AVG(units_lift_percent) as avg_units_lift,
        AVG(revenue_lift_percent) as avg_revenue_lift
      FROM unified_promo_product
      GROUP BY category
      ORDER BY total_units_sold DESC
    `);
  } catch (error) {
    console.error('Error getting promo stats by category:', error);
    throw error;
  }
}

export async function getPromoStatsBySeason() {
  try {
    return await db.execute(sql`
      SELECT
        season_label,
        COUNT(*) as product_count,
        AVG(base_margin_percent) as avg_margin,
        AVG(base_price) as avg_price,
        SUM(total_units_sold) as total_units_sold,
        AVG(units_lift_percent) as avg_units_lift,
        AVG(revenue_lift_percent) as avg_revenue_lift
      FROM unified_promo_product
      GROUP BY season_label
      ORDER BY total_units_sold DESC
    `);
  } catch (error) {
    console.error('Error getting promo stats by season:', error);
    throw error;
  }
}

export async function getTopPerformingPromos(
  options?: number | { limit?: number; sortBy?: 'total_revenue' | 'total_units' | 'avg_margin' }
) {
  try {
    const limit = typeof options === 'number' ? options : options?.limit ?? 10;
    const sortBy = typeof options === 'number' ? 'total_revenue' : options?.sortBy ?? 'total_revenue';

    let orderColumn = unifiedPromoProduct.revenueLiftPercent as
      | typeof unifiedPromoProduct.revenueLiftPercent
      | typeof unifiedPromoProduct.totalUnitsSold
      | typeof unifiedPromoProduct.baseMarginPercent;
    if (sortBy === 'total_units') {
      orderColumn = unifiedPromoProduct.totalUnitsSold;
    }
    if (sortBy === 'avg_margin') {
      orderColumn = unifiedPromoProduct.baseMarginPercent;
    }

    return await db
      .select()
      .from(unifiedPromoProduct)
      .orderBy(desc(orderColumn))
      .limit(limit);
  } catch (error) {
    console.error('Error getting top performing promos:', error);
    throw error;
  }
}

export async function getTopSellingProducts(limit: number = 10) {
  try {
    return await db
      .select()
      .from(unifiedPromoProduct)
      .orderBy(desc(unifiedPromoProduct.totalUnitsSold))
      .limit(limit);
  } catch (error) {
    console.error('Error getting top selling products:', error);
    throw error;
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updatePromoProduct(
  id: number,
  data: Partial<Omit<UnifiedPromoProduct, 'id'>>
) {
  try {
    const [result] = await db
      .update(unifiedPromoProduct)
      .set(data)
      .where(eq(unifiedPromoProduct.id, id))
      .returning();
    return result;
  } catch (error) {
    console.error('Error updating promo product:', error);
    throw error;
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deletePromoProduct(id: number) {
  try {
    await db
      .delete(unifiedPromoProduct)
      .where(eq(unifiedPromoProduct.id, id));
    return true;
  } catch (error) {
    console.error('Error deleting promo product:', error);
    throw error;
  }
}

export async function deletePromoProductsByPromoId(promoId: string) {
  try {
    await db
      .delete(unifiedPromoProduct)
      .where(eq(unifiedPromoProduct.promoId, promoId));
    return true;
  } catch (error) {
    console.error('Error deleting promo products by promo ID:', error);
    throw error;
  }
}

// ============================================================================
// UTILITY
// ============================================================================

export async function getTotalCount() {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM unified_promo_product`
    );
    return Number(result?.[0]?.count || 0);
  } catch (error) {
    console.error('Error getting total count:', error);
    throw error;
  }
}

export async function getUniqueValues(column: 'seasonLabel' | 'category' | 'channel' | 'promoType') {
  try {
    const columnMap = {
      seasonLabel: 'season_label',
      category: 'category',
      channel: 'channel',
      promoType: 'promo_type',
    };

    const result = await db.execute(
      sql.raw(`SELECT DISTINCT ${columnMap[column]} as value FROM unified_promo_product ORDER BY ${columnMap[column]}`)
    );

    return result.map((row: any) => row.value);
  } catch (error) {
    console.error('Error getting unique values:', error);
    throw error;
  }
}
