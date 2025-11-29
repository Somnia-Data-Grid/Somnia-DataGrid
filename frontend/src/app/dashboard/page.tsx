'use client';

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { PriceDashboard } from "@/components/PriceDashboard";
import { AlertManager } from "@/components/AlertManager";
import { SentimentDashboard } from "@/components/SentimentDashboard";
import { usePriceSubscription, type UiPrice } from "@/lib/hooks/usePriceSubscription";
import { AlertNotification } from "@/components/AlertNotification";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Logo } from "@/components/Logo";

export default function DashboardPage() {
  const { address } = useAccount();
  const { prices: livePrices, alerts, isConnected, error: subscriptionError } = usePriceSubscription(address);
  const [prices, setPrices] = useState<UiPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'market' | 'sentiment'>('market');

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/prices");
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load prices");
        }
        setPrices(data.prices);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load prices");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (livePrices.length) {
      setPrices((prev) => {
        const map = new Map(prev.map((item) => [item.symbol, item]));
        livePrices.forEach((item) => map.set(item.symbol, item));
        return Array.from(map.values());
      });
    }
  }, [livePrices]);

  const resolvedError = error || subscriptionError;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlertNotification alerts={alerts} />
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Somnia <span className="text-primary">AlertGrid</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span
                className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${isConnected ? "bg-emerald-400 text-emerald-400" : "bg-rose-400 text-rose-400"}`}
              />
              <span className={isConnected ? "text-emerald-400" : "text-rose-400"}>
                {isConnected ? "Stream Active" : "Offline"}
              </span>
            </div>
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-sm">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-medium text-white">Initializing Data Stream...</p>
            <p className="text-sm text-slate-400">Connecting to Somnia Network</p>
          </div>
        ) : resolvedError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200">
            <p className="font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Connection Error
            </p>
            <p className="text-sm mt-1 opacity-80">{resolvedError}</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-100 transition-colors"
              onClick={() => window.location.reload()}
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div className="flex justify-center mb-6">
              <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('market')}
                  className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'market'
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  📈 Market Data
                </button>
                <button
                  onClick={() => setActiveTab('sentiment')}
                  className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'sentiment'
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  🧠 Sentiment Analysis
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'market' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-2">
                  <PriceDashboard prices={prices} />
                </div>
                <div className="lg:col-span-1">
                  <AlertManager prices={prices} />
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SentimentDashboard />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
