import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';
import {
  searchPromoProductsBySimilarity,
  type PromoProductFilters,
} from '@/lib/db/promo-queries';

/**
 * POST /api/promos/search
 * Semantic search for promo products using vector similarity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, filters, minSimilarity = 0.7 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query string is required' },
        { status: 400 }
      );
    }

    // Generate embedding for the query
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = createOpenAI({ apiKey });
    const model = openai.embedding('text-embedding-3-small');

    const { embedding } = await embed({
      model,
      value: query,
    });

    // Build filters
    const searchFilters: PromoProductFilters = filters || {};

    // Search using vector similarity
    const results = await searchPromoProductsBySimilarity({
      query,
      embedding,
      limit,
      filters: searchFilters,
      minSimilarity,
    });

    return NextResponse.json({
      query,
      results,
      count: results.length,
    });

  } catch (error) {
    console.error('Error searching promos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
