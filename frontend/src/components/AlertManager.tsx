'use client';

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import type { UiPrice } from "@/lib/hooks/usePriceSubscription";
import { parsePrice } from "@/lib/schemas";
import { TelegramLinkButton } from "./TelegramLinkButton";

interface AlertManagerProps {
  prices: UiPrice[];
}

export function AlertManager({ prices }: AlertManagerProps) {
  const { address, isConnected } = useAccount();
  const [asset, setAsset] = useState("");
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [threshold, setThreshold] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const sortedAssets = useMemo(() => [...prices].sort((a, b) => a.symbol.localeCompare(b.symbol)), [prices]);

  const handleSubmit = async () => {
    if (!asset || !threshold) {
      setMessage({ type: "error", text: "Select an asset and enter a threshold." });
      return;
    }

    const selected = prices.find((p) => p.symbol === asset);
    if (!selected) {
      setMessage({ type: "error", text: "Unknown asset selected." });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      const thresholdValue = parsePrice(threshold, selected.decimals).toString();

      const response = await fetch("/api/alerts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset,
          condition,
          thresholdPrice: thresholdValue,
          userAddress: address, // Use connected wallet if available
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create alert");
      }

      setMessage({
        type: "success",
        text: `Alert created! ID: ${String(data.alertId).slice(0, 10)}...`,
      });
      setThreshold("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create alert",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Price Alerts</h2>
        <p className="text-sm text-slate-500">Create threshold alerts that fire within seconds of price changes.</p>
      </div>

      {!isConnected && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="font-medium">💡 Tip:</span> Connect your wallet to create alerts linked to your address.
        </div>
      )}

      {isConnected && address && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
          <div className="text-sm text-emerald-700">
            <span className="font-medium">✓ Connected:</span>{" "}
            <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
          </div>
          <TelegramLinkButton />
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Asset</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={asset}
            onChange={(event) => setAsset(event.target.value)}
          >
            <option value="">Select asset</option>
            {sortedAssets.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol} (${item.price})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Condition</label>
          <div className="mt-2 flex gap-4 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="ABOVE"
                checked={condition === "ABOVE"}
                onChange={() => setCondition("ABOVE")}
              />
              Price goes above
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="BELOW"
                checked={condition === "BELOW"}
                onChange={() => setCondition("BELOW")}
              />
              Price goes below
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Threshold (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </div>

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : message.type === "info"
                ? "bg-blue-50 text-blue-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !asset || !threshold}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Creating alert..." : "Create Alert"}
        </button>
      </div>
    </div>
  );
}

