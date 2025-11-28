/**
 * Price Publisher Service
 * 
 * Fetches prices from off-chain sources (CoinGecko) and publishes them
 * to Somnia Data Streams. Other apps can subscribe to these price feeds.
 * 
 * Flow:
 * 1. Fetch price from CoinGecko (real-time, off-chain)
 * 2. Fallback to DIA oracle if CoinGecko fails
 * 3. Encode price data using Somnia schema
 * 4. Publish to Somnia Data Streams via setAndEmitEvents
 * 5. Emit PriceUpdateV2 event for subscribers
 * 6. Check and trigger any matching price alerts
 */

import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { waitForTransactionReceipt } from "viem/actions";
import { toHex, type Hex, keccak256, toBytes } from "viem";
import { getPublicHttpClient, getWalletClient } from "../clients";
import {
  PRICE_FEED_PARENT,
  PRICE_FEED_SCHEMA,
  PRICE_FEED_SCHEMA_ID,
  PRICE_UPDATE_EVENT_ID,
  type PriceFeedData,
  type OracleSource,
} from "../schemas";
import {
  fetchAggregatedPrice,
  fetchAggregatedPrices,
  getAllSupportedSymbols,
  type PriceSourcePriority,
} from "../oracles/aggregator";
// Note: Alert checking is now handled by Workers service, not frontend

// Publisher configuration
export interface PublisherConfig {
  /** Which source to try first: OFFCHAIN_FIRST (CoinGecko) or ONCHAIN_FIRST (DIA) */
  priority: PriceSourcePriority;
  /** Enable DIA oracle as fallback */
  enableDIA: boolean;
  /** Enable Protofire oracle (currently broken) */
  enableProtofire: boolean;
  /** Enable CoinGecko off-chain fetcher */
  enableCoinGecko: boolean;
  /** Interval between publishing cycles in milliseconds */
  publishIntervalMs: number;
  /** Delay between publishing individual symbols (to avoid rate limits) */
  symbolDelayMs: number;
}

const DEFAULT_CONFIG: PublisherConfig = {
  priority: "OFFCHAIN_FIRST",
  enableDIA: true,
  enableProtofire: false,
  enableCoinGecko: true,
  publishIntervalMs: 30000, // 30 seconds - much faster than DIA's 120s
  symbolDelayMs: 500, // 500ms between symbols
};

// Default symbols to publish (these have both CoinGecko and DIA fallback)
const DEFAULT_PUBLISH_SYMBOLS = [
  "BTC", "ETH", "USDC", "USDT", "ARB", "SOL", "WETH",
];

// Store current config
let currentConfig: PublisherConfig = { ...DEFAULT_CONFIG };

function initSdk() {
  return new SDK({
    public: getPublicHttpClient(),
    wallet: getWalletClient(),
  });
}

/**
 * Update publisher configuration
 */
