import { tool } from "ai";
import { z } from "zod";

export const getForecast = tool({
  description:
    "Get a forecast for a product. This displays a visual forecast widget with an image showing product predictions and trends.",
  inputSchema: z.object({
    product: z
      .string()
      .describe("The product name or identifier to get a forecast for")
      .min(1, "Product name cannot be empty"),
  }),
  execute: async (input) => {
    // For now, return a placeholder structure
    // This will be extended later with actual forecast data
    return {
      product: input.product,
      imageUrl: "/images/demo-thumbnail.png", // Placeholder image
      forecast: {
        message: "Forecast data will be available soon",
        placeholder: true,
      },
    };
  },
});

