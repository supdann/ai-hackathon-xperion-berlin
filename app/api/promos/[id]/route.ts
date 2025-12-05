import { NextRequest, NextResponse } from 'next/server';
import {
  getPromoProductById,
  updatePromoProduct,
  deletePromoProduct,
} from '@/lib/db/promo-queries';

/**
 * GET /api/promos/[id]
 * Get a single promo product by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const promoProduct = await getPromoProductById(id);

    if (!promoProduct) {
      return NextResponse.json(
        { error: 'Promo product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(promoProduct);

  } catch (error) {
    console.error('Error getting promo product:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/promos/[id]
 * Update a promo product
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const updatedPromoProduct = await updatePromoProduct(id, body);

    if (!updatedPromoProduct) {
      return NextResponse.json(
        { error: 'Promo product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedPromoProduct);

  } catch (error) {
    console.error('Error updating promo product:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/promos/[id]
 * Delete a promo product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    await deletePromoProduct(id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting promo product:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
