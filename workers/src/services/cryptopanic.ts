/**
 * CryptoPanic News Client
 * 
 * Fetches crypto news with sentiment from CryptoPanic API.
 * Provides real-time news events for the Somnia DataGrid.
 * 
 * API: https://cryptopanic.com/api/
 * Update frequency: Poll every 30-60 seconds
 */

import { keccak256, toBytes } from "viem";
import { 
  type NewsEventData, 
  type NewsAggregateData,
  type NewsSentiment,
  type NewsImpact,
  computeSentimentScore 
} from "../schemas/sentiment.js";

// CryptoPanic Developer API v2
const CRYPTOPANIC_API = "https://cryptopanic.com/api/developer/v2/posts/";

// Map common symbols to CryptoPanic currency codes
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  BTC: "BTC",
  ETH: "ETH",
  USDC: "USDC",
  USDT: "USDT",
  SOL: "SOL",
  ARB: "ARB",
  LINK: "LINK",
  UNI: "UNI",
  AAVE: "AAVE",
  MATIC: "MATIC",
  AVAX: "AVAX",
  DOGE: "DOGE",
  XRP: "XRP",
  ADA: "ADA",
  DOT: "DOT",
  ATOM: "ATOM",
  NEAR: "NEAR",
  OP: "OP",
  APT: "APT",
  SUI: "SUI",
  SEI: "SEI",
};

// CryptoPanic v2 API response types
interface CryptoPanicVotes {
  positive?: number;
  negative?: number;
  important?: number;
  liked?: number;
  disliked?: number;
  lol?: number;
  toxic?: number;
  saved?: number;
  comments?: number;
}

interface CryptoPanicPost {
  id: number;
  slug?: string;
  title: string;
  url: string;
  original_url?: string;
  source: {
    title: string;
    domain: string;
    region?: string;
    type?: string;
  };
  created_at: string;
  published_at?: string;
  currencies?: Array<{
    code: string;
    title: string;
    slug?: string;
  }>;
  instruments?: Array<{
    code: string;
    title: string;
  }>;
  votes?: CryptoPanicVotes;
  kind: "news" | "media" | "blog" | "twitter" | "reddit";
}

interface CryptoPanicResponse {
  next: string | null;
  previous: string | null;
  results: CryptoPanicPost[];
}

class CryptoPanicClient {
  private apiKey: string | null = null;
  private lastSeenId = 0;
  private newsCache: NewsEventData[] = [];
  private maxCacheSize = 1000;

