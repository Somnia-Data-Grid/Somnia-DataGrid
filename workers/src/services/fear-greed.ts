/**
 * Fear & Greed Index Client
 * 
 * Fetches the Crypto Fear & Greed Index from Alternative.me API (free, no key required).
 * This is the same data source used by CoinMarketCap.
 * 
 * API: https://api.alternative.me/fng/
 * Update frequency: Daily
 */

import { getZoneFromScore, type FearGreedData, type FearGreedZone } from "../schemas/sentiment.js";

const ALTERNATIVE_ME_API = "https://api.alternative.me/fng/";

interface AlternativeMeResponse {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
  }>;
  metadata: {
    error: string | null;
  };
}

class FearGreedClient {
  private lastFetch: FearGreedData | null = null;
  private lastFetchTime = 0;
  private cacheDuration = 60 * 60 * 1000; // 1 hour cache (index updates daily)

  async fetchFearGreed(): Promise<FearGreedData | null> {
    // Return cached if fresh
    const now = Date.now();
    if (this.lastFetch && now - this.lastFetchTime < this.cacheDuration) {
      console.log("[FearGreed] Returning cached value");
      return this.lastFetch;
    }

    try {
      console.log("[FearGreed] Fetching from Alternative.me...");
      
      const response = await fetch(ALTERNATIVE_ME_API, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: AlternativeMeResponse = await response.json();

      if (data.metadata?.error) {
        throw new Error(data.metadata.error);
      }

      if (!data.data || data.data.length === 0) {
        throw new Error("No data returned");
      }

      const latest = data.data[0];
      const score = parseInt(latest.value, 10);
      const timestamp = BigInt(latest.timestamp);
      const timeUntilUpdate = parseInt(latest.time_until_update, 10);
      const nextUpdate = BigInt(Math.floor(now / 1000) + timeUntilUpdate);

      const result: FearGreedData = {
        timestamp,
        score,
        zone: getZoneFromScore(score),
        source: "ALTERNATIVE_ME",
        nextUpdate,
      };

      this.lastFetch = result;
      this.lastFetchTime = now;

      console.log(`[FearGreed] Score: ${score} (${result.zone})`);
      return result;

    } catch (error) {
      console.error("[FearGreed] Fetch failed:", error instanceof Error ? error.message : error);
      return this.lastFetch; // Return stale cache on error
    }
  }

  // Check if we should publish (value changed or first time)
  shouldPublish(newData: FearGreedData): boolean {
    if (!this.lastFetch) return true;
    return this.lastFetch.score !== newData.score;
  }

  // Test connectivity
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(ALTERNATIVE_ME_API);
      return response.ok;
    } catch {
      return false;
    }
  }

  getLastValue(): FearGreedData | null {
    return this.lastFetch;
  }
}

// Singleton
export const fearGreedClient = new FearGreedClient();
