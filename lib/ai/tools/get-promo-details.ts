import { tool } from "ai";
import { z } from "zod";
import {
  getPromoProductsByPromoId,
  getPromoProductsByFilters,
} from "@/lib/db/promo-queries";

const promoDetailsSchema = z.object({
  id: z.number(),
  promoId: z.string(),
  productId: z.string(),
  promoName: z.string(),
  productName: z.string(),
  productSku: z.string(),
  brand: z.string().nullable(),
  category: z.string(),
  seasonLabel: z.string(),
  channel: z.string(),
  promoType: z.string(),
  dateStart: z.date().nullable(),
  dateEnd: z.date().nullable(),
  pricing: z.object({
    basePrice: z.number(),
    supplierCost: z.number(),
    discountPercent: z.number(),
    baseMarginPercent: z.number(),
    marginAfterDiscountPercent: z.number().nullable(),
  }),
  performance: z.object({
    timesPromoted: z.number(),
    totalUnitsSold: z.number(),
    baselineUnits: z.number().nullable(),
    unitsLiftPercent: z.number().nullable(),
    revenueLiftPercent: z.number().nullable(),
    marginImpactEuros: z.number().nullable(),
    profitImpactEuros: z.number().nullable(),
  }),
});

export type PromoDetails = z.infer<typeof promoDetailsSchema>;

const inputSchema = z.object({
  promoId: z.string().optional().describe("Specific promotion ID to retrieve (e.g., 'PR0001')"),
  productId: z.string().optional().describe("Specific product ID to retrieve (e.g., 'P12345')"),
  category: z.string().optional().describe("Filter by category (e.g., 'electronics', 'toys')"),
  seasonLabel: z.string().optional().describe("Filter by season (e.g., 'blackfriday', 'christmas')"),
  channel: z.string().optional().describe("Filter by channel (e.g., 'online', 'store')"),
  promoType: z.string().optional().describe("Filter by promotion type (e.g., 'discount', 'bundle')"),
  minPrice: z.number().optional().describe("Minimum base price in euros"),
  maxPrice: z.number().optional().describe("Maximum base price in euros"),
  limit: z.number().optional().default(10).describe("Maximum number of results (default: 10, max: 50)"),
});

export const getPromoDetails = tool({
  description: "Get detailed information about specific promotional campaigns or products. Use this when users ask for details about a specific promo ID, product ID, or want to filter promotions by specific criteria.",
  inputSchema,
  execute: async (input: z.infer<typeof inputSchema>): Promise<PromoDetails[] | { error: string }> => {
    try {
      const limit = Math.min(input.limit || 10, 50);

      let results;

      if (input.promoId) {
        const promosById = await getPromoProductsByPromoId(input.promoId);
        results = promosById.slice(0, limit);
      } else {
        results = await getPromoProductsByFilters(
          {
            productId: input.productId,
            category: input.category,
            seasonLabel: input.seasonLabel,
            channel: input.channel,
            promoType: input.promoType,
            minPrice: input.minPrice,
            maxPrice: input.maxPrice,
          },
          {
            limit,
            offset: 0,
          }
        );
      }

      if (!results || results.length === 0) {
        return {
          error: "No promotions found matching the criteria",
        };
      }

      return results.map((promo): PromoDetails => ({
        id: promo.id,
        promoId: promo.promoId,
        productId: promo.productId,
        promoName: promo.promoName,
        productName: promo.productName,
        productSku: promo.productSku,
        brand: promo.brand,
        category: promo.category,
        seasonLabel: promo.seasonLabel,
        channel: promo.channel,
        promoType: promo.promoType,
        dateStart: promo.dateStart ? new Date(promo.dateStart) : null,
        dateEnd: promo.dateEnd ? new Date(promo.dateEnd) : null,
        pricing: {
          basePrice: promo.basePrice,
          supplierCost: promo.supplierCost,
          discountPercent: promo.discountPercent,
          baseMarginPercent: promo.baseMarginPercent,
          marginAfterDiscountPercent: promo.marginAfterDiscountPercent ?? null,
        },
        performance: {
          timesPromoted: promo.timesPromoted,
          totalUnitsSold: promo.totalUnitsSold,
          baselineUnits: promo.baselineUnits ?? null,
          unitsLiftPercent: promo.unitsLiftPercent ?? null,
          revenueLiftPercent: promo.revenueLiftPercent ?? null,
          marginImpactEuros: promo.marginImpactEuros ?? null,
          profitImpactEuros: promo.profitImpactEuros ?? null,
        },
      }));
    } catch (error: any) {
      console.error("Error in getPromoDetails tool:", error);
      return {
        error: `Failed to retrieve promotion details: ${error.message}`,
      };
    }
  },
});
