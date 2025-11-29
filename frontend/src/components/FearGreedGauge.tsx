'use client';

import { getZoneColor, getZoneEmoji, type FearGreedZone } from "@/lib/schemas";

interface FearGreedGaugeProps {
  score: number;
  zone: FearGreedZone;
  source: string;
  timestamp: number;
}

export function FearGreedGauge({ score, zone, source, timestamp }: FearGreedGaugeProps) {
  const zoneLabel = zone.replace("_", " ");
  const colorClass = getZoneColor(zone);
  const emoji = getZoneEmoji(zone);

  // Calculate gauge rotation (-90 to 90 degrees for 0-100)
  const rotation = (score / 100) * 180 - 90;

  const lastUpdate = new Date(timestamp * 1000).toLocaleString();

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Fear & Greed Index</h3>
        <span className="text-xs text-slate-400">{source}</span>
      </div>

      {/* Gauge */}
      <div className="relative mx-auto mb-4 h-24 w-48">
        {/* Background arc */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 h-24 rounded-t-full"
            style={{
              background: "linear-gradient(to right, #dc2626, #f97316, #eab308, #84cc16, #22c55e)",
            }}
          />
        </div>

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 h-20 w-1 origin-bottom -translate-x-1/2 bg-white transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white" />
        </div>

        {/* Center cover */}
        <div className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-[#0a0a12] border-2 border-white/10 shadow" />
      </div>

      {/* Score display */}
      <div className="text-center">
        <div className="text-4xl font-bold text-white">{score}</div>
        <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${colorClass}`}>
          <span>{emoji}</span>
          <span className="capitalize">{zoneLabel}</span>
        </div>
      </div>

      {/* Last update */}
      <div className="mt-3 text-center text-xs text-slate-500">
        Updated: {lastUpdate}
      </div>
    </div>
  );
}
