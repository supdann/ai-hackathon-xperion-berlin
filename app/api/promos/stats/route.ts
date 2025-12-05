import { NextRequest, NextResponse } from 'next/server';
import {
  getPromoStatsByCategory,
  getPromoStatsBySeason,
  getTopPerformingPromos,
  getTopSellingProducts,
  getTotalCount,
  getUniqueValues,
} from '@/lib/db/promo-queries';

/**
 * GET /api/promos/stats?type=category|season|top_promos|top_products|filters|count
 * Get aggregated statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'count';
    const limit = parseInt(searchParams.get('limit') || '10');

    switch (type) {
      case 'category':
        const categoryStats = await getPromoStatsByCategory();
        return NextResponse.json({ stats: categoryStats });

      case 'season':
        const seasonStats = await getPromoStatsBySeason();
        return NextResponse.json({ stats: seasonStats });

      case 'top_promos':
        const topPromos = await getTopPerformingPromos(limit);
        return NextResponse.json({ promos: topPromos });

      case 'top_products':
        const topProducts = await getTopSellingProducts(limit);
        return NextResponse.json({ products: topProducts });

      case 'filters':
        const [seasons, categories, channels, promoTypes] = await Promise.all([
          getUniqueValues('seasonLabel'),
          getUniqueValues('category'),
          getUniqueValues('channel'),
          getUniqueValues('promoType'),
        ]);

        return NextResponse.json({
          seasons,
          categories,
          channels,
          promoTypes,
        });

      case 'count':
        const count = await getTotalCount();
        return NextResponse.json({ count });

      default:
        return NextResponse.json(
          { error: 'Invalid stats type' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error getting promo stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
