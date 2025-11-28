'use client';

import { useSentimentSubscription } from "@/lib/hooks/useSentimentSubscription";
import { FearGreedGauge } from "./FearGreedGauge";
import { SentimentGrid } from "./SentimentCard";
import { NewsTicker } from "./NewsTicker";

export function SentimentDashboard() {
  const { fearGreed, sentiments, news, isConnected, error } = useSentimentSubscription();

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Market Sentiment</h2>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-slate-500">
            {isConnected ? "Live" : error || "Connecting..."}
          </span>
        </div>
      </div>

      {/* Fear & Greed + Sentiment Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Fear & Greed Gauge */}
        <div className="lg:col-span-1">
          {fearGreed ? (
            <FearGreedGauge
              score={fearGreed.score}
              zone={fearGreed.zone}
              source={fearGreed.source}
              timestamp={fearGreed.timestamp}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Fear & Greed Index</h3>
              <div className="flex h-32 items-center justify-center">
                <div className="text-center text-sm text-slate-400">
                  <div className="mb-2 h-6 w-6 mx-auto animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  Loading...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Token Sentiment */}
        <div className="lg:col-span-2">
          <SentimentGrid sentiments={sentiments} />
        </div>
      </div>

      {/* News Ticker */}
      <NewsTicker news={news} maxItems={10} />

      {/* Info banner */}
      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
        <p className="font-medium">📡 Powered by Somnia DataGrid</p>
        <p className="mt-1 text-blue-600">
          All sentiment data is published on-chain to Somnia Data Streams. 
          Any dapp can subscribe to these streams for real-time market intelligence.
        </p>
      </div>
    </div>
  );
}
