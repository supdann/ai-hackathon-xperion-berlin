"use client";

type ForecastData = {
  product: string;
  imageUrl: string;
  forecast: {
    message?: string;
    placeholder?: boolean;
  };
};

export function Forecast({
  forecastData,
}: {
  forecastData?: ForecastData;
}) {
  if (!forecastData) {
    return (
      <div className="rounded-lg border bg-muted p-4">
        <p className="text-muted-foreground text-sm">No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-lg">Product Forecast</h3>
        <p className="text-muted-foreground text-sm">{forecastData.product}</p>
      </div>
      
      <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg border bg-muted">
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
          <div className="text-muted-foreground text-4xl">📊</div>
          <p className="text-muted-foreground text-sm text-center">
            Forecast visualization placeholder
          </p>
          <p className="text-muted-foreground text-xs text-center">
            Image will be generated here
          </p>
        </div>
      </div>

      {forecastData.forecast?.message && (
        <p className="text-muted-foreground text-sm">
          {forecastData.forecast.message}
        </p>
      )}
    </div>
  );
}

