'use client';

import { useState } from 'react';
import { useSentimentSubscription } from "@/lib/hooks/useSentimentSubscription";
import { FearGreedGauge } from "./FearGreedGauge";
import { SentimentGrid } from "./SentimentCard";
import { NewsTicker } from "./NewsTicker";
import { TokenSearch } from "./TokenSearch";
import { SentimentAlertManager } from "./SentimentAlertManager";

type Tab = 'overview' | 'tokens' | 'alerts';

export function SentimentDashboard() {
  const { fearGreed, sentiments, news, isConnected, error } = useSentimentSubscription();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Market Sentiment</h2>
        
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['overview', 'tokens', 'alerts'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
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
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-slate-500">
              {isConnected ? "Live" : error || "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
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
        </>
      )}

      {activeTab === 'tokens' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Track Tokens</h3>
          <p className="text-sm text-slate-500 mb-4">
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
