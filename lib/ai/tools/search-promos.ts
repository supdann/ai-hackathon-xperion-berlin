import { embed, tool } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { searchPromoProducts } from '@/lib/db/promo-queries';

// Product schema matching the Drizzle promo model
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

// Output schema matching the return structure
const outputSchema = z.object({
  reasoning: z.string().describe('Explanation of the search results'),
  products: z.array(productSchema).describe('Array of promotional products matching the query'),
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
  outputSchema: outputSchema,
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
      const output = {
        reasoning: `Found ${results.length} promotional products that are semantically similar to the query '${query}'. The results are ranked by similarity score.`,
        products: results.map((r: any) => ({
          promo_id: String(r.promo_id || ''),
          product_id: String(r.product_id || ''),
          promo_name: String(r.promo_name || ''),
          product_name: String(r.product_name || ''),
          brand: r.brand ? String(r.brand) : null,
          category: String(r.category || ''),
          season_label: String(r.season_label || ''),
          channel: String(r.channel || ''),
          base_price: Number(r.base_price) || 0,
          discount_percent: Number(r.discount_percent) || 0,
          promo_type: String(r.promo_type || ''),
          base_margin_percent: Number(r.base_margin_percent) || 0,
          total_units_sold: Number(r.total_units_sold) || 0,
          units_lift_percent: r.units_lift_percent != null ? Number(r.units_lift_percent) : null,
          revenue_lift_percent: r.revenue_lift_percent != null ? Number(r.revenue_lift_percent) : null,
          margin_impact_euros: r.margin_impact_euros != null ? Number(r.margin_impact_euros) : null,
          profit_impact_euros: r.profit_impact_euros != null ? Number(r.profit_impact_euros) : null,
          similarity: Number(r.similarity) || 0,
        })),
      };

      // Validate output against schema
      const validatedOutput = outputSchema.parse(output);
      return validatedOutput;
    } catch (error: any) {
      console.error("[searchPromos] Error in searchPromos tool:", error);
      return {
        reasoning: `The search failed due to an error: ${error.message}`,
        products: [],
      };
    }
  },
});
