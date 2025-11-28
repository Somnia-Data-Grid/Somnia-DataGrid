/**
 * CoinGecko API Client with Multi-Key Fallback
 * 
 * Uses CoinGecko Demo API (free tier) with support for multiple API keys.
 * If one key fails or hits rate limit, automatically falls back to the next.
 * 
 * Demo API: https://api.coingecko.com/api/v3/
 * Rate Limit: 30 calls/min per key (Demo tier)
 */

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

// Default CoinGecko coin IDs (fallback if stream registry not initialized)
// The stream registry provides dynamic token support
export const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  ARB: "arbitrum",
  SOL: "solana",
  WETH: "weth",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  SOMNIA: "somnia",
  DOGE: "dogecoin",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  // STT is testnet only - available via DIA Oracle
};

interface PriceData {
  usd: number;
  last_updated_at?: number;
}

interface CoinGeckoResponse {
  [coinId: string]: PriceData;
}

// Track API key health
interface KeyHealth {
  key: string;
  failures: number;
  lastFailure: number;
  rateLimited: boolean;
  rateLimitReset: number;
}

class CoinGeckoClient {
  private apiKeys: string[] = [];
  private keyHealth: Map<string, KeyHealth> = new Map();
  private currentKeyIndex = 0;

  constructor() {
    this.loadApiKeys();
  }

  private loadApiKeys() {
    // Load up to 3 API keys from environment
    const keys = [
      process.env.COINGECKO_API_KEY_1,
      process.env.COINGECKO_API_KEY_2,
      process.env.COINGECKO_API_KEY_3,
    ].filter((key): key is string => Boolean(key));

    if (keys.length === 0) {
      console.warn("[CoinGecko] No API keys configured, using public API (lower rate limits)");
    } else {
      console.log(`[CoinGecko] Loaded ${keys.length} API key(s)`);
    }

    this.apiKeys = keys;
    
    // Initialize health tracking
    for (const key of keys) {
      this.keyHealth.set(key, {
        key,
        failures: 0,
        lastFailure: 0,
        rateLimited: false,
        rateLimitReset: 0,
      });
    }
  }

  private getNextHealthyKey(): string | null {
    if (this.apiKeys.length === 0) return null;

    const now = Date.now();
    
    // Try each key starting from current index
    for (let i = 0; i < this.apiKeys.length; i++) {
      const index = (this.currentKeyIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[index];
      const health = this.keyHealth.get(key);

      if (!health) continue;

      // Skip rate-limited keys until reset
      if (health.rateLimited && now < health.rateLimitReset) {
        continue;
      }

      // Reset rate limit flag if time has passed
      if (health.rateLimited && now >= health.rateLimitReset) {
        health.rateLimited = false;
      }

      // Skip keys with too many recent failures (cooldown: 5 min)
      if (health.failures >= 3 && now - health.lastFailure < 5 * 60 * 1000) {
        continue;
      }

      // Reset failure count after cooldown
      if (health.failures > 0 && now - health.lastFailure >= 5 * 60 * 1000) {
        health.failures = 0;
      }

      this.currentKeyIndex = index;
      return key;
    }

    // All keys are unhealthy, return first one anyway
    console.warn("[CoinGecko] All API keys are unhealthy, using first key");
    return this.apiKeys[0];
  }

  private markKeyFailure(key: string, isRateLimit: boolean) {
    const health = this.keyHealth.get(key);
    if (!health) return;

    health.failures++;
    health.lastFailure = Date.now();

    if (isRateLimit) {
      health.rateLimited = true;
      health.rateLimitReset = Date.now() + 60 * 1000; // 1 minute cooldown
      console.warn(`[CoinGecko] Key ${key.slice(0, 8)}... rate limited, cooling down`);
    }

    // Move to next key
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
  }

  private markKeySuccess(key: string) {
    const health = this.keyHealth.get(key);
    if (!health) return;

    health.failures = 0;
    health.rateLimited = false;
  }

  async fetchPrices(symbols: string[]): Promise<Map<string, { price: bigint; timestamp: bigint }>> {
    const validSymbols = symbols.filter((s) => COINGECKO_IDS[s]);
    if (validSymbols.length === 0) return new Map();

    const ids = validSymbols.map((s) => COINGECKO_IDS[s]).join(",");
    const results = new Map<string, { price: bigint; timestamp: bigint }>();

    // Try with API keys first, then fall back to public API
    const attempts = this.apiKeys.length > 0 ? this.apiKeys.length + 1 : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const apiKey = this.getNextHealthyKey();
        const url = new URL(`${COINGECKO_API_BASE}/simple/price`);
        url.searchParams.set("ids", ids);
        url.searchParams.set("vs_currencies", "usd");
        url.searchParams.set("include_last_updated_at", "true");

        // Add API key as query parameter for Demo API
        if (apiKey) {
          url.searchParams.set("x_cg_demo_api_key", apiKey);
        }

        const response = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        // Handle rate limiting
        if (response.status === 429) {
          if (apiKey) {
            this.markKeyFailure(apiKey, true);
            console.warn(`[CoinGecko] Rate limited on key ${apiKey.slice(0, 8)}..., trying next`);
            continue;
          }
          throw new Error("Rate limited on public API");
        }

        if (!response.ok) {
          if (apiKey) {
            this.markKeyFailure(apiKey, false);
          }
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoResponse = await response.json();

        // Mark success
        if (apiKey) {
          this.markKeySuccess(apiKey);
        }

        // Parse response
        for (const symbol of validSymbols) {
          const coinId = COINGECKO_IDS[symbol];
          const priceData = data[coinId];

          if (priceData?.usd) {
            const price = BigInt(Math.round(priceData.usd * 10 ** 8)); // 8 decimals
            const timestamp = priceData.last_updated_at
              ? BigInt(priceData.last_updated_at)
              : BigInt(Math.floor(Date.now() / 1000));

            results.set(symbol, { price, timestamp });
          }
        }

        console.log(`[CoinGecko] Fetched ${results.size}/${validSymbols.length} prices`);
        return results;

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CoinGecko] Attempt ${attempt + 1}/${attempts} failed:`, message);

        if (attempt === attempts - 1) {
          throw error;
        }
      }
    }

    return results;
  }

  // Test API connectivity
  async ping(): Promise<boolean> {
    try {
      const apiKey = this.getNextHealthyKey();
      const url = new URL(`${COINGECKO_API_BASE}/ping`);
      
      if (apiKey) {
        url.searchParams.set("x_cg_demo_api_key", apiKey);
      }

      const response = await fetch(url.toString());
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get current key status for debugging
  getKeyStatus(): { total: number; healthy: number; rateLimited: number } {
    let healthy = 0;
    let rateLimited = 0;
    const now = Date.now();

    for (const health of this.keyHealth.values()) {
      if (health.rateLimited && now < health.rateLimitReset) {
        rateLimited++;
      } else if (health.failures < 3 || now - health.lastFailure >= 5 * 60 * 1000) {
        healthy++;
      }
    }

    return {
      total: this.apiKeys.length,
      healthy,
      rateLimited,
    };
  }
}

// Singleton instance
export const coingeckoClient = new CoinGeckoClient();
