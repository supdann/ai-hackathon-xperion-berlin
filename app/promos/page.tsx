"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Promo } from "@/lib/db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TrashIcon } from "@/components/icons";

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<Promo | null>(null);

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/promos");
        if (!response.ok) {
          throw new Error("Failed to fetch promos");
        }
        const data = await response.json();
        setPromos(data.promos || []);
      } catch (err) {
        console.error("Error fetching promos:", err);
        setError(err instanceof Error ? err.message : "Failed to load promos");
      } finally {
        setLoading(false);
      }
    };

    fetchPromos();
  }, []);

  const handleDeleteClick = (promo: Promo) => {
    setPromoToDelete(promo);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!promoToDelete) return;

    try {
      const response = await fetch(`/api/promos?id=${promoToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete promo");
      }

      // Remove the deleted promo from the list
      setPromos((prev) => prev.filter((p) => p.id !== promoToDelete.id));
      toast.success("Promo deleted successfully");
      setDeleteDialogOpen(false);
      setPromoToDelete(null);
    } catch (err) {
      console.error("Error deleting promo:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete promo"
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="mx-auto mb-8 w-full max-w-7xl">
        <h1 className="mb-4 font-bold text-4xl">Promos</h1>
        <p className="text-muted-foreground text-lg">
          Browse and manage promotional campaigns and their performance metrics.
        </p>
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {loading ? "Loading..." : `Showing ${promos.length} promos`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button">
              Filter
            </Button>
            <Button variant="outline" type="button">
              Sort
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading promos...</p>
          </div>
        ) : promos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No promos found. Save some promos from the chat to see them here.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promos.map((promo) => (
            <div
              key={promo.id}
              className="group flex flex-col rounded-lg border bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-lg">{promo.promoName}</h3>
                  <p className="text-muted-foreground text-sm">{promo.productName}</p>
                  {promo.brand && (
                    <p className="text-muted-foreground text-xs">{promo.brand}</p>
                  )}
                </div>
                <div className="ml-4 rounded bg-red-600 px-2 py-1 text-white text-xs font-bold">
                  -{promo.discountPercent}%
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
                  {promo.category}
                </span>
                <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
                  {promo.channel}
                </span>
                <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
                  {promo.seasonLabel}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 text-muted-foreground text-xs">
                <div>
                  <span className="font-medium">Base Price:</span> €{promo.basePrice.toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">Units Sold:</span> {promo.totalUnitsSold.toLocaleString()}
                </div>
                {promo.unitsLiftPercent && (
                  <div>
                    <span className="font-medium">Units Lift:</span> +{promo.unitsLiftPercent.toFixed(1)}%
                  </div>
                )}
                {promo.revenueLiftPercent && (
                  <div>
                    <span className="font-medium">Revenue Lift:</span> +{promo.revenueLiftPercent.toFixed(1)}%
                  </div>
                )}
                {promo.marginImpactEuros && (
                  <div>
                    <span className="font-medium">Margin Impact:</span> €{promo.marginImpactEuros.toFixed(2)}
                  </div>
                )}
                {promo.profitImpactEuros && (
                  <div>
                    <span className="font-medium">Profit Impact:</span> €{promo.profitImpactEuros.toFixed(2)}
                  </div>
                )}
              </div>

              <div className="mt-auto flex gap-2 pt-4">
                <Button
                  className="flex-1 bg-red-600 font-bold text-white hover:bg-red-700 hover:text-white"
                  type="button"
                  variant="default"
                >
                  View Details
                </Button>
                <Button
                  className="bg-red-600 font-bold text-white hover:bg-red-700 hover:text-white"
                  onClick={() => handleDeleteClick(promo)}
                  type="button"
                  variant="default"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              promo "{promoToDelete?.promoName}" and remove it from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

