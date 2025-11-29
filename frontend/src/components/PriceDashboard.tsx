'use client';

import { PriceCard } from "./PriceCard";
import type { UiPrice } from "@/lib/hooks/usePriceSubscription";

interface PriceDashboardProps {
  prices: UiPrice[];
}

export function PriceDashboard({ prices }: PriceDashboardProps) {
  if (!prices?.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-12 text-center shadow-sm">
        <p className="text-lg font-semibold text-white">No price data yet</p>
        <p className="mt-2 text-sm text-slate-400">
          Publish prices via the backend or wait for the publisher loop.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Live Prices</h2>
          <p className="text-sm text-slate-400">Powered by Somnia Data Streams</p>
        </div>
        <span className="text-sm text-slate-400">{prices.length} tracked asset(s)</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {prices.map((price) => (
          <PriceCard key={price.symbol} price={price} />
        ))}
      </div>
    </div>
  );
}

