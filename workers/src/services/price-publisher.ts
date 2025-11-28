/**
 * Price Publisher Service
 *
 * Fetches prices from multiple sources and publishes to Somnia Data Streams:
 * - CoinGecko: BTC, ETH, USDC, USDT, ARB, SOL, etc.
 * - DIA Oracle: STT (Somnia native), SOMI, and fallback for others
 *
 * Run with: npm run publisher
 * Run once: npm run publisher:once
 */

import "dotenv/config";
import { type Hex } from "viem";
import { SchemaEncoder } from "@somnia-chain/streams";
import { getDb, closeDb, insertPriceRecord } from "../db/client.js";
import { coingeckoClient, COINGECKO_IDS } from "./coingecko.js";
import { diaClient, DIA_ONLY_ASSETS, DIA_ASSET_KEYS } from "./dia.js";
import { checkAndTriggerAlerts, getActiveAlertCount } from "./alert-checker.js";
import { initTxManager, getSDK, queueSetAndEmitEvents } from "./tx-manager.js";

// Schemas
const PRICE_FEED_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
const PRICE_UPDATE_EVENT_ID = "PriceUpdateV2";

const PRICE_DECIMALS = 8;
const OFFCHAIN_SOURCE = "0x0000000000000000000000000000000000000000" as const;
const DIA_ORACLE_ADDRESS = "0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D" as const;

// Config
const PUBLISH_INTERVAL = parseInt(process.env.PUBLISH_INTERVAL_MS || "30000", 10);
const SYMBOLS = (process.env.SYMBOLS || "BTC,ETH,USDC,USDT,STT").split(",").map(s => s.trim().toUpperCase());

// Fetch prices from all sources
async function fetchAllPrices(symbols: string[]): Promise<Map<string, { price: bigint; timestamp: bigint; source: string }>> {
  const results = new Map<string, { price: bigint; timestamp: bigint; source: string }>();

  // Separate symbols by source
  const diaOnlySymbols = symbols.filter(s => DIA_ONLY_ASSETS.includes(s));
  const coingeckoSymbols = symbols.filter(s => COINGECKO_IDS[s] && !DIA_ONLY_ASSETS.includes(s));
  const diaFallbackSymbols = symbols.filter(s => !COINGECKO_IDS[s] && DIA_ASSET_KEYS[s] && !DIA_ONLY_ASSETS.includes(s));

  // Fetch from CoinGecko first (primary source for most assets)
  if (coingeckoSymbols.length > 0) {
    try {
      const cgPrices = await coingeckoClient.fetchPrices(coingeckoSymbols);
      for (const [symbol, data] of cgPrices) {
        results.set(symbol, { ...data, source: "COINGECKO" });
      }
    } catch (error) {
      console.error("[Publisher] CoinGecko fetch failed:", error);
    }
  }

  // Fetch DIA-only assets (STT, SOMI)
  if (diaOnlySymbols.length > 0 && diaClient.isEnabled()) {
    try {
      const diaPrices = await diaClient.fetchPrices(diaOnlySymbols);
      for (const [symbol, data] of diaPrices) {
        results.set(symbol, { ...data, source: "DIA" });
      }
    } catch (error) {
      console.error("[Publisher] DIA fetch failed:", error);
    }
  }

  // Fetch DIA fallback for assets not on CoinGecko
  if (diaFallbackSymbols.length > 0 && diaClient.isEnabled()) {
    try {
      const diaPrices = await diaClient.fetchPrices(diaFallbackSymbols);
      for (const [symbol, data] of diaPrices) {
        if (!results.has(symbol)) {
          results.set(symbol, { ...data, source: "DIA" });
        }
      }
    } catch (error) {
      console.error("[Publisher] DIA fallback fetch failed:", error);
    }
  }

  // Try DIA as fallback for any CoinGecko failures
  const missingSymbols = coingeckoSymbols.filter(s => !results.has(s) && DIA_ASSET_KEYS[s]);
  if (missingSymbols.length > 0 && diaClient.isEnabled()) {
    console.log(`[Publisher] Trying DIA fallback for: ${missingSymbols.join(", ")}`);
    try {
      const diaPrices = await diaClient.fetchPrices(missingSymbols);
      for (const [symbol, data] of diaPrices) {
        results.set(symbol, { ...data, source: "DIA" });
      }
    } catch (error) {
      console.error("[Publisher] DIA fallback failed:", error);
    }
  }

  return results;
}

// Check and trigger alerts (reads from SQLite)
async function checkAlerts(symbol: string, currentPrice: bigint): Promise<string[]> {
  try {
    return await checkAndTriggerAlerts(symbol, currentPrice);
  } catch (error) {
    console.error(`[Publisher] Alert check failed for ${symbol}:`, error);
    return [];
  }
}

