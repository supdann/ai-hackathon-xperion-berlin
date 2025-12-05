import "server-only";

import postgres from "postgres";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);

export async function searchPromoProducts(embedding: number[]) {
  try {
    // Format embedding as [1,2,3] for pgvector - escape the brackets
    const embeddingStr = `[${embedding.join(',')}]`;

    console.log('[searchPromoProducts] Embedding string format check:', embeddingStr.substring(0, 50));

    // Use unsafe to inject the vector string directly into SQL
    // Note: We need to escape the square brackets in the template string
    const results = await client.unsafe(`
      SELECT
        promo_id,
        product_id,
        promo_name,
        product_name,
        brand,
        category,
        season_label,
        channel,
        base_price,
        discount_percent,
        promo_type,
        base_margin_percent,
        total_units_sold,
        units_lift_percent,
        revenue_lift_percent,
        margin_impact_euros,
        profit_impact_euros,
        1 - (embedding <=> '\\[${embedding.join(',')}\\]'::vector) as similarity
      FROM unified_promo_product
      ORDER BY embedding <=> '\\[${embedding.join(',')}\\]'::vector
      LIMIT 10
    `);

    return results;
  } catch (error) {
    console.error('Error searching promo products:', error);
    throw error;
  }
}
