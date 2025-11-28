/**
 * Somnia DataGrid - Sentiment Stream Schemas
 * 
 * These schemas define the structure of sentiment data published to Somnia Data Streams.
 * Other dapps can subscribe to these streams for market intelligence.
 */

import { zeroBytes32 } from "@somnia-chain/streams";

// ============ Market Fear & Greed Stream ============
// Source: CoinMarketCap Fear & Greed Index
// Update frequency: Daily (or when value changes)

export const FEAR_GREED_SCHEMA = 
  "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate";
export const FEAR_GREED_SCHEMA_ID = "market_fear_greed";
export const FEAR_GREED_PARENT = zeroBytes32;
export const FEAR_GREED_EVENT_ID = "FearGreedUpdateV1";

export type FearGreedZone = "EXTREME_FEAR" | "FEAR" | "NEUTRAL" | "GREED" | "EXTREME_GREED";

export interface FearGreedData {
  timestamp: bigint;
  score: number;        // 0-100
  zone: FearGreedZone;  // Human-readable zone
  source: string;       // "CMC" | "ALTERNATIVE_ME"
  nextUpdate: bigint;   // Expected next update timestamp
}

export function getZoneFromScore(score: number): FearGreedZone {
  if (score <= 24) return "EXTREME_FEAR";
  if (score <= 49) return "FEAR";
  if (score <= 50) return "NEUTRAL";
  if (score <= 74) return "GREED";
  return "EXTREME_GREED";
}

// ============ Token Crowd Sentiment Stream ============
// Source: CoinGecko sentiment votes
// Update frequency: Every 1-6 hours

export const TOKEN_SENTIMENT_SCHEMA = 
  "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source";
export const TOKEN_SENTIMENT_SCHEMA_ID = "token_crowd_sentiment";
export const TOKEN_SENTIMENT_PARENT = zeroBytes32;
export const TOKEN_SENTIMENT_EVENT_ID = "TokenSentimentUpdateV1";

export interface TokenSentimentData {
  timestamp: bigint;
  symbol: string;
  upPercent: number;      // 0-10000 (basis points, e.g., 7500 = 75%)
  downPercent: number;    // 0-10000
  netScore: number;       // -10000 to +10000 (up - down)
  sampleSize: number;     // Number of votes
  source: string;         // "COINGECKO"
}

// ============ Token News Event Stream ============
// Source: CryptoPanic
// Update frequency: Per new article (polled every 30-60s)

export const NEWS_EVENT_SCHEMA = 
  "bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp";
export const NEWS_EVENT_SCHEMA_ID = "token_news_event";
export const NEWS_EVENT_PARENT = zeroBytes32;
export const NEWS_EVENT_EVENT_ID = "NewsEventV1";

export type NewsSentiment = "positive" | "negative" | "neutral";
export type NewsImpact = "bullish" | "bearish" | "important" | "none";

export interface NewsEventData {
  newsId: `0x${string}`;  // Hash of CryptoPanic item ID
  timestamp: bigint;
  symbol: string;
  title: string;
  url: string;
  source: string;         // "cryptopanic", "coindesk", etc.
  sentiment: NewsSentiment;
  impact: NewsImpact;
  votesPos: number;
  votesNeg: number;
  votesImp: number;       // "important" votes
}

// ============ Token News Aggregate Stream ============
// Source: Aggregated CryptoPanic news per symbol
// Update frequency: Every 5-10 minutes

export const NEWS_AGG_SCHEMA = 
  "uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd";
export const NEWS_AGG_SCHEMA_ID = "token_news_aggregate";
export const NEWS_AGG_PARENT = zeroBytes32;
export const NEWS_AGG_EVENT_ID = "NewsAggregateV1";

export interface NewsAggregateData {
  timestamp: bigint;
  symbol: string;
  sentimentScore: number;   // -10000 to +10000
  newsCount: number;
  importantCount: number;
  windowStart: bigint;      // Start of aggregation window
  windowEnd: bigint;        // End of aggregation window
}

// ============ Helper Functions ============

export function computeSentimentScore(positive: number, negative: number, total: number): number {
  if (total === 0) return 0;
  // Returns -10000 to +10000
  return Math.round(((positive - negative) / total) * 10000);
}
