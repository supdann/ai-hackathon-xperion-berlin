import { embed, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { searchPromoProductsBySimilarity } from "@/lib/db/promo-queries";

const promoSearchResultSchema = z.object({
  promoId: z.string(),
  productId: z.string(),
  promoName: z.string(),
  productName: z.string(),
  brand: z.string().nullable(),
  category: z.string(),
  seasonLabel: z.string(),
  channel: z.string(),
  basePrice: z.number(),
  discountPercent: z.number(),
  promoType: z.string(),
  totalUnitsSold: z.number(),
  unitsLiftPercent: z.number(),
  revenueLiftPercent: z.number(),
  marginImpactEuros: z.number(),
  profitImpactEuros: z.number(),
  similarity: z.string(),
});

export type PromoSearchResult = z.infer<typeof promoSearchResultSchema>;

const inputSchema = z.object({
  query: z.string().describe(
    "The search query. Can be natural language like 'best deals on electronics' or 'summer promotions for toys'"
  ),
  limit: z.number().optional().default(5).describe("Maximum number of results to return (default: 5, max: 20)"),
  seasonLabel: z.string().optional().describe("Filter by season (e.g., 'blackfriday', 'christmas', 'summer')"),
  category: z.string().optional().describe(
    "Filter by product category (e.g., 'electronics', 'toys', 'clothing')"
  ),
  channel: z.string().optional().describe(
    "Filter by sales channel (e.g., 'online', 'store', 'marketplace')"
  ),
  minSimilarity: z.number().optional().default(0.5).describe(
    "Minimum similarity score (0-1). Higher means more strict matching. Default is 0.5"
  ),
});

export const searchPromos = tool({
  description: "Search for promotional products using semantic search. This searches through a database of 72,000+ promotional campaigns and products based on meaning and context, not just keywords. Use this when users ask about promotions, deals, products, pricing, or marketing campaigns.",
  inputSchema,
  execute: async (input: z.infer<typeof inputSchema>): Promise<PromoSearchResult[] | { error: string }> => {
    try {
      const limit = Math.min(input.limit || 5, 20);

      const { embedding: queryEmbedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: input.query,
      });

      const results = await searchPromoProductsBySimilarity({
        query: input.query,
        embedding: queryEmbedding,
        limit,
        minSimilarity: input.minSimilarity ?? 0.5,
        filters: {
          seasonLabel: input.seasonLabel,
          category: input.category,
          channel: input.channel,
        },
      });

      if (!results || results.length === 0) {
        return {
          error: "No matching promotions found. Try broadening your search criteria.",
        };
      }

      return results.map((row: any): PromoSearchResult => ({
        promoId: row.promo_id,
        productId: row.product_id,
        promoName: row.promo_name,
        productName: row.product_name,
        brand: row.brand,
        category: row.category,
        seasonLabel: row.season_label,
        channel: row.channel,
        basePrice: row.base_price,
        discountPercent: row.discount_percent,
        promoType: row.promo_type,
        totalUnitsSold: row.total_units_sold,
        unitsLiftPercent: row.units_lift_percent,
        revenueLiftPercent: row.revenue_lift_percent,
        marginImpactEuros: row.margin_impact_euros,
        profitImpactEuros: row.profit_impact_euros,
        similarity: row.similarity
          ? (row.similarity * 100).toFixed(1) + "%"
          : "N/A",
      }));
    } catch (error: any) {
      console.error("Error in searchPromos tool:", error);
      return {
        error: `Search failed: ${error.message}`,
      };
    }
  },
});
