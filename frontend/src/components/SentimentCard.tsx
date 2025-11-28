'use client';

interface SentimentCardProps {
  symbol: string;
  upPercent: number;
  downPercent: number;
  netScore: number;
  sampleSize: number;
  source: string;
  timestamp: number;
}

export function SentimentCard({
  symbol,
  upPercent,
  downPercent,
  netScore,
  source,
  timestamp,
}: SentimentCardProps) {
  const isPositive = netScore > 0;
  const isNeutral = netScore === 0;
  
  const barColor = isPositive 
    ? "bg-green-500" 
    : isNeutral 
      ? "bg-slate-400" 
      : "bg-red-500";
  
  const scoreColor = isPositive 
    ? "text-green-600" 
    : isNeutral 
      ? "text-slate-600" 
      : "text-red-600";

  const lastUpdate = new Date(timestamp * 1000).toLocaleTimeString();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{symbol}</span>
        <span className="text-xs text-slate-400">{source}</span>
      </div>

      {/* Sentiment bar */}
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div 
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${upPercent}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-green-600">👍 {upPercent.toFixed(0)}%</span>
          <span className="text-red-600">👎 {downPercent.toFixed(0)}%</span>
        </div>
        <span className={`font-medium ${scoreColor}`}>
          {isPositive ? "+" : ""}{netScore.toFixed(0)}
        </span>
      </div>

      <div className="mt-1 text-right text-xs text-slate-400">
        {lastUpdate}
      </div>
    </div>
  );
}

interface SentimentGridProps {
  sentiments: SentimentCardProps[];
}

export function SentimentGrid({ sentiments }: SentimentGridProps) {
  if (sentiments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">📊 Token Sentiment</h3>
        <div className="py-8 text-center text-sm text-slate-400">
          No sentiment data yet. Waiting for updates...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">📊 Token Sentiment</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sentiments.map((s) => (
          <SentimentCard key={s.symbol} {...s} />
        ))}
      </div>
    </div>
  );
}
