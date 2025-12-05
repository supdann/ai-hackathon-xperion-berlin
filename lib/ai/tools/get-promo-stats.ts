import { tool } from "ai";
import { z } from "zod";
import {
  getPromoStatsByCategory,
  getPromoStatsBySeason,
  getTopPerformingPromos,
  getTotalCount,
} from "@/lib/db/promo-queries";

const totalCountSchema = z.object({
  totalPromoProducts: z.number(),
  message: z.string(),
});

const categoryBreakdownSchema = z.object({
  totalCategories: z.number(),
  categories: z.array(z.object({
    category: z.string(),
    totalPromos: z.number(),
    totalRevenue: z.number(),
    totalUnits: z.number(),
    averageDiscount: z.string(),
    averageMargin: z.string(),
  })),
});

const seasonalBreakdownSchema = z.object({
  totalSeasons: z.number(),
  seasons: z.array(z.object({
    season: z.string(),
    totalPromos: z.number(),
    totalRevenue: z.number(),
    totalUnits: z.number(),
    averageDiscount: z.string(),
    averageMargin: z.string(),
  })),
});

const topPerformersSchema = z.object({
  sortedBy: z.string(),
  count: z.number(),
  topPromos: z.array(z.object({
    promoId: z.string(),
    promoName: z.string(),
    category: z.string(),
    seasonLabel: z.string(),
    totalProducts: z.number(),
    totalRevenue: z.number(),
    totalUnits: z.number(),
    averageDiscount: z.string(),
    averageMargin: z.string(),
  })),
});

const promoStatsSchema = z.union([
  totalCountSchema,
  categoryBreakdownSchema,
  seasonalBreakdownSchema,
  topPerformersSchema,
]);

export type PromoStats = z.infer<typeof promoStatsSchema>;

const inputSchema = z.object({
  statsType: z.enum(["total", "by_category", "by_season", "top_promos"]).describe(
    "Type of statistics to retrieve: 'total' for overall count, 'by_category' for category breakdown, 'by_season' for seasonal breakdown, 'top_promos' for best performing promotions"
  ),
  limit: z.number().optional().default(10).describe(
    "For 'top_promos', how many top performers to return (default: 10)"
  ),
  sortBy: z.enum(["total_revenue", "total_units", "avg_margin"]).optional().default("total_revenue").describe(
    "For 'top_promos', metric to sort by: total revenue, units sold, or average margin"
  ),
});

export const getPromoStats = tool({
  description: "Get aggregated statistics and insights about promotional campaigns. Use this to answer questions about overall performance, top performers, category breakdowns, or seasonal trends.",
  inputSchema,
  execute: async (input: z.infer<typeof inputSchema>): Promise<PromoStats | { error: string }> => {
    try {
      switch (input.statsType) {
        case "total": {
          const count = await getTotalCount();
          return {
            totalPromoProducts: count,
            message: `Database contains ${count.toLocaleString()} promotional product combinations`,
          };
        }

        case "by_category": {
          const stats = await getPromoStatsByCategory();
          const typedStats = stats as unknown as Array<{
            category: string;
            product_count: number;
            avg_margin: number | null;
            avg_price: number | null;
            total_units_sold: number;
            avg_units_lift: number | null;
            avg_revenue_lift: number | null;
          }>;
          return {
            totalCategories: typedStats.length,
            categories: typedStats.map((stat) => {
              const totalUnits = Number(stat.total_units_sold ?? 0);
              const avgPrice = stat.avg_price !== null ? Number(stat.avg_price) : 0;
              return {
                category: stat.category,
                totalPromos: Number(stat.product_count ?? 0),
                totalRevenue: avgPrice * totalUnits,
                totalUnits,
                averageDiscount: "N/A",
                averageMargin: stat.avg_margin !== null
                  ? `${Number(stat.avg_margin).toFixed(1)}%`
                  : "N/A",
              };
            }),
          };
        }

        case "by_season": {
          const stats = await getPromoStatsBySeason();
          const typedStats = stats as unknown as Array<{
            season_label: string;
            product_count: number;
            avg_margin: number | null;
            avg_price: number | null;
            total_units_sold: number;
            avg_units_lift: number | null;
            avg_revenue_lift: number | null;
          }>;
          return {
            totalSeasons: typedStats.length,
            seasons: typedStats.map((stat) => {
              const totalUnits = Number(stat.total_units_sold ?? 0);
              const avgPrice = stat.avg_price !== null ? Number(stat.avg_price) : 0;
              return {
                season: stat.season_label,
                totalPromos: Number(stat.product_count ?? 0),
                totalRevenue: avgPrice * totalUnits,
                totalUnits,
                averageDiscount: "N/A",
                averageMargin: stat.avg_margin !== null
                  ? `${Number(stat.avg_margin).toFixed(1)}%`
                  : "N/A",
              };
            }),
          };
        }

        case "top_promos": {
          const limit = Math.min(input.limit || 10, 50);
          const topPromos = await getTopPerformingPromos({
            limit,
            sortBy: input.sortBy || "total_revenue",
          });

          return {
            sortedBy: input.sortBy || "total_revenue",
            count: topPromos.length,
            topPromos: topPromos.map((promo) => ({
              promoId: promo.promoId,
              promoName: promo.promoName,
              category: promo.category,
              seasonLabel: promo.seasonLabel,
              totalProducts: 1,
              totalRevenue: Number(promo.basePrice) * Number(promo.totalUnitsSold ?? 0),
              totalUnits: Number(promo.totalUnitsSold ?? 0),
              averageDiscount: promo.discountPercent !== null && promo.discountPercent !== undefined
                ? `${Number(promo.discountPercent).toFixed(1)}%`
                : "N/A",
              averageMargin: promo.baseMarginPercent !== null && promo.baseMarginPercent !== undefined
                ? `${Number(promo.baseMarginPercent).toFixed(1)}%`
                : "N/A",
            })),
          };
        }

        default:
          return {
            error: "Invalid stats type requested",
          };
      }
    } catch (error: any) {
      console.error("Error in getPromoStats tool:", error);
      return {
        error: `Failed to retrieve statistics: ${error.message}`,
      };
    }
  },
});
