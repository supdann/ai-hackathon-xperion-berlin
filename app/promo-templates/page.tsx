"use client";

interface PromoTemplate {
  id: string;
  width: number;
  height: number;
  orientation: "portrait" | "landscape" | "square";
  title: string;
  price: number;
  discount: number | null; // 0-100
  priceFontSize: number;
  pricePosition: {
    x: "left" | "center" | "right";
    y: "top" | "center" | "bottom";
    offsetX?: number;
    offsetY?: number;
  };
}

const templates: PromoTemplate[] = [
  {
    id: "portrait_570x1800_vertical_banner",
    width: 570,
    height: 1800,
    orientation: "portrait",
    title: "Vertical Banner",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 10, offsetY: 10 },
  },
  {
    id: "landscape_1920x1080_wide_banner",
    width: 1920,
    height: 1080,
    orientation: "landscape",
    title: "Wide Banner",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 20, offsetY: 20 },
  },
  {
    id: "square_1080x1080_social_media",
    width: 1080,
    height: 1080,
    orientation: "square",
    title: "Social Media",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
  },
  {
    id: "portrait_1080x1350_story_format",
    width: 1080,
    height: 1350,
    orientation: "portrait",
    title: "Story Format",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
  },
  {
    id: "landscape_1200x628_facebook_cover",
    width: 1200,
    height: 628,
    orientation: "landscape",
    title: "Facebook Cover",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 12, offsetY: 12 },
  },
  {
    id: "portrait_800x1200_poster",
    width: 800,
    height: 1200,
    orientation: "portrait",
    title: "Poster",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
  },
  {
    id: "landscape_1600x900_presentation",
    width: 1600,
    height: 900,
    orientation: "landscape",
    title: "Presentation",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 25, offsetY: 25 },
  },
  {
    id: "square_1200x1200_instagram_post",
    width: 1200,
    height: 1200,
    orientation: "square",
    title: "Instagram Post",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
  },
  {
    id: "portrait_600x900_flyer",
    width: 600,
    height: 900,
    orientation: "portrait",
    title: "Flyer",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 15, offsetY: 15 },
  },
  {
    id: "landscape_2560x1440_desktop_wallpaper",
    width: 2560,
    height: 1440,
    orientation: "landscape",
    title: "Desktop Wallpaper",
    price: 399,
    discount: 27,
    priceFontSize: 300,
    pricePosition: { x: "right", y: "bottom", offsetX: 20, offsetY: 20 },
  },
];