export function setPublisherConfig(config: Partial<PublisherConfig>) {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current publisher configuration
 */
export function getPublisherConfig(): PublisherConfig {
  return { ...currentConfig };
}

/**
 * Register the price feed schema on Somnia Data Streams
 * This is idempotent - safe to call multiple times
 */
export async function registerPriceFeedSchema(): Promise<Hex | null> {
  const sdk = initSdk();
  const schemaIdResult = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
  const schemaId = schemaIdResult as `0x${string}`;
  
  const isRegisteredResult = await sdk.streams.isDataSchemaRegistered(schemaId);
  
  // Handle case where isDataSchemaRegistered returns Error
  if (isRegisteredResult instanceof Error) {
    throw isRegisteredResult;
  }

  let txHash: Hex | null = null;

  if (!isRegisteredResult) {
    console.log("[Publisher] Registering price feed schema...");
    const result = await sdk.streams.registerDataSchemas(
      [
        {
          schemaName: PRICE_FEED_SCHEMA_ID,
          schema: PRICE_FEED_SCHEMA,
          parentSchemaId: PRICE_FEED_PARENT as `0x${string}`,
        },
      ],
      true,
    );

    if (result instanceof Error) {
      throw result;
    }

    if (!result) {
      throw new Error("Failed to register price feed schema");
    }

    txHash = result;
    await waitForTransactionReceipt(getPublicHttpClient(), { hash: txHash });
    console.log("[Publisher] Price feed schema registered:", txHash);
  } else {
    console.log("[Publisher] Price feed schema already registered");
  }

  await ensurePriceUpdateEventSchemaRegistered(sdk);
  return txHash;
}

/**
 * Ensure the PriceUpdate event schema is registered
 */
async function ensurePriceUpdateEventSchemaRegistered(sdk: SDK) {
  const eventSignature = `${PRICE_UPDATE_EVENT_ID}(bytes)`;
  const eventTopic = keccak256(toBytes(eventSignature));
  let schemaRegistered = false;

  try {
    const result = await sdk.streams.registerEventSchemas([
      {
        id: PRICE_UPDATE_EVENT_ID,
        schema: {
          eventTopic,
          params: [
            { name: "priceData", paramType: "bytes", isIndexed: false },
          ],
        },
      },
    ]);

    if (result instanceof Error) {
      const errName = (result as Error & { errorName?: string }).errorName;
      if (
        result.message.includes("EventSchemaAlreadyRegistered") ||
        errName === "EventSchemaAlreadyRegistered" ||
        result.message.includes("EventTopicAlreadyRegistered") ||
        errName === "EventTopicAlreadyRegistered"
      ) {
        schemaRegistered = true;
      } else {
        throw result;
      }
    } else if (result) {
      await waitForTransactionReceipt(getPublicHttpClient(), { hash: result });
      schemaRegistered = true;
      console.log("[Publisher] Event schema registered:", result);
    }
  } catch (error) {
    const err = error as Error & { errorName?: string };
    if (
      err instanceof Error &&
      (err.message.includes("EventSchemaAlreadyRegistered") ||
        err.errorName === "EventSchemaAlreadyRegistered" ||
        err.message.includes("EventTopicAlreadyRegistered") ||
        err.errorName === "EventTopicAlreadyRegistered")
    ) {
      schemaRegistered = true;
    } else {
      throw error;
    }
  }

  if (!schemaRegistered) {
    throw new Error("Price update event schema is not registered");
  }
}

/**
 * Fetch the best available price for a symbol using the aggregator
 */
export async function fetchBestPrice(symbol: string): Promise<PriceFeedData> {
  const price = await fetchAggregatedPrice(symbol, {
    priority: currentConfig.priority,
    enableDIA: currentConfig.enableDIA,
    enableProtofire: currentConfig.enableProtofire,
    enableCoinGecko: currentConfig.enableCoinGecko,
  });

  return {
    timestamp: price.timestamp,
    symbol: price.symbol,
    price: price.price,
    decimals: price.decimals,
    source: price.source as OracleSource,
    sourceAddress: price.sourceAddress,
  };
}

/**
 * Publish a single price to Somnia Data Streams
 */
export async function publishPrice(symbol: string): Promise<{ txHash: Hex; priceData: PriceFeedData }> {
  const priceData = await fetchBestPrice(symbol);
  const sdk = initSdk();
  const encoder = new SchemaEncoder(PRICE_FEED_SCHEMA);

  const encodedData = encoder.encodeData([
    { name: "timestamp", value: priceData.timestamp.toString(), type: "uint64" },
    { name: "symbol", value: priceData.symbol, type: "string" },
    { name: "price", value: priceData.price.toString(), type: "uint256" },
    { name: "decimals", value: priceData.decimals.toString(), type: "uint8" },
    { name: "source", value: priceData.source, type: "string" },
    { name: "sourceAddress", value: priceData.sourceAddress, type: "address" },
  ]);

  const schemaIdResult = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
  const schemaId = schemaIdResult;
  
  // Use a consistent data ID format for each symbol (allows overwriting)
  const dataId = toHex(`price-${symbol.toLowerCase()}`, { size: 32 });

  const result = await sdk.streams.setAndEmitEvents(
    [
      {
        id: dataId,
        schemaId,
        data: encodedData,
      },
    ],
    [
      {
        id: PRICE_UPDATE_EVENT_ID,
        argumentTopics: [],
        data: encodedData,
      },
    ],
  );

  if (result instanceof Error) {
    throw result;
  }

  if (!result) {
    throw new Error(`Failed to publish ${symbol} price`);
  }

  const txHash = result;
  await waitForTransactionReceipt(getPublicHttpClient(), { hash: txHash });

  // Note: Alert checking is handled by Workers service

  return { txHash, priceData };
}

/**
 * Publish prices for multiple symbols
 * Uses batch fetching from CoinGecko to avoid rate limits
 */
export async function publishAllPrices(
  symbols = DEFAULT_PUBLISH_SYMBOLS
): Promise<{ symbol: string; txHash: Hex; priceData: PriceFeedData }[]> {
  const results: { symbol: string; txHash: Hex; priceData: PriceFeedData }[] = [];

  console.log(`[Publisher] Publishing prices for ${symbols.length} symbols...`);

  // Batch fetch all prices first (more efficient, avoids rate limits)
  console.log(`[Publisher] Fetching prices in batch...`);
  const pricesMap = await fetchAggregatedPrices(symbols, {
    priority: currentConfig.priority,
    enableDIA: currentConfig.enableDIA,
    enableProtofire: currentConfig.enableProtofire,
    enableCoinGecko: currentConfig.enableCoinGecko,
  });

  console.log(`[Publisher] Fetched ${pricesMap.size}/${symbols.length} prices, now publishing...`);

  // Publish each price to the blockchain
  for (const symbol of symbols) {
    const aggregatedPrice = pricesMap.get(symbol.toUpperCase());
    if (!aggregatedPrice) {
      console.error(`[Publisher] ✗ ${symbol}: No price available`);
      continue;
    }

    try {
      const priceData: PriceFeedData = {
        timestamp: aggregatedPrice.timestamp,
        symbol: aggregatedPrice.symbol,
        price: aggregatedPrice.price,
        decimals: aggregatedPrice.decimals,
        source: aggregatedPrice.source as OracleSource,
        sourceAddress: aggregatedPrice.sourceAddress,
      };

      const txHash = await publishPriceData(priceData);
      results.push({ symbol, txHash, priceData });
      console.log(
        `[Publisher] ✓ ${symbol}: $${(Number(priceData.price) / 10 ** priceData.decimals).toFixed(2)} (${priceData.source}) - ${txHash}`
      );
      // Small delay between blockchain transactions
      await new Promise((resolve) => setTimeout(resolve, currentConfig.symbolDelayMs));
    } catch (error) {
      console.error(`[Publisher] ✗ ${symbol}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[Publisher] Published ${results.length}/${symbols.length} prices`);
  return results;
}

/**
 * Publish pre-fetched price data to Somnia Data Streams
 */
async function publishPriceData(priceData: PriceFeedData): Promise<Hex> {
  const sdk = initSdk();
  const encoder = new SchemaEncoder(PRICE_FEED_SCHEMA);

  const encodedData = encoder.encodeData([
    { name: "timestamp", value: priceData.timestamp.toString(), type: "uint64" },
    { name: "symbol", value: priceData.symbol, type: "string" },
    { name: "price", value: priceData.price.toString(), type: "uint256" },
    { name: "decimals", value: priceData.decimals.toString(), type: "uint8" },
    { name: "source", value: priceData.source, type: "string" },
    { name: "sourceAddress", value: priceData.sourceAddress, type: "address" },
  ]);

  const schemaIdResult = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
  const schemaId = schemaIdResult;

  // Use a consistent data ID format for each symbol (allows overwriting)
  const dataId = toHex(`price-${priceData.symbol.toLowerCase()}`, { size: 32 });

  const result = await sdk.streams.setAndEmitEvents(
    [
      {
        id: dataId,
        schemaId,
        data: encodedData,
      },
    ],
    [
      {
        id: PRICE_UPDATE_EVENT_ID,
        argumentTopics: [],
        data: encodedData,
      },
    ],
  );

  if (result instanceof Error) {
    throw result;
  }

  if (!result) {
    throw new Error(`Failed to publish ${priceData.symbol} price`);
  }

  const txHash = result;
  await waitForTransactionReceipt(getPublicHttpClient(), { hash: txHash });

  // Note: Alert checking is handled by Workers service

  return txHash;
}

/**
 * Start continuous price publishing loop
 */
export function startContinuousPublishing(
  symbols = DEFAULT_PUBLISH_SYMBOLS,
  intervalMs = currentConfig.publishIntervalMs
): () => void {
  const state = { running: true };

  console.log(`[Publisher] Starting continuous publishing every ${intervalMs / 1000}s`);
  console.log(`[Publisher] Symbols: ${symbols.join(", ")}`);
  console.log(`[Publisher] Priority: ${currentConfig.priority}`);

  async function loop() {
    while (state.running) {
      try {
        await publishAllPrices(symbols);
      } catch (error) {
        console.error("[Publisher] Loop error:", error);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    console.log("[Publisher] Stopped");
  }

  loop().catch((error) => console.error("[Publisher] Fatal loop error:", error));

  return () => {
    state.running = false;
  };
}

/**
 * Get all supported symbols that can be published
 */
export function getSupportedSymbols(): string[] {
  return getAllSupportedSymbols();
}

/**
 * Get the default symbols that are published
 */
export function getDefaultSymbols(): string[] {
  return [...DEFAULT_PUBLISH_SYMBOLS];
}
