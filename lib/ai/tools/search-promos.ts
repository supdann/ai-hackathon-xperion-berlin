import { embed, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { searchPromoProducts } from "@/lib/db/promo-queries";

const inputSchema = z.object({
  query: z.string().describe(
    "Natural language search query for promotional products (e.g., 'gaming products for Black Friday with good margins')"
  ),
});

export const searchPromos = tool({
  description: "Search for promotional products using semantic search. Searches through 72,000+ promotional campaigns based on meaning and context.",
  inputSchema,
  execute: async (input: z.infer<typeof inputSchema>) => {
    try {
      console.log('[searchPromos] Tool called with query:', input.query);

      const { embedding: queryEmbedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: input.query,
      });

      console.log('[searchPromos] Generated embedding, length:', queryEmbedding.length);

      const results = await searchPromoProducts(queryEmbedding);

      console.log('[searchPromos] Received results from DB:', results.length, 'items');

      if (!results || results.length === 0) {
        console.log('[searchPromos] No results found, returning error');
        return { error: "No matching promotions found." };
      }

      console.log('[searchPromos] Returning results to AI');
      return results;
    } catch (error: any) {
      console.error("[searchPromos] Error in searchPromos tool:", error);
      return { error: `Search failed: ${error.message}` };
    }
  },
});
