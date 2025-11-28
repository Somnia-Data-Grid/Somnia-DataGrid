'use client';

import { type NewsSentiment, type NewsImpact } from "@/lib/schemas";

interface NewsItem {
  newsId: string;
  symbol: string;
  title: string;
  url: string;
  source: string;
  sentiment: NewsSentiment;
  impact: NewsImpact;
  votesPos: number;
  votesNeg: number;
  votesImp: number;
  timestamp: number;
}

interface NewsTickerProps {
  news: NewsItem[];
  maxItems?: number;
}

function getSentimentBadge(sentiment: NewsSentiment) {
  switch (sentiment) {
    case "positive":
      return <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Bullish</span>;
    case "negative":
      return <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Bearish</span>;
    default:
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Neutral</span>;
  }
}

function getImpactBadge(impact: NewsImpact) {
  if (impact === "important") {
    return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">🔥 Important</span>;
  }
  return null;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NewsTicker({ news, maxItems = 10 }: NewsTickerProps) {
  const displayNews = news.slice(0, maxItems);

  if (displayNews.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">📰 Live News Feed</h3>
        <div className="py-8 text-center text-sm text-slate-400">
          No news yet. Waiting for updates...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">📰 Live News Feed</h3>
        <span className="text-xs text-slate-400">{news.length} items</span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {displayNews.map((item) => (
          <a
            key={item.newsId}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                {item.symbol}
              </span>
              {getSentimentBadge(item.sentiment)}
              {getImpactBadge(item.impact)}
            </div>
            
            <h4 className="mb-1 text-sm font-medium text-slate-800 line-clamp-2">
              {item.title}
            </h4>
            
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{item.source}</span>
              <div className="flex items-center gap-2">
                <span>👍 {item.votesPos}</span>
                <span>👎 {item.votesNeg}</span>
                <span>{formatTimeAgo(item.timestamp)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
