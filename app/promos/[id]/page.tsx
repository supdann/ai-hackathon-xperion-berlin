"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Promo } from "@/lib/db/schema";
import Link from "next/link";

interface PromoTemplate {
  id: string;
  width: number;
  height: number;
  orientation: "portrait" | "landscape" | "square";
  title: string;
  price: number;
  discount: number | null;
  priceFontSize: number;
  pricePosition: {
    x: "left" | "center" | "right";
    y: "top" | "center" | "bottom";
    offsetX?: number;
    offsetY?: number;
  };
  message: string;
  messagePosition: {
    x: "left" | "center" | "right";
    y: "top" | "center" | "bottom";
    offsetX?: number;
    offsetY?: number;
  };
  messageFontSize: number;
}

// All templates for recommended content
const recommendedTemplates: PromoTemplate[] = [
  {
    id: "portrait_570x1800_vertical_banner",
    width: 570,
    height: 1800,
    orientation: "portrait",
    title: "Vertical Banner",
    price: 0, // Will be set from promo
    discount: null, // Will be set from promo
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 10, offsetY: 10 },
    message: "Limited Time Offer!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 20 },
    messageFontSize: 150,
  },
  {
    id: "square_1080x1080_social_media",
    width: 1080,
    height: 1080,
    orientation: "square",
    title: "Social Media",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
    message: "Special Deal!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 25 },
    messageFontSize: 180,
  },
  {
    id: "portrait_1080x1350_story_format",
    width: 1080,
    height: 1350,
    orientation: "portrait",
    title: "Story Format",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
    message: "Act Now!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 30 },
    messageFontSize: 170,
  },
  {
    id: "portrait_800x1200_poster",
    width: 800,
    height: 1200,
    orientation: "portrait",
    title: "Poster",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
    message: "Exclusive Offer!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 25 },
    messageFontSize: 160,
  },
  {
    id: "landscape_1600x900_presentation",
    width: 1600,
    height: 900,
    orientation: "landscape",
    title: "Presentation",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 25, offsetY: 25 },
    message: "Unbeatable Prices!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 40 },
    messageFontSize: 190,
  },
  {
    id: "square_1200x1200_instagram_post",
    width: 1200,
    height: 1200,
    orientation: "square",
    title: "Instagram Post",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
    message: "Shop Now!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 30 },
    messageFontSize: 170,
  },
  {
    id: "portrait_600x900_flyer",
    width: 600,
    height: 900,
    orientation: "portrait",
    title: "Flyer",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
    message: "Save Big Today!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 20 },
    messageFontSize: 140,
  },
  {
    id: "landscape_2560x1440_desktop_wallpaper",
    width: 2560,
    height: 1440,
    orientation: "landscape",
    title: "Desktop Wallpaper",
    price: 0,
    discount: null,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 20, offsetY: 20 },
    message: "Amazing Deals Await!",
    messagePosition: { x: "center", y: "top", offsetX: 0, offsetY: 50 },
    messageFontSize: 220,
  },
];

function PromoDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [promo, setPromo] = useState<Promo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPromo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/promos?id=${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Promo not found");
          }
          throw new Error("Failed to fetch promo");
        }
        const data = await response.json();
        setPromo(data.promo);
      } catch (err) {
        console.error("Error fetching promo:", err);
        setError(err instanceof Error ? err.message : "Failed to load promo");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPromo();
    }
  }, [id]);

  const getAspectRatio = (width: number, height: number) => {
    return width / height;
  };

  const getPreviewSize = (template: PromoTemplate) => {
    const aspectRatio = getAspectRatio(template.width, template.height);
    const maxWidth = 200;
    const maxHeight = 300;

    if (aspectRatio > 1) {
      return {
        width: Math.min(maxWidth, maxHeight * aspectRatio),
        height: Math.min(maxHeight, maxWidth / aspectRatio),
      };
    }
    if (aspectRatio < 1) {
      return {
        width: Math.min(maxWidth, maxHeight * aspectRatio),
        height: Math.min(maxHeight, maxWidth / aspectRatio),
      };
    }
    return {
      width: Math.min(maxWidth, maxHeight),
      height: Math.min(maxWidth, maxHeight),
    };
  };

  const getPriceStyle = (
    template: PromoTemplate,
    previewSize: { width: number; height: number },
    promoPrice: number
  ) => {
    const scale = Math.min(
      previewSize.width / template.width,
      previewSize.height / template.height
    );
    const scaledFontSize = template.priceFontSize * scale;

    const position: React.CSSProperties = {
      position: "absolute",
      fontSize: `${scaledFontSize}px`,
      textAlign: template.pricePosition.x === "right" ? "right" : template.pricePosition.x === "left" ? "left" : "center",
      fontFamily: "var(--font-media-preise)",
      textShadow:
        "-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, 0 -1px 0 white, 0 1px 0 white, -1px 0 0 white, 1px 0 0 white",
    };

    if (template.pricePosition.x === "left") {
      position.left = template.pricePosition.offsetX
        ? `${template.pricePosition.offsetX * scale}px`
        : "0px";
      position.right = "auto";
    } else if (template.pricePosition.x === "right") {
      position.right = template.pricePosition.offsetX
        ? `${template.pricePosition.offsetX * scale}px`
        : "0px";
      position.left = "auto";
    } else {
      position.left = "50%";
      position.transform = "translateX(-50%)";
    }

    if (template.pricePosition.y === "top") {
      position.top = template.pricePosition.offsetY
        ? `${template.pricePosition.offsetY * scale}px`
        : "0px";
      position.bottom = "auto";
      if (template.pricePosition.x !== "center") {
        position.transform = "none";
      }
    } else if (template.pricePosition.y === "bottom") {
      position.bottom = template.pricePosition.offsetY
        ? `${template.pricePosition.offsetY * scale}px`
        : "0px";
      position.top = "auto";
      if (template.pricePosition.x !== "center") {
        position.transform = "none";
      }
    } else {
      position.top = "50%";
      position.bottom = "auto";
      if (template.pricePosition.x === "center") {
        position.transform = "translate(-50%, -50%)";
      } else {
        position.transform = "translateY(-50%)";
      }
    }

    return position;
  };

  const getMessageStyle = (
    template: PromoTemplate,
    previewSize: { width: number; height: number }
  ) => {
    const scale = Math.min(
      previewSize.width / template.width,
      previewSize.height / template.height
    );
    const scaledFontSize = template.messageFontSize * scale;

    const position: React.CSSProperties = {
      position: "absolute",
      fontSize: `${scaledFontSize}px`,
      textAlign: template.messagePosition.x === "right" ? "right" : template.messagePosition.x === "left" ? "left" : "center",
      fontFamily: "var(--font-mm-headline)",
      fontWeight: "900",
      color: "white",
      textShadow: "3px 3px 6px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px 1px 2px rgba(0, 0, 0, 0.8)",
      zIndex: 5,
      letterSpacing: "0.05em",
      lineHeight: "1.1",
    };

    if (template.messagePosition.x === "left") {
      position.left = template.messagePosition.offsetX
        ? `${template.messagePosition.offsetX * scale}px`
        : "0px";
      position.right = "auto";
    } else if (template.messagePosition.x === "right") {
      position.right = template.messagePosition.offsetX
        ? `${template.messagePosition.offsetX * scale}px`
        : "0px";
      position.left = "auto";
    } else {
      position.left = "50%";
      position.transform = "translateX(-50%)";
    }

    if (template.messagePosition.y === "top") {
      position.top = template.messagePosition.offsetY
        ? `${template.messagePosition.offsetY * scale}px`
        : "0px";
      position.bottom = "auto";
      if (template.messagePosition.x !== "center") {
        position.transform = "none";
      }
    } else if (template.messagePosition.y === "bottom") {
      position.bottom = template.messagePosition.offsetY
        ? `${template.messagePosition.offsetY * scale}px`
        : "0px";
      position.top = "auto";
      if (template.messagePosition.x !== "center") {
        position.transform = "none";
      }
    } else {
      position.top = "50%";
      position.bottom = "auto";
      if (template.messagePosition.x === "center") {
        position.transform = "translate(-50%, -50%)";
      } else {
        position.transform = "translateY(-50%)";
      }
    }

    return position;
  };

  const getDiscountStyle = (
    template: PromoTemplate,
    previewSize: { width: number; height: number },
    discountPercent: number
  ) => {
    const scale = Math.min(
      previewSize.width / template.width,
      previewSize.height / template.height
    );
    const priceStyle = getPriceStyle(template, previewSize, 0);
    const discountFontSize = Math.max(12, template.priceFontSize * scale * 0.2);
    const priceFontSize = template.priceFontSize * scale;
    const discountLineHeight = discountFontSize * 1.2;
    const priceLineHeight = priceFontSize * 1.2;

    const discountStyle: React.CSSProperties = {
      position: "absolute",
      fontSize: `${discountFontSize}px`,
      lineHeight: `${discountLineHeight}px`,
      textAlign: template.pricePosition.x === "right" ? "right" : template.pricePosition.x === "left" ? "left" : "center",
      backgroundColor: "black",
      color: "yellow",
      paddingLeft: "8px",
      paddingRight: "8px",
      paddingTop: "4px",
      paddingBottom: "4px",
      borderRadius: "4px",
      zIndex: 10,
      fontFamily: "var(--font-media-preise)",
    };

    if (template.pricePosition.x === "left") {
      discountStyle.left = priceStyle.left;
      discountStyle.right = "auto";
    } else if (template.pricePosition.x === "right") {
      discountStyle.right = priceStyle.right;
      discountStyle.left = "auto";
    } else {
      discountStyle.left = "50%";
      discountStyle.right = "auto";
      discountStyle.transform = "translateX(-50%)";
    }

    if (template.pricePosition.y === "bottom") {
      const priceOffset = template.pricePosition.offsetY ? template.pricePosition.offsetY * scale : 0;
      const totalSpacing = priceLineHeight + discountLineHeight + 16;
      discountStyle.bottom = `${priceOffset + totalSpacing}px`;
      discountStyle.top = "auto";
    } else if (template.pricePosition.y === "top") {
      const priceOffset = template.pricePosition.offsetY ? template.pricePosition.offsetY * scale : 0;
      const totalSpacing = priceLineHeight + discountLineHeight + 16;
      discountStyle.top = `${Math.max(0, priceOffset - totalSpacing)}px`;
      discountStyle.bottom = "auto";
    } else {
      discountStyle.top = "50%";
      discountStyle.bottom = "auto";
      const totalSpacing = (priceLineHeight / 2) + (discountLineHeight / 2) + 16;
      if (template.pricePosition.x === "center") {
        discountStyle.transform = `translate(-50%, calc(-50% - ${totalSpacing}px))`;
      } else {
        discountStyle.transform = `translateY(calc(-50% - ${totalSpacing}px))`;
      }
    }

    return discountStyle;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading promo details...</p>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="mb-4 font-bold text-4xl">Promo Not Found</h1>
        <p className="mb-4 text-muted-foreground text-lg">
          {error || "The promo you're looking for doesn't exist."}
        </p>
        <Link href="/promos">
          <Button variant="default">Back to Promos</Button>
        </Link>
      </div>
    );
  }

  const templatesWithPromoPrice = recommendedTemplates.map((template) => ({
    ...template,
    price: promo.basePrice,
    discount: promo.discountPercent,
  }));

  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="mx-auto mb-8 w-full max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Link href="/promos">
              <Button variant="ghost" type="button">← Back to Promos</Button>
            </Link>
          </div>
        </div>
        <h1 className="mb-4 font-bold text-4xl">{promo.promoName}</h1>
        <p className="text-muted-foreground text-lg">{promo.productName}</p>
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Promo Details */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold text-xl">Promo Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promo ID:</span>
                <span className="font-mono">{promo.promoId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product ID:</span>
                <span className="font-mono">{promo.productId}</span>
              </div>
              {promo.brand && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brand:</span>
                  <span>{promo.brand}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span>{promo.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Season:</span>
                <span>{promo.seasonLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel:</span>
                <span>{promo.channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promo Type:</span>
                <span>{promo.promoType}</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold text-xl">Performance Metrics</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price:</span>
                <span className="font-mono font-semibold">€{promo.basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-semibold text-red-600">-{promo.discountPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Margin:</span>
                <span className="font-mono">{promo.baseMarginPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Units Sold:</span>
                <span className="font-mono">{promo.totalUnitsSold.toLocaleString()}</span>
              </div>
              {promo.unitsLiftPercent && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Units Lift:</span>
                  <span className="font-mono text-green-600">+{promo.unitsLiftPercent.toFixed(1)}%</span>
                </div>
              )}
              {promo.revenueLiftPercent && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue Lift:</span>
                  <span className="font-mono text-green-600">+{promo.revenueLiftPercent.toFixed(1)}%</span>
                </div>
              )}
              {promo.marginImpactEuros && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin Impact:</span>
                  <span className="font-mono">€{promo.marginImpactEuros.toFixed(2)}</span>
                </div>
              )}
              {promo.profitImpactEuros && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit Impact:</span>
                  <span className="font-mono">€{promo.profitImpactEuros.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recommended Promotional Content */}
        <div className="mt-8">
          <h2 className="mb-6 font-semibold text-2xl">Recommended Promotional Content</h2>
          <p className="mb-4 text-muted-foreground">
            Sample promotional templates using the base price of €{promo.basePrice.toFixed(2)} with {promo.discountPercent}% discount
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {templatesWithPromoPrice.map((template) => {
              const previewSize = getPreviewSize(template);

              return (
                <div
                  key={template.id}
                  className="group flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-lg"
                >
                  <div className="mb-3 flex items-center justify-center overflow-hidden rounded-lg border bg-red-600">
                    <div
                      className="relative flex items-center justify-center"
                      style={{
                        width: `${previewSize.width}px`,
                        height: `${previewSize.height}px`,
                      }}
                    >
                      <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className="text-white text-xs">
                          {template.width} × {template.height}
                        </div>
                        <div className="text-white text-xs capitalize">
                          {template.orientation}
                        </div>
                      </div>
                      {template.message && (
                        <div
                          className="font-bold"
                          style={getMessageStyle(template, previewSize)}
                        >
                          {template.message}
                        </div>
                      )}
                      {template.discount && template.discount > 0 && (
                        <div
                          className="font-bold"
                          style={getDiscountStyle(template, previewSize, template.discount)}
                        >
                          -{template.discount}%
                        </div>
                      )}
                      <div
                        className="font-bold"
                        style={getPriceStyle(template, previewSize, template.price)}
                      >
                        {template.price.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col">
                    <h3 className="mb-2 font-semibold text-lg">{template.title}</h3>
                    <p className="mb-2 text-muted-foreground text-sm">{template.id}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromoDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading promo details...</p>
        </div>
      }
    >
      <PromoDetailsContent />
    </Suspense>
  );
}

