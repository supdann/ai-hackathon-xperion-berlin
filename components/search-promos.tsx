"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Promo } from "@/lib/db/schema";

type SearchPromosData = {
  reasoning?: string;
  products: Array<{
    promo_id: string;
    product_id: string;
    promo_name: string;
    product_name: string;
    brand: string | null;
    category: string;
    season_label: string;
    channel: string;
    base_price: number;
    discount_percent: number;
    promo_type: string;
    base_margin_percent: number;
    total_units_sold: number;
    units_lift_percent: number | null;
    revenue_lift_percent: number | null;
    margin_impact_euros: number | null;
    profit_impact_euros: number | null;
    similarity: number;
  }>;
};

export function SearchPromos({
  searchPromosData,
}: {
  searchPromosData?: SearchPromosData;
}) {
  const [savingPromos, setSavingPromos] = useState<Set<string>>(new Set());
  const [savedPromos, setSavedPromos] = useState<Set<string>>(new Set());

  if (!searchPromosData) {
    return (
      <div className="rounded-lg border bg-muted p-4">
        <p className="text-muted-foreground text-sm">No search results available</p>
      </div>
    );
  }

  const handleSavePromo = async (product: SearchPromosData["products"][0]) => {
    const saveKey = `${product.promo_id}-${product.product_id}`;
    
    if (savedPromos.has(saveKey)) {
      toast.info("This promo is already saved");
      return;
    }

    setSavingPromos((prev) => new Set(prev).add(saveKey));

    try {
      const response = await fetch("/api/promos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promoId: product.promo_id,
          productId: product.product_id,
          promoName: product.promo_name,
          productName: product.product_name,
          brand: product.brand,
          category: product.category,
          seasonLabel: product.season_label,
          channel: product.channel,
          basePrice: product.base_price,
          discountPercent: product.discount_percent,
          promoType: product.promo_type,
          baseMarginPercent: product.base_margin_percent,
          totalUnitsSold: product.total_units_sold,
          unitsLiftPercent: product.units_lift_percent,
          revenueLiftPercent: product.revenue_lift_percent,
          marginImpactEuros: product.margin_impact_euros,
          profitImpactEuros: product.profit_impact_euros,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save promo");
      }

      setSavedPromos((prev) => new Set(prev).add(saveKey));
      toast.success("Promo saved successfully");
    } catch (error) {
      console.error("Error saving promo:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save promo"
      );
    } finally {
      setSavingPromos((prev) => {
        const next = new Set(prev);
        next.delete(saveKey);
        return next;
      });
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      {searchPromosData.reasoning && (
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">{searchPromosData.reasoning}</p>
        </div>
      )}

      {searchPromosData.products.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products found</p>
      ) : (
        <div className="space-y-4">
          {searchPromosData.products.map((product, index) => {
            const key = `${product.promo_id}-${product.product_id}-${index}`;
            const saveKey = `${product.promo_id}-${product.product_id}`;
            const isSaving = savingPromos.has(saveKey);
            const isSaved = savedPromos.has(saveKey);

            return (
              <div
                key={key}
                className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-lg">{product.promo_name}</h3>
                    <p className="text-muted-foreground text-sm">{product.product_name}</p>
                    {product.brand && (
                      <p className="text-muted-foreground text-xs">{product.brand}</p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <div className="rounded bg-red-600 px-2 py-1 text-white text-xs font-bold">
                      -{product.discount_percent}%
                    </div>
                    {product.similarity && (
                      <div className="text-muted-foreground text-xs">
                        {(product.similarity * 100).toFixed(1)}% match
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 text-xs">
                    {product.category}
                  </span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 text-xs">
                    {product.channel}
                  </span>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-800 text-xs">
                    {product.season_label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-muted-foreground text-xs">
                  <div>
                    <span className="font-medium">Base Price:</span> €{product.base_price.toFixed(2)}
                  </div>
                  <div>
                    <span className="font-medium">Units Sold:</span> {product.total_units_sold.toLocaleString()}
                  </div>
                  {product.units_lift_percent && (
                    <div>
                      <span className="font-medium">Units Lift:</span> +{product.units_lift_percent.toFixed(1)}%
                    </div>
                  )}
                  {product.revenue_lift_percent && (
                    <div>
                      <span className="font-medium">Revenue Lift:</span> +{product.revenue_lift_percent.toFixed(1)}%
                    </div>
                  )}
                  {product.margin_impact_euros && (
                    <div>
                      <span className="font-medium">Margin Impact:</span> €{product.margin_impact_euros.toFixed(2)}
                    </div>
                  )}
                  {product.profit_impact_euros && (
                    <div>
                      <span className="font-medium">Profit Impact:</span> €{product.profit_impact_euros.toFixed(2)}
                    </div>
                  )}
                </div>

                <Button
                  className="w-full bg-red-600 font-bold text-white hover:bg-red-700 hover:text-white"
                  disabled={isSaving || isSaved}
                  onClick={() => handleSavePromo(product)}
                  type="button"
                >
                  {isSaving ? "Saving..." : isSaved ? "Saved ✓" : "Save Promo"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

