/**
 * Sentiment Publisher Service
 *
 * Publishes sentiment data to Somnia Data Streams:
 * - Fear & Greed Index (daily)
 * - Token Crowd Sentiment (hourly)
 * - News Events (real-time)
 * - News Aggregates (every 5-10 mins)
 *
 * Uses shared transaction manager to avoid nonce conflicts with price publisher.
 */

import { type Hex } from "viem";
import { SchemaEncoder } from "@somnia-chain/streams";

import { fearGreedClient } from "./fear-greed.js";
import { coingeckoSentimentClient } from "./coingecko-sentiment.js";
import { cryptoPanicClient } from "./cryptopanic.js";
import { initTxManager, getSDK, queueSetAndEmitEvents } from "./tx-manager.js";
import {
  upsertFearGreed,
  upsertTokenSentiment,
  upsertNews,
  cleanOldNews,
} from "../db/client.js";
import { checkSentimentAlerts, getActiveSentimentAlertCount } from "./sentiment-alert-checker.js";
import { getTrackedTokens } from "../db/client.js";

import {
  FEAR_GREED_SCHEMA,
  FEAR_GREED_EVENT_ID,
  TOKEN_SENTIMENT_SCHEMA,
  TOKEN_SENTIMENT_EVENT_ID,
  NEWS_EVENT_SCHEMA,
  NEWS_EVENT_EVENT_ID,
  NEWS_AGG_SCHEMA,
  NEWS_AGG_EVENT_ID,
  type FearGreedData,
  type TokenSentimentData,
  type NewsEventData,
  type NewsAggregateData,
} from "../schemas/sentiment.js";

// Config - intervals in minutes (configurable via env)
const FEAR_GREED_INTERVAL = parseInt(process.env.FEAR_GREED_INTERVAL_MIN || "60", 10) * 60 * 1000;
const SENTIMENT_INTERVAL = parseInt(process.env.SENTIMENT_INTERVAL_MIN || "120", 10) * 60 * 1000;
const NEWS_POLL_INTERVAL = parseInt(process.env.NEWS_POLL_INTERVAL_MIN || "30", 10) * 60 * 1000;
const NEWS_AGG_INTERVAL = parseInt(process.env.NEWS_AGG_INTERVAL_MIN || "60", 10) * 60 * 1000;

// Get sentiment symbols - merges env defaults with user-tracked tokens
function getSentimentSymbols(): string[] {
  const symbols = new Set<string>();
  
  // Add env symbols as base (defaults)
  const envSymbols = process.env.SENTIMENT_SYMBOLS;
  if (envSymbols) {
    envSymbols.split(",").forEach(s => symbols.add(s.trim().toUpperCase()));
  } else {
    // Default symbols if no env
    ["BTC", "ETH", "SOL"].forEach(s => symbols.add(s));
  }
  
  // Add all tracked tokens (system + user-added)
  try {
    const tracked = getTrackedTokens();
    tracked.forEach(t => symbols.add(t.symbol.toUpperCase()));
  } catch {
    // DB not ready, use env/defaults only
  }
  
  return Array.from(symbols);
}

// ============ Fear & Greed Publisher ============

