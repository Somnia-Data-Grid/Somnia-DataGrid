/**
 * CoinGecko Sentiment Client
 * 
 * Fetches token sentiment data (up/down votes) from CoinGecko.
 * Features:
 * - Multiple API key support with rotation
 * - Automatic retry with different keys on failure
 * - Caching to reduce API calls
 * 
 * Update frequency: Every 1-6 hours (votes change slowly)
 */

import { type TokenSentimentData } from "../schemas/sentiment.js";
import { COINGECKO_IDS } from "./coingecko.js";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

interface CoinGeckoDetailResponse {
  id: string;
  symbol: string;
  sentiment_votes_up_percentage: number | null;
  sentiment_votes_down_percentage: number | null;
  community_data?: {
    twitter_followers?: number;
    reddit_subscribers?: number;
  };
}

class CoinGeckoSentimentClient {
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  private failedKeys = new Set<number>(); // Track failed keys
  private cache = new Map<string, { data: TokenSentimentData; fetchedAt: number }>();
  private cacheDuration = 60 * 60 * 1000; // 1 hour cache
  private lastKeyRotation = 0;
  private keyRotationInterval = 60 * 1000; // Rotate keys every minute

  constructor() {
    this.loadApiKeys();
  }

  private loadApiKeys() {
    const keys = [
      process.env.COINGECKO_API_KEY_1,
      process.env.COINGECKO_API_KEY_2,
      process.env.COINGECKO_API_KEY_3,
    ].filter((key): key is string => Boolean(key));

    this.apiKeys = keys;
    console.log(`[CGSentiment] Loaded ${keys.length} API key(s)`);
  }

  private getNextKey(): string | null {
    if (this.apiKeys.length === 0) return null;
    
    // Reset failed keys periodically
    const now = Date.now();
    if (now - this.lastKeyRotation > this.keyRotationInterval) {
      this.failedKeys.clear();
      this.lastKeyRotation = now;
    }

    // Find a working key
    for (let i = 0; i < this.apiKeys.length; i++) {
      const idx = (this.currentKeyIndex + i) % this.apiKeys.length;
      if (!this.failedKeys.has(idx)) {
        this.currentKeyIndex = (idx + 1) % this.apiKeys.length;
        return this.apiKeys[idx];
      }
    }

    // All keys failed, try first one anyway
    this.failedKeys.clear();
    return this.apiKeys[0];
  }

  private markKeyFailed(key: string) {
    const idx = this.apiKeys.indexOf(key);
    if (idx >= 0) {
      this.failedKeys.add(idx);
      console.log(`[CGSentiment] Marked key ${idx + 1} as failed, ${this.apiKeys.length - this.failedKeys.size} keys remaining`);
    }
  }

  async fetchSentiment(symbol: string, retryCount = 0): Promise<TokenSentimentData | null> {
    const coinId = COINGECKO_IDS[symbol.toUpperCase()];
    if (!coinId) {
      console.warn(`[CGSentiment] No CoinGecko ID for ${symbol}`);
      return null;
    }

    // Check cache
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < this.cacheDuration) {
      return cached.data;
    }

    const apiKey = this.getNextKey();
    
    try {
      const url = new URL(`${COINGECKO_API_BASE}/coins/${coinId}`);
      url.searchParams.set("localization", "false");
      url.searchParams.set("tickers", "false");
      url.searchParams.set("market_data", "false");
      url.searchParams.set("community_data", "true");
      url.searchParams.set("developer_data", "false");

      if (apiKey) {
        url.searchParams.set("x_cg_demo_api_key", apiKey);
      }

      console.log(`[CGSentiment] Fetching ${symbol}...`);

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      // Handle rate limit or auth errors - try another key
      if (response.status === 429 || response.status === 401) {
        if (apiKey) this.markKeyFailed(apiKey);
        
        // Retry with different key if we have more
        if (retryCount < this.apiKeys.length - 1) {
          console.log(`[CGSentiment] Retrying ${symbol} with different key...`);
          await new Promise(r => setTimeout(r, 500));
          return this.fetchSentiment(symbol, retryCount + 1);
        }
        
        console.warn(`[CGSentiment] All keys exhausted for ${symbol}`);
        return cached?.data ?? null;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: CoinGeckoDetailResponse = await response.json();

      const upPercent = data.sentiment_votes_up_percentage ?? 50;
      const downPercent = data.sentiment_votes_down_percentage ?? 50;
      
      const sampleSize = Math.min(
        (data.community_data?.twitter_followers ?? 0) + 
        (data.community_data?.reddit_subscribers ?? 0),
        65535
      );

      const result: TokenSentimentData = {
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        symbol: symbol.toUpperCase(),
        upPercent: Math.round(upPercent * 100),
        downPercent: Math.round(downPercent * 100),
        netScore: Math.round((upPercent - downPercent) * 100),
        sampleSize,
        source: "COINGECKO",
      };

      this.cache.set(symbol, { data: result, fetchedAt: Date.now() });
      console.log(`[CGSentiment] ${symbol}: ${upPercent.toFixed(1)}% up, ${downPercent.toFixed(1)}% down`);
      return result;

    } catch (error) {
      console.error(`[CGSentiment] Failed for ${symbol}:`, error instanceof Error ? error.message : error);
      
      // Retry with different key on network errors
      if (apiKey && retryCount < this.apiKeys.length - 1) {
        this.markKeyFailed(apiKey);
        await new Promise(r => setTimeout(r, 500));
        return this.fetchSentiment(symbol, retryCount + 1);
      }
      
      return cached?.data ?? null;
    }
  }

  async fetchSentimentBatch(symbols: string[]): Promise<Map<string, TokenSentimentData>> {
    const results = new Map<string, TokenSentimentData>();

    for (const symbol of symbols) {
      const sentiment = await this.fetchSentiment(symbol);
      if (sentiment) {
        results.set(symbol, sentiment);
      }
      // Delay between requests (2 seconds to stay under 30 req/min)
      await new Promise(r => setTimeout(r, 2000));
    }

    return results;
  }

  getSupportedSymbols(): string[] {
    return Object.keys(COINGECKO_IDS);
  }
}

export const coingeckoSentimentClient = new CoinGeckoSentimentClient();
