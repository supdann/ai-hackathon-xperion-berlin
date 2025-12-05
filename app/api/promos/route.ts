import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promo } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getPromos } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Fetch single promo by ID
      const [promoData] = await db
        .select()
        .from(promo)
        .where(eq(promo.id, id))
        .limit(1);

      if (!promoData) {
        return NextResponse.json(
          { error: "Promo not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ promo: promoData }, { status: 200 });
    }

    // Fetch all promos
    const promos = await getPromos();
    return NextResponse.json({ promos }, { status: 200 });
  } catch (error) {
    console.error("Error fetching promos:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch promos",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "promoId",
      "productId",
      "promoName",
      "productName",
      "category",
      "seasonLabel",
      "channel",
      "basePrice",
      "discountPercent",
      "promoType",
      "baseMarginPercent",
      "totalUnitsSold",
    ];

    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Check if promo already exists
    const existing = await db
      .select()
      .from(promo)
      .where(
        and(
          eq(promo.promoId, body.promoId),
          eq(promo.productId, body.productId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This promo is already saved", existing: existing[0] },
        { status: 409 }
      );
    }

    // Insert the promo
    const [savedPromo] = await db
      .insert(promo)
      .values({
        promoId: body.promoId,
        productId: body.productId,
        promoName: body.promoName,
        productName: body.productName,
        brand: body.brand || null,
        category: body.category,
        seasonLabel: body.seasonLabel,
        channel: body.channel,
        basePrice: body.basePrice,
        discountPercent: body.discountPercent,
        promoType: body.promoType,
        baseMarginPercent: body.baseMarginPercent,
        totalUnitsSold: body.totalUnitsSold,
        unitsLiftPercent: body.unitsLiftPercent || null,
        revenueLiftPercent: body.revenueLiftPercent || null,
        marginImpactEuros: body.marginImpactEuros || null,
        profitImpactEuros: body.profitImpactEuros || null,
      })
      .returning();

    return NextResponse.json({ success: true, promo: savedPromo }, { status: 201 });
  } catch (error) {
    console.error("Error saving promo:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save promo",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(promo)
      .where(eq(promo.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Promo not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: deleted[0] }, { status: 200 });
  } catch (error) {
    console.error("Error deleting promo:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete promo",
      },
      { status: 500 }
    );
  }
}