  constructor() {
    this.apiKey = process.env.CRYPTOPANIC_API_KEY || null;
    if (!this.apiKey) {
      console.warn("[CryptoPanic] No API key configured - news features disabled");
    }
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  private determineSentiment(votes?: CryptoPanicVotes): NewsSentiment {
    if (!votes) return "neutral";
    
    const positive = (votes.positive ?? 0) + (votes.liked ?? 0);
    const negative = (votes.negative ?? 0) + (votes.disliked ?? 0) + (votes.toxic ?? 0);
    
    if (positive > negative * 1.5) return "positive";
    if (negative > positive * 1.5) return "negative";
    return "neutral";
  }

  private determineImpact(votes?: CryptoPanicVotes, sentiment?: NewsSentiment): NewsImpact {
    if (!votes) return "none";
    
    const totalVotes = (votes.positive ?? 0) + (votes.negative ?? 0) + (votes.important ?? 0) + (votes.liked ?? 0) + (votes.disliked ?? 0);
    
    if ((votes.important ?? 0) > 5 || totalVotes > 50) {
      return "important";
    }
    if (sentiment === "positive" && (votes.positive ?? 0) > 10) {
      return "bullish";
    }
    if (sentiment === "negative" && (votes.negative ?? 0) > 10) {
      return "bearish";
    }
    return "none";
  }

  async fetchNews(options: {
    currencies?: string[];
    filter?: "rising" | "hot" | "bullish" | "bearish" | "important" | "saved" | "lol";
    limit?: number;
  } = {}): Promise<NewsEventData[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const url = new URL(CRYPTOPANIC_API);
      url.searchParams.set("auth_token", this.apiKey);
      url.searchParams.set("public", "true");
      
      if (options.currencies && options.currencies.length > 0) {
        const codes = options.currencies
          .map(s => SYMBOL_TO_CURRENCY[s.toUpperCase()])
          .filter(Boolean);
        if (codes.length > 0) {
          url.searchParams.set("currencies", codes.join(","));
        }
      }
      
      if (options.filter) {
        url.searchParams.set("filter", options.filter);
      }

      console.log("[CryptoPanic] Fetching news...");

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: CryptoPanicResponse = await response.json();
      const results: NewsEventData[] = [];

      for (const post of data.results) {
        // Skip if already seen
        if (post.id <= this.lastSeenId) continue;

        // Get primary currency (from currencies or instruments array)
        const primaryCurrency = post.currencies?.[0]?.code || post.instruments?.[0]?.code || "CRYPTO";
        const sentiment = this.determineSentiment(post.votes);
        const impact = this.determineImpact(post.votes, sentiment);

        // Generate unique ID from post ID
        const newsId = keccak256(toBytes(`cryptopanic-${post.id}`)) as `0x${string}`;

        // Safely get vote counts with defaults
        const votes = post.votes ?? {};
        const votesPos = Math.min((votes.positive ?? 0) + (votes.liked ?? 0), 65535);
        const votesNeg = Math.min((votes.negative ?? 0) + (votes.disliked ?? 0), 65535);
        const votesImp = Math.min(votes.important ?? 0, 65535);

        const newsEvent: NewsEventData = {
          newsId,
          timestamp: BigInt(Math.floor(new Date(post.published_at || post.created_at).getTime() / 1000)),
          symbol: primaryCurrency,
          title: post.title.slice(0, 200), // Limit title length
          url: post.original_url || post.url,
          source: post.source.domain,
          sentiment,
          impact,
          votesPos,
          votesNeg,
          votesImp,
        };

        results.push(newsEvent);
        this.lastSeenId = Math.max(this.lastSeenId, post.id);
      }

      // Add to cache
      this.newsCache = [...results, ...this.newsCache].slice(0, this.maxCacheSize);

      console.log(`[CryptoPanic] Fetched ${results.length} new items`);
      return results;

    } catch (error) {
      console.error("[CryptoPanic] Fetch failed:", error instanceof Error ? error.message : error);
      return [];
    }
  }

  // Aggregate news for a symbol over a time window
  aggregateNews(symbol: string, windowMinutes: number = 60): NewsAggregateData | null {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (windowMinutes * 60);

    const relevantNews = this.newsCache.filter(n => 
      n.symbol === symbol.toUpperCase() && 
      Number(n.timestamp) >= windowStart
    );

    if (relevantNews.length === 0) {
      return null;
    }

    let positiveCount = 0;
    let negativeCount = 0;
    let importantCount = 0;

    for (const news of relevantNews) {
      if (news.sentiment === "positive") positiveCount++;
      if (news.sentiment === "negative") negativeCount++;
      if (news.impact === "important") importantCount++;
    }

    const sentimentScore = computeSentimentScore(positiveCount, negativeCount, relevantNews.length);

    return {
      timestamp: BigInt(now),
      symbol: symbol.toUpperCase(),
      sentimentScore,
      newsCount: relevantNews.length,
      importantCount,
      windowStart: BigInt(windowStart),
      windowEnd: BigInt(now),
    };
  }

  // Get all aggregates for tracked symbols
  getAllAggregates(symbols: string[], windowMinutes: number = 60): Map<string, NewsAggregateData> {
    const results = new Map<string, NewsAggregateData>();
    
    for (const symbol of symbols) {
      const agg = this.aggregateNews(symbol, windowMinutes);
      if (agg) {
        results.set(symbol, agg);
      }
    }

    return results;
  }

  // Test connectivity
  async ping(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      const url = new URL(CRYPTOPANIC_API);
      url.searchParams.set("auth_token", this.apiKey);
      url.searchParams.set("public", "true");
      
      const response = await fetch(url.toString());
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get supported symbols
  getSupportedSymbols(): string[] {
    return Object.keys(SYMBOL_TO_CURRENCY);
  }
}

// Singleton
export const cryptoPanicClient = new CryptoPanicClient();
