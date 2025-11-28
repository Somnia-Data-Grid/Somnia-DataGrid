'use client';

import { useEffect, useState } from "react";
import { PriceDashboard } from "@/components/PriceDashboard";
import { AlertManager } from "@/components/AlertManager";
import { SentimentDashboard } from "@/components/SentimentDashboard";
import { usePriceSubscription, type UiPrice } from "@/lib/hooks/usePriceSubscription";
import { AlertNotification } from "@/components/AlertNotification";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export default function HomePage() {
  const { prices: livePrices, alerts, isConnected, error: subscriptionError } = usePriceSubscription();
  const [prices, setPrices] = useState<UiPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-slate-50">
      <AlertNotification alerts={alerts} />
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-slate-500">Somnia Hackathon</p>
            <h1 className="text-3xl font-bold text-slate-900">Somnia DeFi Tracker</h1>
            <p className="text-sm text-slate-500">Real-time price feeds + alerts powered by Data Streams.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-rose-400"}`}
              />
              {isConnected ? "Live" : "Offline"}
            </div>
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">Loading price data…</p>
            <p className="text-sm text-slate-500">Connecting to Somnia Data Streams.</p>
          </div>
        ) : resolvedError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            <p className="font-semibold">Something went wrong.</p>
            <p className="text-sm">{resolvedError}</p>
            <button
              type="button"
              className="mt-4 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <PriceDashboard prices={prices} />
            <AlertManager prices={prices} />
            <SentimentDashboard />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/80 py-6 text-center text-xs text-slate-500">
        Built with Protofire & DIA oracles • Somnia Dream Testnet
      </footer>
    </div>
  );
}