export default function PromoTemplatesPage() {
  const getAspectRatio = (width: number, height: number) => {
    return width / height;
  };

  const getPreviewSize = (template: PromoTemplate) => {
    const aspectRatio = getAspectRatio(template.width, template.height);
    const maxWidth = 300;
    const maxHeight = 400;

    if (aspectRatio > 1) {
      // Landscape
      return {
        width: Math.min(maxWidth, maxHeight * aspectRatio),
        height: Math.min(maxHeight, maxWidth / aspectRatio),
      };
    }
    if (aspectRatio < 1) {
      // Portrait
      return {
        width: Math.min(maxWidth, maxHeight * aspectRatio),
        height: Math.min(maxHeight, maxWidth / aspectRatio),
      };
    }
    // Square
    return {
      width: Math.min(maxWidth, maxHeight),
      height: Math.min(maxWidth, maxHeight),
    };
  };

  const getPriceStyle = (
    template: PromoTemplate,
    previewSize: { width: number; height: number }
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
    };

    // Horizontal positioning
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
      // center
      position.left = "50%";
      position.right = "auto";
      position.transform = "translateX(-50%)";
    }

    // Vertical positioning
    if (template.pricePosition.y === "top") {
      position.top = template.pricePosition.offsetY
        ? `${template.pricePosition.offsetY * scale}px`
        : "0px";
      position.bottom = "auto";
      // Clear transform if not centering
      if (template.pricePosition.x !== "center") {
        position.transform = "none";
      }
    } else if (template.pricePosition.y === "bottom") {
      position.bottom = template.pricePosition.offsetY
        ? `${template.pricePosition.offsetY * scale}px`
        : "0px";
      position.top = "auto";
      // Clear transform if not centering
      if (template.pricePosition.x !== "center") {
        position.transform = "none";
      }
    } else {
      // center
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

  const getDiscountStyle = (
    template: PromoTemplate,
    previewSize: { width: number; height: number }
  ) => {
    const scale = Math.min(
      previewSize.width / template.width,
      previewSize.height / template.height
    );
    const priceStyle = getPriceStyle(template, previewSize);
    
    const discountFontSize = Math.max(12, template.priceFontSize * scale * 0.2);
    const priceFontSize = template.priceFontSize * scale;
    
    // Estimate line height (typically 1.2-1.5x font size)
    const discountLineHeight = discountFontSize * 1.2;
    const priceLineHeight = priceFontSize * 1.2;
    
    // Position discount above the price
    const discountStyle: React.CSSProperties = {
      position: "absolute",
      fontSize: `${discountFontSize}px`,
      lineHeight: `${discountLineHeight}px`,
      textAlign: template.pricePosition.x === "right" ? "right" : template.pricePosition.x === "left" ? "left" : "center",
      fontFamily: "var(--font-media-preise)",
      backgroundColor: "black",
      color: "yellow",
      paddingLeft: "8px",
      paddingRight: "8px",
      paddingTop: "4px",
      paddingBottom: "4px",
      borderRadius: "4px",
      zIndex: 10, // Ensure discount appears above price
    };

    // Match horizontal position with price
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

    // Position above the price with proper spacing accounting for line heights
    if (template.pricePosition.y === "bottom") {
      const priceOffset = template.pricePosition.offsetY ? template.pricePosition.offsetY * scale : 0;
      // Position discount above price: price bottom + price line height + spacing + discount line height
      // Add discount line height to account for the discount background height, plus extra spacing
      const totalSpacing = priceLineHeight + discountLineHeight + 16; // 16px gap between elements
      discountStyle.bottom = `${priceOffset + totalSpacing}px`;
      discountStyle.top = "auto";
    } else if (template.pricePosition.y === "top") {
      const priceOffset = template.pricePosition.offsetY ? template.pricePosition.offsetY * scale : 0;
      // Position discount above price
      const totalSpacing = priceLineHeight + discountLineHeight + 16; // 16px gap between elements
      discountStyle.top = `${Math.max(0, priceOffset - totalSpacing)}px`;
      discountStyle.bottom = "auto";
    } else {
      // center - position above
      discountStyle.top = "50%";
      discountStyle.bottom = "auto";
      const totalSpacing = (priceLineHeight / 2) + (discountLineHeight / 2) + 16; // 16px gap
      if (template.pricePosition.x === "center") {
        discountStyle.transform = `translate(-50%, calc(-50% - ${totalSpacing}px))`;
      } else {
        discountStyle.transform = `translateY(calc(-50% - ${totalSpacing}px))`;
      }
    }

    return discountStyle;
  };

  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="mx-auto mb-8 w-full max-w-7xl text-center">
        <h1 className="mb-4 font-bold text-4xl">Promo Templates</h1>
        <p className="text-muted-foreground text-lg">
          Choose from a variety of promotional content templates with predefined
          dimensions.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates.map((template) => {
          const previewSize = getPreviewSize(template);

          return (
            <div
              key={template.id}
              className="group flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-lg"
            >
              <div className="mb-3 flex items-center justify-center overflow-hidden rounded-lg border bg-muted">
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    width: `${previewSize.width}px`,
                    height: `${previewSize.height}px`,
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="text-muted-foreground text-4xl">📐</div>
                    <div className="text-muted-foreground text-xs">
                      {template.width} × {template.height}
                    </div>
                    <div className="text-muted-foreground text-xs capitalize">
                      {template.orientation}
                    </div>
                  </div>
                  {typeof template.discount === "number" && template.discount > 0 && (
                    <div
                      className="font-bold"
                      style={getDiscountStyle(template, previewSize)}
                    >
                      -{template.discount}%
                    </div>
                  )}
                  <div
                    className="font-bold"
                    style={{
                      ...getPriceStyle(template, previewSize),
                      fontFamily: "var(--font-media-preise)",
                      textShadow:
                        "-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, 0 -1px 0 white, 0 1px 0 white, -1px 0 0 white, 1px 0 0 white",
                    }}
                  >
                    {template.price}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col">
                <h3 className="mb-2 font-semibold text-lg">{template.title}</h3>
                <p className="mb-2 text-muted-foreground text-sm">
                  {template.id}
                </p>
                <div className="mt-auto flex flex-col gap-1 text-muted-foreground text-xs">
                  <div className="flex justify-between">
                    <span>Dimensions:</span>
                    <span className="font-mono">
                      {template.width} × {template.height}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Orientation:</span>
                    <span className="capitalize">{template.orientation}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

