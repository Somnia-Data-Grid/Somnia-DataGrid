/**
 * Sentiment Publisher Service
 * 
 * Publishes sentiment data to Somnia Data Streams:
 * - Fear & Greed Index (daily)
 * - Token Crowd Sentiment (hourly)
 * - News Events (real-time)
 * - News Aggregates (every 5-10 mins)
 * 
 * Run alongside the price publisher.
 */

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { keccak256, toBytes } from "viem";

import { fearGreedClient } from "./fear-greed.js";
import { coingeckoSentimentClient } from "./coingecko-sentiment.js";
import { cryptoPanicClient } from "./cryptopanic.js";

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

// Somnia Testnet Chain
const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
} as const;

// Config
const FEAR_GREED_INTERVAL = 60 * 60 * 1000;      // Check every hour (publishes daily)
const SENTIMENT_INTERVAL = 2 * 60 * 60 * 1000;   // Every 2 hours
const NEWS_POLL_INTERVAL = 60 * 1000;            // Every 60 seconds
const NEWS_AGG_INTERVAL = 10 * 60 * 1000;        // Every 10 minutes

const SENTIMENT_SYMBOLS = (process.env.SENTIMENT_SYMBOLS || "BTC,ETH,SOL").split(",").map(s => s.trim().toUpperCase());

function getClients() {
  const rpcUrl = process.env.RPC_URL || "https://dream-rpc.somnia.network";
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient, account };
}

// ============ Fear & Greed Publisher ============

async function publishFearGreed(sdk: SDK, data: FearGreedData): Promise<void> {
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

  const result = await sdk.streams.setAndEmitEvents(
    [{ id: dataId, schemaId, data: encodedData }],
    [{ id: FEAR_GREED_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (result instanceof Error) throw result;
  console.log(`[Sentiment] ✓ Fear & Greed: ${data.score} (${data.zone})`);
}

// ============ Token Sentiment Publisher ============

async function publishTokenSentiment(sdk: SDK, data: TokenSentimentData): Promise<void> {
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

  const result = await sdk.streams.setAndEmitEvents(
    [{ id: dataId, schemaId, data: encodedData }],
    [{ id: TOKEN_SENTIMENT_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (result instanceof Error) throw result;
  console.log(`[Sentiment] ✓ ${data.symbol}: ${data.upPercent / 100}% up, ${data.downPercent / 100}% down`);
}

// ============ News Event Publisher ============

async function publishNewsEvent(sdk: SDK, data: NewsEventData): Promise<void> {
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

  const result = await sdk.streams.setAndEmitEvents(
    [{ id: data.newsId, schemaId, data: encodedData }],
    [{ id: NEWS_EVENT_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (result instanceof Error) throw result;
  console.log(`[Sentiment] ✓ News: [${data.symbol}] ${data.title.slice(0, 50)}...`);
}

// ============ News Aggregate Publisher ============

async function publishNewsAggregate(sdk: SDK, data: NewsAggregateData): Promise<void> {
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

  const result = await sdk.streams.setAndEmitEvents(
    [{ id: dataId, schemaId, data: encodedData }],
    [{ id: NEWS_AGG_EVENT_ID, argumentTopics: [], data: encodedData }]
  );

  if (result instanceof Error) throw result;
  console.log(`[Sentiment] ✓ News Agg ${data.symbol}: score=${data.sentimentScore}, count=${data.newsCount}`);
}

// ============ Main Publisher Loop ============

let lastFearGreedScore: number | null = null;

async function runFearGreedLoop(sdk: SDK) {
  while (true) {
    try {
      const data = await fearGreedClient.fetchFearGreed();
      if (data && data.score !== lastFearGreedScore) {
        await publishFearGreed(sdk, data);
        lastFearGreedScore = data.score;
      }
    } catch (error) {
      console.error("[Sentiment] Fear & Greed error:", error);
    }
    await new Promise(r => setTimeout(r, FEAR_GREED_INTERVAL));
  }
}

async function runSentimentLoop(sdk: SDK) {
  while (true) {
    try {
      const sentiments = await coingeckoSentimentClient.fetchSentimentBatch(SENTIMENT_SYMBOLS);
      for (const [symbol, data] of sentiments) {
        try {
          await publishTokenSentiment(sdk, data);
          await new Promise(r => setTimeout(r, 1000)); // Delay between publishes
        } catch (error) {
          console.error(`[Sentiment] Failed to publish ${symbol}:`, error);
        }
      }
    } catch (error) {
      console.error("[Sentiment] Token sentiment error:", error);
    }
    await new Promise(r => setTimeout(r, SENTIMENT_INTERVAL));
  }
}

async function runNewsLoop(sdk: SDK) {
  if (!cryptoPanicClient.isEnabled()) {
    console.log("[Sentiment] CryptoPanic disabled (no API key)");
    return;
  }

  while (true) {
    try {
      const news = await cryptoPanicClient.fetchNews({ 
        currencies: SENTIMENT_SYMBOLS,
        filter: "hot",
      });
      
      for (const item of news.slice(0, 5)) { // Limit to 5 per poll
        try {
          await publishNewsEvent(sdk, item);
          await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          console.error("[Sentiment] Failed to publish news:", error);
        }
      }
    } catch (error) {
      console.error("[Sentiment] News poll error:", error);
    }
    await new Promise(r => setTimeout(r, NEWS_POLL_INTERVAL));
  }
}

async function runNewsAggLoop(sdk: SDK) {
  if (!cryptoPanicClient.isEnabled()) return;

  while (true) {
    try {
      const aggregates = cryptoPanicClient.getAllAggregates(SENTIMENT_SYMBOLS, 60);
      
      for (const [symbol, data] of aggregates) {
        try {
          await publishNewsAggregate(sdk, data);
          await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          console.error(`[Sentiment] Failed to publish news agg ${symbol}:`, error);
        }
      }
    } catch (error) {
      console.error("[Sentiment] News aggregate error:", error);
    }
    await new Promise(r => setTimeout(r, NEWS_AGG_INTERVAL));
  }
}

export async function startSentimentPublisher() {
  console.log("═".repeat(60));
  console.log("📊 Somnia DataGrid - Sentiment Publisher");
  console.log("═".repeat(60));
  console.log(`Symbols: ${SENTIMENT_SYMBOLS.join(", ")}`);
  console.log(`Fear & Greed: every ${FEAR_GREED_INTERVAL / 60000} min`);
  console.log(`Token Sentiment: every ${SENTIMENT_INTERVAL / 60000} min`);
  console.log(`News Poll: every ${NEWS_POLL_INTERVAL / 1000}s`);
  console.log(`News Aggregate: every ${NEWS_AGG_INTERVAL / 60000} min`);
  console.log("═".repeat(60));

  // Test connectivity
  const fgPing = await fearGreedClient.ping();
  const cpPing = cryptoPanicClient.isEnabled() ? await cryptoPanicClient.ping() : false;
  
  console.log(`[Sentiment] Fear & Greed API: ${fgPing ? "✓ connected" : "✗ failed"}`);
  console.log(`[Sentiment] CryptoPanic API: ${cpPing ? "✓ connected" : "✗ disabled"}`);

  const { publicClient, walletClient } = getClients();
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  // Start all loops concurrently
  await Promise.all([
    runFearGreedLoop(sdk),
    runSentimentLoop(sdk),
    runNewsLoop(sdk),
    runNewsAggLoop(sdk),
  ]);
}
