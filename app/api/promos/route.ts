import { NextRequest, NextResponse } from 'next/server';
import {
  getPromoProductsByFilters,
  getTotalCount,
  getUniqueValues,
  type PromoProductFilters,
  type PaginationOptions,
} from '@/lib/db/promo-queries';

/**
 * GET /api/promos
 * Query promo products with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Build filters
    const filters: PromoProductFilters = {};

    if (searchParams.get('seasonLabel')) {
      filters.seasonLabel = searchParams.get('seasonLabel')!;
    }

    if (searchParams.get('category')) {
      filters.category = searchParams.get('category')!;
    }

    if (searchParams.get('channel')) {
      filters.channel = searchParams.get('channel')!;
    }

    if (searchParams.get('promoType')) {
      filters.promoType = searchParams.get('promoType')!;
    }

    if (searchParams.get('productId')) {
      filters.productId = searchParams.get('productId')!;
    }

    if (searchParams.get('promoId')) {
      filters.promoId = searchParams.get('promoId')!;
    }

    if (searchParams.get('minPrice')) {
      filters.minPrice = parseFloat(searchParams.get('minPrice')!);
    }

    if (searchParams.get('maxPrice')) {
      filters.maxPrice = parseFloat(searchParams.get('maxPrice')!);
    }

    if (searchParams.get('minMargin')) {
      filters.minMargin = parseFloat(searchParams.get('minMargin')!);
    }

    if (searchParams.get('search')) {
      filters.search = searchParams.get('search')!;
    }

    // Build pagination
    const pagination: PaginationOptions = {
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      orderBy: (searchParams.get('orderBy') as any) || 'margin',
      order: (searchParams.get('order') as any) || 'desc',
    };

    const results = await getPromoProductsByFilters(filters, pagination);
    const totalCount = await getTotalCount();

    return NextResponse.json({
      data: results,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total: totalCount,
        hasMore: (pagination.offset || 0) + results.length < totalCount,
      },
    });

  } catch (error) {
    console.error('Error querying promos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
