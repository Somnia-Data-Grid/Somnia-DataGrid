/**
 * Token Registry Service
 * 
 * Manages the list of tokens to track for sentiment/news.
 * Combines default tokens from env with user-selected tokens from DB.
 */

import { 
  addTrackedToken as dbAddTrackedToken, 
  removeTrackedToken as dbRemoveTrackedToken, 
  getTrackedTokens as dbGetTrackedTokens,
  type TrackedToken 
} from "../db/client.js";

// CoinGecko coin list cache
let coinListCache: CoinGeckoListItem[] = [];
let coinListFetchedAt = 0;
const COIN_LIST_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface CoinGeckoListItem {
  id: string;
  symbol: string;
  name: string;
}

// Default tokens from environment
function getDefaultTokens(): string[] {
  const envTokens = process.env.SENTIMENT_SYMBOLS || "BTC,ETH,SOL";
  return envTokens.split(",").map(s => s.trim().toUpperCase());
}

// CoinGecko symbol to ID mapping (common tokens)
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDC: "usd-coin",
  USDT: "tether",
  ARB: "arbitrum",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  XRP: "ripple",
  ADA: "cardano",
  DOT: "polkadot",
  ATOM: "cosmos",
  NEAR: "near",
  OP: "optimism",
  APT: "aptos",
  SUI: "sui",
  SEI: "sei-network",
  PEPE: "pepe",
  WIF: "dogwifcoin",
  BONK: "bonk",
};

/**
 * Fetch full coin list from CoinGecko (cached)
 */
export async function fetchCoinList(): Promise<CoinGeckoListItem[]> {
  const now = Date.now();
  
  if (coinListCache.length > 0 && now - coinListFetchedAt < COIN_LIST_CACHE_DURATION) {
    return coinListCache;
  }

  try {
    console.log("[TokenRegistry] Fetching CoinGecko coin list...");
    
    const apiKey = process.env.COINGECKO_API_KEY_1;
    const url = new URL("https://api.coingecko.com/api/v3/coins/list");
    if (apiKey) {
      url.searchParams.set("x_cg_demo_api_key", apiKey);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: CoinGeckoListItem[] = await response.json();
    coinListCache = data;
    coinListFetchedAt = now;
    
    console.log(`[TokenRegistry] Cached ${data.length} coins`);
    return data;

  } catch (error) {
    console.error("[TokenRegistry] Failed to fetch coin list:", error);
    return coinListCache; // Return stale cache on error
  }
}

/**
 * Search for tokens by name or symbol
 */
export async function searchTokens(query: string, limit = 20): Promise<CoinGeckoListItem[]> {
  const coins = await fetchCoinList();
  const q = query.toLowerCase();
  
  // Score-based search
  const scored = coins
    .map(coin => {
      let score = 0;
      const symbol = coin.symbol.toLowerCase();
      const name = coin.name.toLowerCase();
      
      // Exact symbol match = highest score
      if (symbol === q) score = 100;
      // Symbol starts with query
      else if (symbol.startsWith(q)) score = 80;
      // Name starts with query
      else if (name.startsWith(q)) score = 60;
      // Symbol contains query
      else if (symbol.includes(q)) score = 40;
      // Name contains query
      else if (name.includes(q)) score = 20;
      
      return { coin, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ coin }) => coin);

  return scored;
}

/**
 * Get CoinGecko ID for a symbol
 */
export async function getCoinGeckoId(symbol: string): Promise<string | null> {
  const upper = symbol.toUpperCase();
  
  // Check known mapping first
  if (SYMBOL_TO_COINGECKO[upper]) {
    return SYMBOL_TO_COINGECKO[upper];
  }
  
  // Search in coin list
  const coins = await fetchCoinList();
  const match = coins.find(c => c.symbol.toUpperCase() === upper);
  return match?.id || null;
}

/**
 * Add a token to tracking (user-selected)
 */
export function addTrackedToken(coinId: string, symbol: string, name: string, addedBy: string): TrackedToken {
  return dbAddTrackedToken(coinId, symbol, name, addedBy);
}

/**
 * Remove a token from tracking for a specific user
 */
export function removeTrackedToken(coinId: string, wallet: string): boolean {
  return dbRemoveTrackedToken(coinId, wallet);
}

/**
 * Get all active tracked tokens (system + user's own if wallet provided)
 */
export function getTrackedTokens(wallet?: string): TrackedToken[] {
  return dbGetTrackedTokens(wallet);
}

/**
 * Get all symbols to track (default + user-selected)
 */
export async function getAllTrackedSymbols(): Promise<Array<{ symbol: string; coinId: string }>> {
  const result: Array<{ symbol: string; coinId: string }> = [];
  const seen = new Set<string>();

  // Add default tokens
  const defaults = getDefaultTokens();
  for (const symbol of defaults) {
    const coinId = await getCoinGeckoId(symbol);
    if (coinId && !seen.has(coinId)) {
      result.push({ symbol, coinId });
      seen.add(coinId);
    }
  }

  // Add user-selected tokens
  const userTokens = getTrackedTokens();
  for (const token of userTokens) {
    if (!seen.has(token.coin_id)) {
      result.push({ symbol: token.symbol, coinId: token.coin_id });
      seen.add(token.coin_id);
    }
  }

  return result;
}

/**
 * Initialize default tokens in DB
 */
export async function initializeDefaultTokens(): Promise<void> {
  const defaults = getDefaultTokens();
  
  for (const symbol of defaults) {
    const coinId = await getCoinGeckoId(symbol);
    if (coinId) {
      const coins = await fetchCoinList();
      const coin = coins.find(c => c.id === coinId);
      if (coin) {
        addTrackedToken(coinId, symbol, coin.name, "system");
      }
    }
  }
  
  console.log(`[TokenRegistry] Initialized ${defaults.length} default tokens`);
}
