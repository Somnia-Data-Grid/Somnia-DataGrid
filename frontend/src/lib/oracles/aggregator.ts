/**
 * Price Aggregator Service
 * 
 * Fetches prices from multiple sources and provides the best available price.
 * Priority order:
 * 1. CoinGecko (off-chain, real-time, free API)
 * 2. DIA Oracle (on-chain, Somnia testnet)
 * 3. Protofire (on-chain, Somnia testnet) - currently not working
 * 
 * This aggregator ensures we always have a price, even if one source fails.
 */

import type { Address } from "viem";
import type { OracleSource } from "../schemas";
import { fetchCoinGeckoPrice, fetchCoinGeckoPrices, isCoinGeckoSupported } from "./coingecko";
import { fetchDIAPrice, fetchDIAPriceViaAdapter, getDiaKeyForSymbol, getDiaAdapterSymbol, isDIASupported } from "./dia";
import { fetchProtofirePrice, isProtofireSupported } from "./protofire";

export interface AggregatedPrice {
  symbol: string;
  price: bigint;
  decimals: number;
  timestamp: bigint;
  source: OracleSource;
  sourceAddress: Address;
  rawPrice?: number; // Human-readable price (only from CoinGecko)
}

export type PriceSourcePriority = "OFFCHAIN_FIRST" | "ONCHAIN_FIRST";

interface FetchOptions {
  priority?: PriceSourcePriority;
  enableDIA?: boolean;
  enableProtofire?: boolean;
  enableCoinGecko?: boolean;
}

const DEFAULT_OPTIONS: Required<FetchOptions> = {
  priority: "OFFCHAIN_FIRST",
  enableDIA: true,
  enableProtofire: false, // Disabled by default since it's not working
  enableCoinGecko: true,
};

/**
 * Fetch the best available price for a single symbol
 */
