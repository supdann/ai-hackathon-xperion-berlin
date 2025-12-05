import { embed, tool } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { searchPromoProducts } from '@/lib/db/promo-queries';

const productSchema = z.object({
  promo_id: z.string().describe('The ID of the promotion'),
  product_id: z.string().describe('The ID of the product'),
  promo_name: z.string().describe('Name of the promotion'),
  product_name: z.string().describe('Name of the product'),
  brand: z.string().nullable().describe('Brand of the product'),
  category: z.string().describe('Category of the product'),
  season_label: z.string().describe('Season associated with the promotion'),
  channel: z.string().describe('Sales channel for the promotion'),
  base_price: z.number().describe('Original price of the product'),
  discount_percent: z.number().describe('Discount percentage for the promotion'),
  promo_type: z.string().describe('Type of promotion'),
  base_margin_percent: z.number().describe('Base margin percentage'),
  total_units_sold: z.number().describe('Total units sold during the promotion'),
  units_lift_percent: z.number().nullable().describe('Percentage lift in units sold'),
  revenue_lift_percent: z.number().nullable().describe('Percentage lift in revenue'),
  margin_impact_euros: z.number().nullable().describe('Impact on margin in Euros'),
  profit_impact_euros: z.number().nullable().describe('Impact on profit in Euros'),
  similarity: z.number().describe('Semantic similarity score to the query'),
});

export const searchPromos = tool({
  description:
    "Search for promotional products using semantic search. Searches through 72,000+ promotional campaigns based on meaning and context.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Natural language search query for promotional products (e.g., 'gaming products for Black Friday with good margins')",
      ),
  }),
  execute: async (input) => {
    const { query } = input;
    try {
      console.log('[searchPromos] Tool called with query:', query);

      const { embedding: queryEmbedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: query,
      });

      console.log('[searchPromos] Generated embedding, length:', queryEmbedding.length);

      const results = await searchPromoProducts(queryEmbedding);

      console.log('[searchPromos] Received results from DB:', results.length, 'items');

      if (!results || results.length === 0) {
        console.log('[searchPromos] No results found, returning error');
        return {
          reasoning: 'No relevant promotions found for the query.',
          products: [],
        };
      }

      console.log('[searchPromos] Returning results to AI');
      return {
        reasoning: `Found ${results.length} promotional products that are semantically similar to the query '${query}'. The results are ranked by similarity score.`,
        products: results.map((r: any) => ({
          promo_id: r.promo_id,
          product_id: r.product_id,
          promo_name: r.promo_name,
          product_name: r.product_name,
          brand: r.brand,
          category: r.category,
          season_label: r.season_label,
          channel: r.channel,
          base_price: r.base_price,
          discount_percent: r.discount_percent,
          promo_type: r.promo_type,
          base_margin_percent: r.base_margin_percent,
          total_units_sold: r.total_units_sold,
          units_lift_percent: r.units_lift_percent,
          revenue_lift_percent: r.revenue_lift_percent,
          margin_impact_euros: r.margin_impact_euros,
          profit_impact_euros: r.profit_impact_euros,
          similarity: r.similarity,
        })),
      };
    } catch (error: any) {
      console.error("[searchPromos] Error in searchPromos tool:", error);
      return {
        reasoning: `The search failed due to an error: ${error.message}`,
        products: [],
      };
    }
  },
});
