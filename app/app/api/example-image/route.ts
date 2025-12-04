import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exampleId = searchParams.get("id");

  if (!exampleId) {
    return NextResponse.json({ error: "Example ID is required" }, { status: 400 });
  }

  try {
    // Map example IDs to image paths
    const imageMap: Record<string, string> = {
      "1": "MMS_Logo2024_Outline_sRGB.png",
      "2": "MMS_Logo2024_stacked_Outline_sRGB.png",
      "3": "MMS_Logo2024_sRGB.png",
    };

    const imageName = imageMap[exampleId];

    if (!imageName) {
      return NextResponse.json(
        { error: `No image found for example ${exampleId}` },
        { status: 404 }
      );
    }

    const imagePath = join(process.cwd(), "public", "images", imageName);
    const imageBuffer = await readFile(imagePath);

    // Determine content type based on file extension
    const contentType =
      imageName.endsWith(".png")
        ? "image/png"
        : imageName.endsWith(".jpg") || imageName.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/png";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 500 }
    );
  }
}