// Publish prices to Somnia
async function publishPrices(symbols: string[]): Promise<void> {
  console.log(`\n[Publisher] Fetching prices for ${symbols.join(", ")}...`);

  // Log API status
  const keyStatus = coingeckoClient.getKeyStatus();
  if (keyStatus.total > 0) {
    console.log(`[Publisher] CoinGecko: ${keyStatus.healthy}/${keyStatus.total} keys healthy`);
  }
  if (diaClient.isEnabled()) {
    console.log(`[Publisher] DIA Oracle: enabled`);
  }

  const sdk = getSDK();
  const encoder = new SchemaEncoder(PRICE_FEED_SCHEMA);

  // Fetch all prices from all sources
  const prices = await fetchAllPrices(symbols);
  console.log(`[Publisher] Total prices fetched: ${prices.size}/${symbols.length}`);

  // Get schema ID
  const schemaIdResult = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);
  if (schemaIdResult instanceof Error) throw schemaIdResult;
  const schemaId = schemaIdResult as `0x${string}`;

  // Publish each price (queued to avoid nonce conflicts)
  for (const [symbol, { price, timestamp, source }] of prices) {
    try {
      const priceFormatted = (Number(price) / 10 ** PRICE_DECIMALS).toFixed(2);
      const sourceAddress = source === "DIA" ? DIA_ORACLE_ADDRESS : OFFCHAIN_SOURCE;

      const encodedData = encoder.encodeData([
        { name: "timestamp", value: timestamp.toString(), type: "uint64" },
        { name: "symbol", value: symbol, type: "string" },
        { name: "price", value: price.toString(), type: "uint256" },
        { name: "decimals", value: PRICE_DECIMALS.toString(), type: "uint8" },
        { name: "source", value: source, type: "string" },
        { name: "sourceAddress", value: sourceAddress, type: "address" },
      ]);

      const dataId = `0x${Buffer.from(`price-${symbol.toLowerCase()}`).toString("hex").padEnd(64, "0")}` as Hex;

      // Use queued transaction to avoid nonce conflicts with other publishers
      const result = await queueSetAndEmitEvents(
        `price-${symbol}`,
        [{ id: dataId, schemaId, data: encodedData }],
        [{ id: PRICE_UPDATE_EVENT_ID, argumentTopics: [], data: encodedData }]
      );

      if (!result) throw new Error("No transaction hash returned");

      console.log(`[Publisher] ✓ ${symbol}: $${priceFormatted} (${source})`);

      // Store in local DB for history
      insertPriceRecord({
        symbol,
        price: price.toString(),
        decimals: PRICE_DECIMALS,
        source,
        timestamp: Number(timestamp),
      });

      // Check alerts (non-blocking)
      checkAlerts(symbol, price).then(triggered => {
        if (triggered.length > 0) {
          console.log(`[Publisher] 🔔 ${triggered.length} alert(s) triggered for ${symbol}`);
        }
      }).catch(err => {
        console.error(`[Publisher] Alert check error for ${symbol}:`, err);
      });

    } catch (error) {
      console.error(`[Publisher] ✗ ${symbol}:`, error instanceof Error ? error.message : error);
    }
  }
}

// Main loop
async function main() {
  const runOnce = process.argv.includes("--once");

  console.log("═".repeat(60));
  console.log("🚀 Somnia Price Publisher");
  console.log("═".repeat(60));
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Interval: ${PUBLISH_INTERVAL / 1000}s`);
  console.log(`Mode: ${runOnce ? "Single run" : "Continuous"}`);

  // Show source breakdown
  const cgSymbols = SYMBOLS.filter(s => COINGECKO_IDS[s] && !DIA_ONLY_ASSETS.includes(s));
  const diaSymbols = SYMBOLS.filter(s => DIA_ONLY_ASSETS.includes(s) || (!COINGECKO_IDS[s] && DIA_ASSET_KEYS[s]));
  const unsupported = SYMBOLS.filter(s => !COINGECKO_IDS[s] && !DIA_ASSET_KEYS[s]);

  if (cgSymbols.length > 0) console.log(`  CoinGecko: ${cgSymbols.join(", ")}`);
  if (diaSymbols.length > 0) console.log(`  DIA Oracle: ${diaSymbols.join(", ")}`);
  if (unsupported.length > 0) console.log(`  ⚠️ Unsupported: ${unsupported.join(", ")}`);
  console.log("═".repeat(60));

  // Initialize shared transaction manager
  initTxManager();

  // Test connectivity
  const cgPing = await coingeckoClient.ping();
  const diaPing = diaClient.isEnabled() ? await diaClient.ping() : false;

  console.log(`[Publisher] CoinGecko: ${cgPing ? "✓ connected" : "✗ failed"}`);
  if (diaClient.isEnabled()) {
    console.log(`[Publisher] DIA Oracle: ${diaPing ? "✓ connected" : "✗ failed"}`);
  }

  // Check active alerts count
  try {
    const alertCount = getActiveAlertCount();
    console.log(`[Publisher] Active alerts in DB: ${alertCount}`);
  } catch (error) {
    console.warn(`[Publisher] Could not fetch alert count:`, error instanceof Error ? error.message : error);
  }

  // Initialize DB
  getDb();

  if (runOnce) {
    await publishPrices(SYMBOLS);
    closeDb();
    return;
  }

  // Continuous loop
  let running = true;

  process.on("SIGINT", () => {
    console.log("\n[Publisher] Shutting down...");
    running = false;
    closeDb();
    process.exit(0);
  });

  while (running) {
    try {
      await publishPrices(SYMBOLS);
    } catch (error) {
      console.error("[Publisher] Error:", error);
    }

    console.log(`[Publisher] Next update in ${PUBLISH_INTERVAL / 1000}s...`);
    await new Promise(r => setTimeout(r, PUBLISH_INTERVAL));
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  closeDb();
  process.exit(1);
});
