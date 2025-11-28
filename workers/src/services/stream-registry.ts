/**
 * Stream Registry Service
 * 
 * Central registry for all DataGrid streams. Allows dynamic addition of tokens
 * and provides metadata for developers integrating with the DataGrid.
 * 
 * Streams are organized by type:
 * - PRICE: Real-time price feeds
 * - SENTIMENT: Token crowd sentiment
 * - FEAR_GREED: Market fear & greed index
 * - NEWS: Crypto news events
 * 
 * Developers can:
 * 1. Query available streams
 * 2. Request new tokens to be added
 * 3. Subscribe to streams via WebSocket
 */

import { getDb } from "../db/client.js";

// Stream types
export type StreamType = "PRICE" | "SENTIMENT" | "FEAR_GREED" | "NEWS" | "NEWS_AGG";

// Stream metadata
export interface StreamInfo {
  id: string;
  type: StreamType;
  symbol: string;
  name: string;
  description: string;
  eventId: string;
  schema: string;
  updateInterval: number; // seconds
  sources: string[];
  isActive: boolean;
  addedAt: number;
}

// Default supported tokens (always available)
export const DEFAULT_PRICE_TOKENS: Record<string, { name: string; coingeckoId?: string; diaKey?: string }> = {
  BTC: { name: "Bitcoin", coingeckoId: "bitcoin" },
  ETH: { name: "Ethereum", coingeckoId: "ethereum" },
  USDC: { name: "USD Coin", coingeckoId: "usd-coin" },
  USDT: { name: "Tether", coingeckoId: "tether" },
  SOL: { name: "Solana", coingeckoId: "solana" },
  ARB: { name: "Arbitrum", coingeckoId: "arbitrum" },
  LINK: { name: "Chainlink", coingeckoId: "chainlink" },
  UNI: { name: "Uniswap", coingeckoId: "uniswap" },
  AAVE: { name: "Aave", coingeckoId: "aave" },
  AVAX: { name: "Avalanche", coingeckoId: "avalanche-2" },
  MATIC: { name: "Polygon", coingeckoId: "matic-network" },
  STT: { name: "Somnia Testnet", diaKey: "STT/USD" },
};

// Event IDs and schemas (for documentation)
export const STREAM_SCHEMAS = {
  PRICE: {
    eventId: "PriceUpdateV2",
    schema: "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress",
    description: "Real-time price updates with 8 decimal precision",
  },
  SENTIMENT: {
    eventId: "TokenSentimentV1",
    schema: "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source",
    description: "Crowd sentiment data showing bullish/bearish percentages",
  },
  FEAR_GREED: {
    eventId: "FearGreedV1",
    schema: "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate",
    description: "Market fear & greed index (0-100 scale)",
  },
  NEWS: {
    eventId: "NewsEventV1",
    schema: "bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp",
    description: "Individual crypto news events with sentiment analysis",
  },
  NEWS_AGG: {
    eventId: "NewsAggregateV1",
    schema: "uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd",
    description: "Aggregated news sentiment over time windows",
  },
};

// Database table for custom streams
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS stream_registry (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  coingecko_id TEXT,
  dia_key TEXT,
  is_active INTEGER DEFAULT 1,
  requested_by TEXT,
  added_at INTEGER NOT NULL,
  last_update INTEGER,
  UNIQUE(type, symbol)
);

CREATE INDEX IF NOT EXISTS idx_stream_registry_type ON stream_registry(type);
CREATE INDEX IF NOT EXISTS idx_stream_registry_symbol ON stream_registry(symbol);
CREATE INDEX IF NOT EXISTS idx_stream_registry_active ON stream_registry(is_active) WHERE is_active = 1;
`;

// Initialize the registry table
export function initStreamRegistry(): void {
  const db = getDb();
  db.exec(INIT_SQL);
  
  // Seed default tokens
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO stream_registry (id, type, symbol, name, coingecko_id, dia_key, is_active, added_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  
  const now = Math.floor(Date.now() / 1000);
  
  for (const [symbol, info] of Object.entries(DEFAULT_PRICE_TOKENS)) {
    stmt.run(`price-${symbol.toLowerCase()}`, "PRICE", symbol, info.name, info.coingeckoId || null, info.diaKey || null, now);
  }
  
  console.log(`[StreamRegistry] Initialized with ${Object.keys(DEFAULT_PRICE_TOKENS).length} default tokens`);
}

// Get all active streams
export function getActiveStreams(type?: StreamType): StreamInfo[] {
  const db = getDb();
  
  let sql = `SELECT * FROM stream_registry WHERE is_active = 1`;
  const params: any[] = [];
  
  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  
  sql += ` ORDER BY symbol`;
  
  const rows = db.prepare(sql).all(...params) as any[];
  
  return rows.map(row => ({
    id: row.id,
    type: row.type as StreamType,
    symbol: row.symbol,
    name: row.name,
    description: STREAM_SCHEMAS[row.type as keyof typeof STREAM_SCHEMAS]?.description || "",
    eventId: STREAM_SCHEMAS[row.type as keyof typeof STREAM_SCHEMAS]?.eventId || "",
    schema: STREAM_SCHEMAS[row.type as keyof typeof STREAM_SCHEMAS]?.schema || "",
    updateInterval: row.type === "PRICE" ? 30 : row.type === "SENTIMENT" ? 120 : 60,
    sources: row.coingecko_id ? ["CoinGecko"] : row.dia_key ? ["DIA"] : [],
    isActive: row.is_active === 1,
    addedAt: row.added_at,
  }));
}

// Get symbols for a stream type
export function getActiveSymbols(type: StreamType): string[] {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT symbol FROM stream_registry WHERE type = ? AND is_active = 1`).all(type) as any[];
    return rows.map(r => r.symbol);
  } catch {
    // Fallback to default symbols if registry not initialized
    if (type === "PRICE") {
      return ["BTC", "ETH", "USDC", "USDT", "STT"];
    }
    if (type === "SENTIMENT") {
      return ["BTC", "ETH", "SOL"];
    }
    return [];
  }
}

