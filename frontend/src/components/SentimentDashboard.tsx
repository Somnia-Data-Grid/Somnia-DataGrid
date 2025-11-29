'use client';

import { useState, useEffect } from 'react';
import { useSentimentSubscription } from "@/lib/hooks/useSentimentSubscription";
import { useTokenTracking } from "@/lib/hooks/useTokenTracking";
import { FearGreedGauge } from "./FearGreedGauge";
import { SentimentGrid } from "./SentimentCard";

import { TokenSearch } from "./TokenSearch";
import { SentimentAlertManager } from "./SentimentAlertManager";
import { CryptoPanicWidget } from "./CryptoPanicWidget";

type Tab = 'overview' | 'tokens' | 'alerts';

export function SentimentDashboard() {
  const { fearGreed, sentiments, isConnected, error } = useSentimentSubscription();
  const { trackedTokens, fetchTrackedTokens } = useTokenTracking();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Fetch tracked tokens on mount
  useEffect(() => {
    fetchTrackedTokens();
  }, [fetchTrackedTokens]);

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Market Sentiment</h2>

        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
            {(['overview', 'tokens', 'alerts'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === tab
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'tokens' && '🔍 Tokens'}
                {tab === 'alerts' && '🔔 Alerts'}
              </button>
            ))}
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_8px_currentColor]" : "bg-rose-400"
                }`}
            />
            <span className="text-xs text-slate-400">
              {isConnected ? "Live" : error || "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Setup notice when not connected */}
          {!isConnected && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">
              <p className="font-medium">⚠️ Sentiment streams not available</p>
              <p className="mt-1 opacity-80">
                To enable sentiment data, run the workers and register event schemas:
              </p>
              <ol className="mt-2 ml-4 list-decimal text-amber-200/80">
                <li>cd workers && npm run register-sentiment-schemas</li>
                <li>npm run dev (start workers)</li>
              </ol>
            </div>
          )}

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
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-300">Fear & Greed Index</h3>
                  <div className="flex h-32 items-center justify-center">
                    <div className="text-center text-sm text-slate-500">
                      {isConnected ? (
                        <>
                          <div className="mb-2 h-6 w-6 mx-auto animate-spin rounded-full border-2 border-slate-600 border-t-purple-500" />
                          Waiting for data...
                        </>
                      ) : (
                        <span>No data available</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Token Sentiment */}
            <div className="lg:col-span-2">
              <SentimentGrid sentiments={sentiments} trackedTokens={trackedTokens} />
            </div>
          </div>

          {/* Live News Widget */}
          <CryptoPanicWidget currencies="BTC,ETH,SOL,STT" />
        </>
      )}

      {activeTab === 'tokens' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-white mb-4">Track Tokens</h3>
          <p className="text-sm text-slate-400 mb-4">
            Search and add tokens to track their sentiment. Tracked tokens will appear in the sentiment grid
            and can be used for sentiment alerts.
          </p>
          <TokenSearch showTrackedTokens={true} />
        </div>
      )}

      {activeTab === 'alerts' && (
        <SentimentAlertManager />
      )}

      {/* Info banner */}
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-300">
        <p className="font-medium">📡 Powered by Somnia DataGrid</p>
        <p className="mt-1 text-blue-300/80">
          All sentiment data is published on-chain to Somnia Data Streams.
          Any dapp can subscribe to these streams for real-time market intelligence.
        </p>
      </div>
    </div>
  );
}
