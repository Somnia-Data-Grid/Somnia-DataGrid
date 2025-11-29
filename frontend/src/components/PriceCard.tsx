'use client';

import { useEffect, useRef, useState } from "react";
import type { UiPrice } from "@/lib/hooks/usePriceSubscription";

interface Props {
  price: UiPrice;
}

const SOURCE_COLORS: Record<UiPrice["source"], string> = {
  PROTOFIRE: "bg-blue-100 text-blue-700",
  DIA: "bg-purple-100 text-purple-700",
  COINGECKO: "bg-amber-100 text-amber-700",
  OFFCHAIN: "bg-emerald-100 text-emerald-700",
};

const SOURCE_LABELS: Record<UiPrice["source"], string> = {
  PROTOFIRE: "Protofire",
  DIA: "DIA Oracle",
  COINGECKO: "CoinGecko",
  OFFCHAIN: "Off-chain",
};

export function PriceCard({ price }: Props) {
  const [relativeTime, setRelativeTime] = useState("just now");
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    node.classList.add("price-highlight");
    const timeout = window.setTimeout(() => node.classList.remove("price-highlight"), 1000);

    return () => {
      clearTimeout(timeout);
      node.classList.remove("price-highlight");
    };
  }, [price.priceRaw]);

  useEffect(() => {
    const update = () => {
      const seconds = Math.max(0, Math.floor(Date.now() / 1000 - price.timestamp));
      if (seconds < 60) {
        setRelativeTime(`${seconds}s ago`);
      } else if (seconds < 3600) {
        setRelativeTime(`${Math.floor(seconds / 60)}m ago`);
      } else {
        setRelativeTime(`${Math.floor(seconds / 3600)}h ago`);
      }
    };

    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [price.timestamp]);

  return (
    <div
      ref={cardRef}
      className="price-card rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm transition-all backdrop-blur-sm"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">USD</p>
          <h3 className="text-2xl font-semibold text-white">{price.symbol}</h3>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${SOURCE_COLORS[price.source] || "bg-gray-100 text-gray-700"}`}>
          {SOURCE_LABELS[price.source] || price.source}
        </span>
      </div>
      <p className="text-4xl font-bold text-white">${price.price}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>Updated {relativeTime}</span>
        <button
          type="button"
          className="text-slate-500 transition hover:text-purple-400"
          title="Copy oracle address"
          onClick={() => navigator.clipboard.writeText(price.sourceAddress)}
        >
          Copy oracle
        </button>
      </div>
    </div>
  );
}

