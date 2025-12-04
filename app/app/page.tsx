"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import Image from "next/image";

export default function ExamplesPage() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const fetchImage = async (exampleId: string) => {
    if (images[exampleId]) {
      return; // Image already loaded
    }

    setLoading((prev) => ({ ...prev, [exampleId]: true }));

    try {
      const response = await fetch(`/app/api/example-image?id=${exampleId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      setImages((prev) => ({ ...prev, [exampleId]: imageUrl }));
    } catch (error) {
      console.error("Error fetching image:", error);
    } finally {
      setLoading((prev) => ({ ...prev, [exampleId]: false }));
    }
  };

  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="mx-auto mb-8 w-full max-w-7xl text-center">
        <h1 className="mb-4 font-bold text-4xl">Examples</h1>
        <p className="text-muted-foreground text-lg">
          This page will showcase examples of the application.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex min-h-[400px] flex-col rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold text-xl">Example 1</h2>
          <div className="mb-4 flex min-h-[200px] flex-1 items-center justify-center rounded-lg border bg-muted">
            {images["1"] ? (
              <Image
                alt="Example 1"
                className="h-auto max-h-[200px] w-auto rounded-lg object-contain"
                height={200}
                src={images["1"]}
                width={300}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {loading["1"] ? "Loading..." : "Image placeholder"}
              </p>
            )}
          </div>
          <p className="mb-auto text-muted-foreground">
            Content for the first example will go here.
          </p>
          <Button
            className="mt-4 bg-red-600 font-bold text-white hover:bg-red-700 hover:text-white"
            disabled={loading["1"]}
            onClick={() => fetchImage("1")}
            type="button"
          >
            {loading["1"] ? "Loading..." : "View Example"}
          </Button>
        </div>
        <div className="flex min-h-[400px] flex-col rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold text-xl">Example 2</h2>
          <div className="mb-4 flex min-h-[200px] flex-1 items-center justify-center rounded-lg border bg-muted">
            {images["2"] ? (
              <Image
                alt="Example 2"
                className="h-auto max-h-[200px] w-auto rounded-lg object-contain"
                height={200}
                src={images["2"]}
                width={300}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {loading["2"] ? "Loading..." : "Image placeholder"}
              </p>
            )}
          </div>
          <p className="mb-auto text-muted-foreground">
            Content for the second example will go here.
          </p>
          <Button
            className="mt-4 bg-red-600 font-bold text-white hover:bg-red-700 hover:text-white"
            disabled={loading["2"]}
            onClick={() => fetchImage("2")}
            type="button"
          >
            {loading["2"] ? "Loading..." : "View Example"}
          </Button>
        </div>
        <div className="flex min-h-[400px] flex-col rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold text-xl">Example 3</h2>
          <div className="mb-4 flex min-h-[200px] flex-1 items-center justify-center rounded-lg border bg-muted">
            {images["3"] ? (
              <Image
                alt="Example 3"
                className="h-auto max-h-[200px] w-auto rounded-lg object-contain"
                height={200}
                src={images["3"]}
                width={300}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {loading["3"] ? "Loading..." : "Image placeholder"}
              </p>
            )}
          </div>
          <p className="mb-auto text-muted-foreground">
            Content for the third example will go here.
          </p>
          <Button
            className="mt-4 bg-red-600 font-bold text-white hover:bg-red-700 hover:text-white"
            disabled={loading["3"]}
            onClick={() => fetchImage("3")}
            type="button"
          >
            {loading["3"] ? "Loading..." : "View Example"}
          </Button>
        </div>
      </div>
    </div>
  );
}