export async function fetchAggregatedPrice(
  symbol: string,
  options: FetchOptions = {}
): Promise<AggregatedPrice> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedSymbol = symbol.toUpperCase();
  const errors: Error[] = [];

  if (opts.priority === "OFFCHAIN_FIRST") {
    // Try CoinGecko first (real-time, off-chain)
    if (opts.enableCoinGecko && isCoinGeckoSupported(normalizedSymbol)) {
      try {
        const price = await fetchCoinGeckoPrice(normalizedSymbol);
        return {
          symbol: normalizedSymbol,
          price: price.price,
          decimals: price.decimals,
          timestamp: price.timestamp,
          source: "COINGECKO",
          sourceAddress: price.oracleAddress,
          rawPrice: price.rawPrice,
        };
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        console.warn(`[Aggregator] CoinGecko failed for ${normalizedSymbol}:`, error);
      }
    }

    // Fallback to DIA (on-chain)
    if (opts.enableDIA && isDIASupported(normalizedSymbol)) {
      try {
        const diaKey = getDiaKeyForSymbol(normalizedSymbol);
        if (diaKey) {
          const price = await fetchDIAPrice(diaKey);
          return {
            symbol: normalizedSymbol,
            price: price.price,
            decimals: price.decimals,
            timestamp: price.timestamp,
            source: "DIA",
            sourceAddress: price.oracleAddress,
          };
        }

        const diaAdapterSymbol = getDiaAdapterSymbol(normalizedSymbol);
        if (diaAdapterSymbol) {
          const price = await fetchDIAPriceViaAdapter(diaAdapterSymbol);
          return {
            symbol: normalizedSymbol,
            price: price.price,
            decimals: price.decimals,
            timestamp: price.timestamp,
            source: "DIA",
            sourceAddress: price.oracleAddress,
          };
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        console.warn(`[Aggregator] DIA failed for ${normalizedSymbol}:`, error);
      }
    }

    // Last resort: Protofire (currently broken)
    const protofireKey = `${normalizedSymbol}/USD` as const;
    if (opts.enableProtofire && isProtofireSupported(protofireKey)) {
      try {
        const price = await fetchProtofirePrice(protofireKey);
        return {
          symbol: normalizedSymbol,
          price: price.price,
          decimals: price.decimals,
          timestamp: price.timestamp,
          source: "PROTOFIRE",
          sourceAddress: price.oracleAddress,
        };
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        console.warn(`[Aggregator] Protofire failed for ${normalizedSymbol}:`, error);
      }
    }
  } else {
    // ONCHAIN_FIRST priority
    // Try DIA first
    if (opts.enableDIA && isDIASupported(normalizedSymbol)) {
      try {
        const diaKey = getDiaKeyForSymbol(normalizedSymbol);
        if (diaKey) {
          const price = await fetchDIAPrice(diaKey);
          return {
            symbol: normalizedSymbol,
            price: price.price,
            decimals: price.decimals,
            timestamp: price.timestamp,
            source: "DIA",
            sourceAddress: price.oracleAddress,
          };
        }

        const diaAdapterSymbol = getDiaAdapterSymbol(normalizedSymbol);
        if (diaAdapterSymbol) {
          const price = await fetchDIAPriceViaAdapter(diaAdapterSymbol);
          return {
            symbol: normalizedSymbol,
            price: price.price,
            decimals: price.decimals,
            timestamp: price.timestamp,
            source: "DIA",
            sourceAddress: price.oracleAddress,
          };
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        console.warn(`[Aggregator] DIA failed for ${normalizedSymbol}:`, error);
      }
    }

    // Fallback to CoinGecko
    if (opts.enableCoinGecko && isCoinGeckoSupported(normalizedSymbol)) {
      try {
        const price = await fetchCoinGeckoPrice(normalizedSymbol);
        return {
          symbol: normalizedSymbol,
          price: price.price,
          decimals: price.decimals,
          timestamp: price.timestamp,
          source: "COINGECKO",
          sourceAddress: price.oracleAddress,
          rawPrice: price.rawPrice,
        };
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        console.warn(`[Aggregator] CoinGecko failed for ${normalizedSymbol}:`, error);
      }
    }
  }

  // No source available
  const errorMessages = errors.map((e) => e.message).join("; ");
  throw new Error(`No price source available for ${normalizedSymbol}. Errors: ${errorMessages}`);
}

/**
 * Fetch prices for multiple symbols efficiently
 * Uses batch API for CoinGecko when possible
 */
export async function fetchAggregatedPrices(
  symbols: string[],
  options: FetchOptions = {}
): Promise<Map<string, AggregatedPrice>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results = new Map<string, AggregatedPrice>();
  const normalizedSymbols = symbols.map((s) => s.toUpperCase());
  const remaining = new Set(normalizedSymbols);

  if (opts.priority === "OFFCHAIN_FIRST" && opts.enableCoinGecko) {
    // Batch fetch from CoinGecko
    const coinGeckoSymbols = normalizedSymbols.filter(isCoinGeckoSupported);
    if (coinGeckoSymbols.length > 0) {
      try {
        const coinGeckoPrices = await fetchCoinGeckoPrices(coinGeckoSymbols);
        for (const [symbol, price] of coinGeckoPrices) {
          results.set(symbol, {
            symbol,
            price: price.price,
            decimals: price.decimals,
            timestamp: price.timestamp,
            source: "COINGECKO",
            sourceAddress: price.oracleAddress,
            rawPrice: price.rawPrice,
          });
          remaining.delete(symbol);
        }
      } catch (error) {
        console.warn("[Aggregator] CoinGecko batch fetch failed:", error);
      }
    }
  }

  // Fetch remaining symbols individually with fallback
  for (const symbol of remaining) {
    try {
      const price = await fetchAggregatedPrice(symbol, opts);
      results.set(symbol, price);
    } catch (error) {
      console.error(`[Aggregator] Failed to fetch price for ${symbol}:`, error);
    }
  }

  return results;
}

/**
 * Get all symbols supported by any source
 */
export function getAllSupportedSymbols(): string[] {
  const symbols = new Set<string>();

  // CoinGecko symbols
  const coinGeckoSymbols = [
    "BTC", "ETH", "USDC", "USDT", "ARB", "SOL", "WETH", "SOMI",
    "MATIC", "AVAX", "LINK", "UNI", "AAVE", "CRV", "MKR", "COMP",
    "SNX", "DOGE", "SHIB", "PEPE", "XRP", "ADA", "DOT", "ATOM",
    "NEAR", "FTM", "OP", "APT", "SUI", "SEI"
  ];
  coinGeckoSymbols.forEach((s) => symbols.add(s));

  // DIA symbols
  ["BTC", "USDT", "USDC", "ARB", "SOL", "WETH", "SOMI"].forEach((s) => symbols.add(s));

  return Array.from(symbols).sort();
}

/**
 * Check if a symbol is supported by any source
 */
export function isSymbolSupported(symbol: string): boolean {
  const normalized = symbol.toUpperCase();
  return (
    isCoinGeckoSupported(normalized) ||
    isDIASupported(normalized) ||
    isProtofireSupported(`${normalized}/USD`)
  );
}