// Check if a token is supported
export function isTokenSupported(symbol: string, type: StreamType = "PRICE"): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT 1 FROM stream_registry WHERE symbol = ? AND type = ? AND is_active = 1`).get(symbol.toUpperCase(), type);
  return !!row;
}

// Request a new token to be added
export interface TokenRequest {
  symbol: string;
  name: string;
  coingeckoId?: string;
  diaKey?: string;
  requestedBy?: string;
}

export function requestToken(request: TokenRequest, type: StreamType = "PRICE"): { success: boolean; message: string } {
  const db = getDb();
  const symbol = request.symbol.toUpperCase();
  
  // Check if already exists
  const existing = db.prepare(`SELECT * FROM stream_registry WHERE symbol = ? AND type = ?`).get(symbol, type) as any;
  
  if (existing) {
    if (existing.is_active) {
      return { success: false, message: `Token ${symbol} is already active for ${type} streams` };
    }
    // Reactivate
    db.prepare(`UPDATE stream_registry SET is_active = 1 WHERE id = ?`).run(existing.id);
    return { success: true, message: `Token ${symbol} reactivated for ${type} streams` };
  }
  
  // Validate that we can actually fetch data for this token
  if (type === "PRICE" && !request.coingeckoId && !request.diaKey) {
    return { success: false, message: `Token ${symbol} requires either coingeckoId or diaKey for price feeds` };
  }
  
  // Add new token
  const id = `${type.toLowerCase()}-${symbol.toLowerCase()}`;
  const now = Math.floor(Date.now() / 1000);
  
  db.prepare(`
    INSERT INTO stream_registry (id, type, symbol, name, coingecko_id, dia_key, is_active, requested_by, added_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, type, symbol, request.name, request.coingeckoId || null, request.diaKey || null, request.requestedBy || null, now);
  
  console.log(`[StreamRegistry] Added new ${type} stream for ${symbol}`);
  return { success: true, message: `Token ${symbol} added to ${type} streams` };
}

// Disable a token stream
export function disableToken(symbol: string, type: StreamType = "PRICE"): boolean {
  const db = getDb();
  const result = db.prepare(`UPDATE stream_registry SET is_active = 0 WHERE symbol = ? AND type = ?`).run(symbol.toUpperCase(), type);
  return result.changes > 0;
}

// Get CoinGecko ID for a symbol
export function getCoingeckoId(symbol: string): string | null {
  const db = getDb();
  const row = db.prepare(`SELECT coingecko_id FROM stream_registry WHERE symbol = ? AND coingecko_id IS NOT NULL`).get(symbol.toUpperCase()) as any;
  return row?.coingecko_id || null;
}

// Get DIA key for a symbol
export function getDiaKey(symbol: string): string | null {
  const db = getDb();
  const row = db.prepare(`SELECT dia_key FROM stream_registry WHERE symbol = ? AND dia_key IS NOT NULL`).get(symbol.toUpperCase()) as any;
  return row?.dia_key || null;
}

// Get all CoinGecko IDs as a map (for batch fetching)
export function getAllCoingeckoIds(): Record<string, string> {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT symbol, coingecko_id FROM stream_registry WHERE coingecko_id IS NOT NULL AND is_active = 1`).all() as any[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.symbol] = row.coingecko_id;
    }
    return result;
  } catch {
    // Fallback to default tokens if registry not initialized
    return {
      BTC: "bitcoin",
      ETH: "ethereum",
      USDC: "usd-coin",
      USDT: "tether",
      SOL: "solana",
      ARB: "arbitrum",
    };
  }
}

// Get stream documentation for developers
export function getStreamDocumentation(): object {
  return {
    version: "1.0.0",
    description: "Somnia DataGrid - Real-time on-chain data streams",
    websocket: {
      url: "wss://dream-rpc.somnia.network/ws",
      protocol: "Somnia Data Streams SDK",
    },
    streams: Object.entries(STREAM_SCHEMAS)
      .filter(([type]) => !["NEWS", "NEWS_AGG"].includes(type)) // Hide news streams (coming soon)
      .map(([type, info]) => ({
        type,
        eventId: info.eventId,
        schema: info.schema,
        description: info.description,
        activeTokens: getActiveSymbols(type as StreamType),
      })),
    integration: {
      npm: "@somnia-chain/streams",
      example: `
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";

const client = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket("wss://dream-rpc.somnia.network/ws"),
});

const sdk = new SDK({ public: client });

// Subscribe to price updates
await sdk.streams.subscribe({
  somniaStreamsEventId: "PriceUpdateV2",
  onData: (data) => {
    const encoder = new SchemaEncoder("uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress");
    const decoded = encoder.decodeData(data);
    console.log("Price update:", decoded);
  },
});
      `.trim(),
    },
    requestNewToken: {
      endpoint: "POST /api/streams/request",
      body: {
        symbol: "TOKEN",
        name: "Token Name",
        coingeckoId: "coingecko-id (optional)",
        type: "PRICE | SENTIMENT",
      },
    },
  };
}
