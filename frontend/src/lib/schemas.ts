import { zeroBytes32 } from "@somnia-chain/streams";

// ============ Price Feed Schema ============
export const PRICE_FEED_SCHEMA =
  "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
export const PRICE_FEED_SCHEMA_ID = "defi_price_feed";
export const PRICE_FEED_PARENT = zeroBytes32;
export const PRICE_UPDATE_EVENT_ID = "PriceUpdateV2";

// ============ Alert Schema ============
export const ALERT_SCHEMA =
  "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, string status, uint64 createdAt, uint64 triggeredAt";
export const ALERT_SCHEMA_ID = "price_alert";
export const ALERT_PARENT = zeroBytes32;
export const ALERT_TRIGGERED_EVENT_ID = "AlertTriggeredV2";

// ============ Fear & Greed Schema ============
export const FEAR_GREED_SCHEMA = 
  "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate";
export const FEAR_GREED_SCHEMA_ID = "market_fear_greed";
export const FEAR_GREED_EVENT_ID = "FearGreedUpdateV1";

// ============ Token Sentiment Schema ============
export const TOKEN_SENTIMENT_SCHEMA = 
  "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source";
export const TOKEN_SENTIMENT_SCHEMA_ID = "token_crowd_sentiment";
export const TOKEN_SENTIMENT_EVENT_ID = "TokenSentimentUpdateV1";

// ============ News Event Schema ============
export const NEWS_EVENT_SCHEMA = 
  "bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp";
export const NEWS_EVENT_SCHEMA_ID = "token_news_event";
export const NEWS_EVENT_EVENT_ID = "NewsEventV1";

// ============ News Aggregate Schema ============
export const NEWS_AGG_SCHEMA = 
  "uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd";
export const NEWS_AGG_SCHEMA_ID = "token_news_aggregate";
export const NEWS_AGG_EVENT_ID = "NewsAggregateV1";

// ============ Types ============

export type OracleSource = "PROTOFIRE" | "DIA" | "COINGECKO" | "OFFCHAIN";
export type FearGreedZone = "EXTREME_FEAR" | "FEAR" | "NEUTRAL" | "GREED" | "EXTREME_GREED";
export type NewsSentiment = "positive" | "negative" | "neutral";
export type NewsImpact = "bullish" | "bearish" | "important" | "none";

export interface PriceFeedData {
  timestamp: bigint;
  symbol: string;
  price: bigint;
  decimals: number;
  source: OracleSource;
  sourceAddress: `0x${string}`;
}

export interface AlertData {
  alertId: `0x${string}`;
  userAddress: `0x${string}`;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: bigint;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  createdAt: bigint;
  triggeredAt: bigint;
}

export interface FearGreedData {
  timestamp: bigint;
  score: number;
  zone: FearGreedZone;
  source: string;
  nextUpdate: bigint;
}

export interface TokenSentimentData {
  timestamp: bigint;
  symbol: string;
  upPercent: number;
  downPercent: number;
  netScore: number;
  sampleSize: number;
  source: string;
}

export interface NewsEventData {
  newsId: `0x${string}`;
  timestamp: bigint;
  symbol: string;
  title: string;
  url: string;
  source: string;
  sentiment: NewsSentiment;
  impact: NewsImpact;
  votesPos: number;
  votesNeg: number;
  votesImp: number;
}

export interface NewsAggregateData {
  timestamp: bigint;
  symbol: string;
  sentimentScore: number;
  newsCount: number;
  importantCount: number;
  windowStart: bigint;
  windowEnd: bigint;
}

// ============ Helper Functions ============

export function formatPrice(price: bigint, decimals: number, fractionDigits = 2) {
  const divisor = BigInt(10 ** decimals);
  const wholePart = price / divisor;
  const fractionalPart = price % divisor;
  const formattedFraction = fractionalPart
    .toString()
    .padStart(decimals, "0")
    .slice(0, Math.max(fractionDigits, 0));

  return `${wholePart}${fractionDigits ? `.${formattedFraction}` : ""}`;
}

export function parsePrice(priceStr: string, decimals: number): bigint {
  const [whole, fraction = ""] = priceStr.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`);
}

export function getZoneFromScore(score: number): FearGreedZone {
  if (score <= 24) return "EXTREME_FEAR";
  if (score <= 49) return "FEAR";
  if (score <= 50) return "NEUTRAL";
  if (score <= 74) return "GREED";
  return "EXTREME_GREED";
}

export function getZoneColor(zone: FearGreedZone): string {
  switch (zone) {
    case "EXTREME_FEAR": return "text-red-600 bg-red-50";
    case "FEAR": return "text-orange-600 bg-orange-50";
    case "NEUTRAL": return "text-yellow-600 bg-yellow-50";
    case "GREED": return "text-lime-600 bg-lime-50";
    case "EXTREME_GREED": return "text-green-600 bg-green-50";
  }
}

export function getZoneEmoji(zone: FearGreedZone): string {
  switch (zone) {
    case "EXTREME_FEAR": return "😱";
    case "FEAR": return "😰";
    case "NEUTRAL": return "😐";
    case "GREED": return "😊";
    case "EXTREME_GREED": return "🤑";
  }
}