async function publishFearGreed(data: FearGreedData): Promise<void> {
  const sdk = getSDK();
  const encoder = new SchemaEncoder(FEAR_GREED_SCHEMA);

  const schemaIdResult = await sdk.streams.computeSchemaId(FEAR_GREED_SCHEMA);
  if (schemaIdResult instanceof Error) throw schemaIdResult;
  const schemaId = schemaIdResult as `0x${string}`;

  const encodedData = encoder.encodeData([
    { name: "timestamp", value: data.timestamp.toString(), type: "uint64" },
    { name: "score", value: data.score.toString(), type: "uint8" },
    { name: "zone", value: data.zone, type: "string" },
    { name: "source", value: data.source, type: "string" },
    { name: "nextUpdate", value: data.nextUpdate.toString(), type: "uint64" },
  ]);

  const dataId = `0x${Buffer.from("fear-greed-index").toString("hex").padEnd(64, "0")}` as Hex;

  const result = await queueSetAndEmitEvents(
    "fear-greed",
    [{ id: dataId, schemaId, data: encodedData }],
    [{ id: FEAR_GREED_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (!result) throw new Error("No transaction hash returned");
  
  // Cache in SQLite
  upsertFearGreed({
    score: data.score,
    zone: data.zone,
    source: data.source,
    timestamp: Number(data.timestamp),
    next_update: Number(data.nextUpdate),
  });
  
  console.log(`[Sentiment] ✓ Fear & Greed: ${data.score} (${data.zone})`);
}

// ============ Token Sentiment Publisher ============

async function publishTokenSentiment(data: TokenSentimentData): Promise<void> {
  const sdk = getSDK();
  const encoder = new SchemaEncoder(TOKEN_SENTIMENT_SCHEMA);

  const schemaIdResult = await sdk.streams.computeSchemaId(TOKEN_SENTIMENT_SCHEMA);
  if (schemaIdResult instanceof Error) throw schemaIdResult;
  const schemaId = schemaIdResult as `0x${string}`;

  const encodedData = encoder.encodeData([
    { name: "timestamp", value: data.timestamp.toString(), type: "uint64" },
    { name: "symbol", value: data.symbol, type: "string" },
    { name: "upPercent", value: data.upPercent.toString(), type: "uint16" },
    { name: "downPercent", value: data.downPercent.toString(), type: "uint16" },
    { name: "netScore", value: data.netScore.toString(), type: "int16" },
    { name: "sampleSize", value: data.sampleSize.toString(), type: "uint32" },
    { name: "source", value: data.source, type: "string" },
  ]);

  const dataId = `0x${Buffer.from(`sentiment-${data.symbol.toLowerCase()}`).toString("hex").padEnd(64, "0")}` as Hex;

  const result = await queueSetAndEmitEvents(
    `sentiment-${data.symbol}`,
    [{ id: dataId, schemaId, data: encodedData }],
    [{ id: TOKEN_SENTIMENT_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (!result) throw new Error("No transaction hash returned");
  
  // Cache in SQLite
  upsertTokenSentiment({
    symbol: data.symbol,
    up_percent: data.upPercent,
    down_percent: data.downPercent,
    net_score: data.netScore,
    sample_size: data.sampleSize,
    source: data.source,
    timestamp: Number(data.timestamp),
  });
  
  console.log(`[Sentiment] ✓ ${data.symbol}: ${data.upPercent / 100}% up, ${data.downPercent / 100}% down`);
}

// ============ News Event Publisher ============

async function publishNewsEvent(data: NewsEventData): Promise<void> {
  const sdk = getSDK();
  const encoder = new SchemaEncoder(NEWS_EVENT_SCHEMA);

  const schemaIdResult = await sdk.streams.computeSchemaId(NEWS_EVENT_SCHEMA);
  if (schemaIdResult instanceof Error) throw schemaIdResult;
  const schemaId = schemaIdResult as `0x${string}`;

  const encodedData = encoder.encodeData([
    { name: "newsId", value: data.newsId, type: "bytes32" },
    { name: "timestamp", value: data.timestamp.toString(), type: "uint64" },
    { name: "symbol", value: data.symbol, type: "string" },
    { name: "title", value: data.title, type: "string" },
    { name: "url", value: data.url, type: "string" },
    { name: "source", value: data.source, type: "string" },
    { name: "sentiment", value: data.sentiment, type: "string" },
    { name: "impact", value: data.impact, type: "string" },
    { name: "votesPos", value: data.votesPos.toString(), type: "uint16" },
    { name: "votesNeg", value: data.votesNeg.toString(), type: "uint16" },
    { name: "votesImp", value: data.votesImp.toString(), type: "uint16" },
  ]);

  const result = await queueSetAndEmitEvents(
    `news-${data.newsId.slice(0, 10)}`,
    [{ id: data.newsId, schemaId, data: encodedData }],
    [{ id: NEWS_EVENT_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (!result) throw new Error("No transaction hash returned");
  
  // Cache in SQLite
  upsertNews({
    news_id: data.newsId,
    symbol: data.symbol,
    title: data.title,
    url: data.url,
    source: data.source,
    sentiment: data.sentiment,
    impact: data.impact,
    votes_pos: data.votesPos,
    votes_neg: data.votesNeg,
    votes_imp: data.votesImp,
    timestamp: Number(data.timestamp),
  });
  
  console.log(`[Sentiment] ✓ News: [${data.symbol}] ${data.title.slice(0, 50)}...`);
}

// ============ News Aggregate Publisher ============

async function publishNewsAggregate(data: NewsAggregateData): Promise<void> {
  const sdk = getSDK();
  const encoder = new SchemaEncoder(NEWS_AGG_SCHEMA);

  const schemaIdResult = await sdk.streams.computeSchemaId(NEWS_AGG_SCHEMA);
  if (schemaIdResult instanceof Error) throw schemaIdResult;
  const schemaId = schemaIdResult as `0x${string}`;

  const encodedData = encoder.encodeData([
    { name: "timestamp", value: data.timestamp.toString(), type: "uint64" },
    { name: "symbol", value: data.symbol, type: "string" },
    { name: "sentimentScore", value: data.sentimentScore.toString(), type: "int16" },
    { name: "newsCount", value: data.newsCount.toString(), type: "uint16" },
    { name: "importantCount", value: data.importantCount.toString(), type: "uint16" },
    { name: "windowStart", value: data.windowStart.toString(), type: "uint64" },
    { name: "windowEnd", value: data.windowEnd.toString(), type: "uint64" },
  ]);

  const dataId = `0x${Buffer.from(`news-agg-${data.symbol.toLowerCase()}`).toString("hex").padEnd(64, "0")}` as Hex;

  const result = await queueSetAndEmitEvents(
    `news-agg-${data.symbol}`,
    [{ id: dataId, schemaId, data: encodedData }],
    [{ id: NEWS_AGG_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (!result) throw new Error("No transaction hash returned");
  console.log(`[Sentiment] ✓ News Agg ${data.symbol}: score=${data.sentimentScore}, count=${data.newsCount}`);
}

// ============ Main Publisher Loop ============

let lastFearGreedScore: number | null = null;

async function runFearGreedLoop() {
  while (true) {
    try {
      const data = await fearGreedClient.fetchFearGreed();
      if (data && data.score !== lastFearGreedScore) {
        await publishFearGreed(data);
        lastFearGreedScore = data.score;
        
        // Check sentiment alerts after Fear & Greed update
        const triggered = await checkSentimentAlerts();
        if (triggered.length > 0) {
          console.log(`[Sentiment] Triggered ${triggered.length} sentiment alert(s)`);
        }
      }
    } catch (error) {
      console.error("[Sentiment] Fear & Greed error:", error instanceof Error ? error.message : error);
    }
    await new Promise(r => setTimeout(r, FEAR_GREED_INTERVAL));
  }
}

async function runSentimentLoop() {
  while (true) {
    try {
      // Get current symbols (includes user-added tokens)
      const symbols = getSentimentSymbols();
      console.log(`[Sentiment] Tracking ${symbols.length} tokens: ${symbols.join(", ")}`);
      
      const sentiments = await coingeckoSentimentClient.fetchSentimentBatch(symbols);
      for (const [symbol, data] of sentiments) {
        try {
          await publishTokenSentiment(data);
        } catch (error) {
          console.error(`[Sentiment] Failed to publish ${symbol}:`, error instanceof Error ? error.message : error);
        }
      }
      
      // Check sentiment alerts after token sentiment updates
      const triggered = await checkSentimentAlerts();
      if (triggered.length > 0) {
        console.log(`[Sentiment] Triggered ${triggered.length} sentiment alert(s)`);
      }
    } catch (error) {
      console.error("[Sentiment] Token sentiment error:", error instanceof Error ? error.message : error);
    }
    await new Promise(r => setTimeout(r, SENTIMENT_INTERVAL));
  }
}

// News feeds disabled - CryptoPanic free tier is too limited
// Widget still works for UI, but no on-chain news data
async function runNewsLoop() {
  console.log("[Sentiment] News feeds disabled - coming soon with better data source");
  return;
}

async function runNewsAggLoop() {
  console.log("[Sentiment] News aggregates disabled - coming soon");
  return;
}

export async function startSentimentPublisher() {
  const symbols = getSentimentSymbols();
  
  console.log("═".repeat(60));
  console.log("📊 Somnia DataGrid - Sentiment Publisher");
  console.log("═".repeat(60));
  console.log(`Symbols: ${symbols.join(", ")}`);
  console.log(`Fear & Greed: every ${FEAR_GREED_INTERVAL / 60000} min`);
  console.log(`Token Sentiment: every ${SENTIMENT_INTERVAL / 60000} min`);
  console.log("═".repeat(60));

  // Test connectivity
  const fgPing = await fearGreedClient.ping();

  console.log(`[Sentiment] Fear & Greed API: ${fgPing ? "✓ connected" : "✗ failed"}`);
  console.log(`[Sentiment] News feeds: Coming soon`);
  console.log(`[Sentiment] Active sentiment alerts: ${getActiveSentimentAlertCount()}`);

  // Initialize shared transaction manager (if not already done by price publisher)
  initTxManager();

  // Start all loops concurrently (news disabled for now)
  await Promise.all([
    runFearGreedLoop(),
    runSentimentLoop(),
  ]);
}
