/**
 * Off-chain price fetcher using CoinGecko's free API
 * CoinGecko free tier: 10-30 calls/minute, no API key required for simple endpoints
 * Docs: https://docs.coingecko.com/reference/simple-price
 */

import type { Address } from "viem";

// Map our internal symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  ARB: "arbitrum",
  SOL: "solana",
  WETH: "weth",
  SOMI: "somnia", // May not exist on CoinGecko yet
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  CRV: "curve-dao-token",
  MKR: "maker",
  COMP: "compound-governance-token",
  SNX: "synthetix-network-token",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  XRP: "ripple",
  ADA: "cardano",
  DOT: "polkadot",
  ATOM: "cosmos",
  NEAR: "near",
  FTM: "fantom",
  OP: "optimism",
  APT: "aptos",
  SUI: "sui",
  SEI: "sei-network",
};

// Reverse mapping for lookup
const COINGECKO_ID_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(COINGECKO_IDS).map(([symbol, id]) => [id, symbol])
);

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

// We use 8 decimals to match DIA oracle format
const PRICE_DECIMALS = 8;

// Placeholder address for off-chain data (we're the source)
const OFFCHAIN_SOURCE_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export interface OffchainPrice {
  symbol: string;
  price: bigint;
  decimals: number;
  timestamp: bigint;
  oracleAddress: Address;
  source: "COINGECKO";
  rawPrice: number; // Human-readable price for debugging
}

export interface CoinGeckoResponse {
  [id: string]: {
    usd: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  };
}

/**
 * Fetch a single price from CoinGecko
 */
export async function fetchCoinGeckoPrice(symbol: string): Promise<OffchainPrice> {
  const coingeckoId = COINGECKO_IDS[symbol.toUpperCase()];
  if (!coingeckoId) {
    throw new Error(`Symbol ${symbol} not supported by CoinGecko fetcher`);
  }

  const url = `${COINGECKO_API_BASE}/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_last_updated_at=true`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    // Add cache control to avoid stale data
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(`CoinGecko rate limit exceeded for ${symbol}`);
    }
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }

  const data: CoinGeckoResponse = await response.json();
  const priceData = data[coingeckoId];

  if (!priceData || typeof priceData.usd !== "number") {
    throw new Error(`No price data returned for ${symbol}`);
  }

  // Convert to integer with 8 decimals (matching DIA format)
  const priceInDecimals = BigInt(Math.round(priceData.usd * 10 ** PRICE_DECIMALS));
  const timestamp = priceData.last_updated_at
    ? BigInt(priceData.last_updated_at)
    : BigInt(Math.floor(Date.now() / 1000));

  return {
    symbol: symbol.toUpperCase(),
    price: priceInDecimals,
    decimals: PRICE_DECIMALS,
    timestamp,
    oracleAddress: OFFCHAIN_SOURCE_ADDRESS,
    source: "COINGECKO",
    rawPrice: priceData.usd,
  };
}

/**
 * Fetch multiple prices in a single API call (more efficient)
 */
export async function fetchCoinGeckoPrices(symbols: string[]): Promise<Map<string, OffchainPrice>> {
  const validSymbols = symbols.filter((s) => COINGECKO_IDS[s.toUpperCase()]);
  if (validSymbols.length === 0) {
    return new Map();
  }

  const ids = validSymbols.map((s) => COINGECKO_IDS[s.toUpperCase()]).join(",");
  const url = `${COINGECKO_API_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("CoinGecko rate limit exceeded");
    }
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }

  const data: CoinGeckoResponse = await response.json();
  const results = new Map<string, OffchainPrice>();

  for (const [id, priceData] of Object.entries(data)) {
    if (!priceData || typeof priceData.usd !== "number") continue;

    const symbol = COINGECKO_ID_TO_SYMBOL[id];
    if (!symbol) continue;

    const priceInDecimals = BigInt(Math.round(priceData.usd * 10 ** PRICE_DECIMALS));
    const timestamp = priceData.last_updated_at
      ? BigInt(priceData.last_updated_at)
      : BigInt(Math.floor(Date.now() / 1000));

    results.set(symbol, {
      symbol,
      price: priceInDecimals,
      decimals: PRICE_DECIMALS,
      timestamp,
      oracleAddress: OFFCHAIN_SOURCE_ADDRESS,
      source: "COINGECKO",
      rawPrice: priceData.usd,
    });
  }

  return results;
}

/**
 * Check if a symbol is supported by CoinGecko
 */
export function isCoinGeckoSupported(symbol: string): boolean {
  return Boolean(COINGECKO_IDS[symbol.toUpperCase()]);
}

/**
 * Get all supported symbols
 */
export function getSupportedCoinGeckoSymbols(): string[] {
  return Object.keys(COINGECKO_IDS);
}

/**
 * Get CoinGecko ID for a symbol
 */
export function getCoinGeckoId(symbol: string): string | undefined {
  return COINGECKO_IDS[symbol.toUpperCase()];
}

