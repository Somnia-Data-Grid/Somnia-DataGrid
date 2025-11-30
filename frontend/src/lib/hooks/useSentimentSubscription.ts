'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";
import {
  FEAR_GREED_SCHEMA,
  FEAR_GREED_EVENT_ID,
  TOKEN_SENTIMENT_SCHEMA,
  TOKEN_SENTIMENT_EVENT_ID,
  NEWS_EVENT_SCHEMA,
  NEWS_EVENT_EVENT_ID,
  type FearGreedZone,
  type NewsSentiment,
  type NewsImpact,
} from "../schemas";
import { somniaTestnet } from "../chain";
import { extractFieldValue } from "../utils/streams";

const FALLBACK_WS = "wss://dream-rpc.somnia.network/ws";
const MAX_NEWS_ITEMS = 50;
const API_BASE = process.env.NEXT_PUBLIC_WORKERS_API_URL || 'http://localhost:3001';
const RECONNECT_DELAY = 10000;

function createWsClient() {
  const url = process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? FALLBACK_WS;
  return createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(url),
  });
}

export interface UiFearGreed {
  score: number;
  zone: FearGreedZone;
  source: string;
  timestamp: number;
  nextUpdate: number;
}

export interface UiTokenSentiment {
  symbol: string;
  upPercent: number;
  downPercent: number;
  netScore: number;
  sampleSize: number;
  source: string;
  timestamp: number;
}

export interface UiNewsEvent {
  newsId: string;
  symbol: string;
  title: string;
  url: string;
  source: string;
  sentiment: NewsSentiment;
  impact: NewsImpact;
  votesPos: number;
  votesNeg: number;
  votesImp: number;
  timestamp: number;
}

// Singleton connection manager
let sentimentConnection: {
  sdk: SDK | null;
  unsubscribers: (() => void)[];
  fgSubscribers: Set<(fg: UiFearGreed) => void>;
  sentimentSubscribers: Set<(s: UiTokenSentiment) => void>;
  newsSubscribers: Set<(n: UiNewsEvent) => void>;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
} = {
  sdk: null,
  unsubscribers: [],
  fgSubscribers: new Set(),
  sentimentSubscribers: new Set(),
  newsSubscribers: new Set(),
  isConnecting: false,
  isConnected: false,
  error: null,
};


export function useSentimentSubscription() {
  const [fearGreed, setFearGreed] = useState<UiFearGreed | null>(null);
  const [sentiments, setSentiments] = useState<Map<string, UiTokenSentiment>>(new Map());
  const [news, setNews] = useState<UiNewsEvent[]>([]);
  const [isConnected, setIsConnected] = useState(sentimentConnection.isConnected);
  const [error, setError] = useState<string | null>(sentimentConnection.error);
  const mountedRef = useRef(true);

  // Fetch cached data from API on mount
  useEffect(() => {
    async function fetchCachedData() {
      try {
        const res = await fetch(`${API_BASE}/api/sentiment`);
        if (!res.ok) return;
        
        const data = await res.json();
        if (!data.success) return;

        if (data.fearGreed) {
          setFearGreed({
            score: data.fearGreed.score,
            zone: data.fearGreed.zone as FearGreedZone,
            source: data.fearGreed.source,
            timestamp: data.fearGreed.timestamp,
            nextUpdate: data.fearGreed.next_update || 0,
          });
        }

        if (data.sentiments && data.sentiments.length > 0) {
          const map = new Map<string, UiTokenSentiment>();
          for (const s of data.sentiments) {
            map.set(s.symbol, {
              symbol: s.symbol,
              upPercent: s.up_percent / 100,
              downPercent: s.down_percent / 100,
              netScore: s.net_score / 100,
              sampleSize: s.sample_size,
              source: s.source,
              timestamp: s.timestamp,
            });
          }
          setSentiments(map);
        }

        if (data.news && data.news.length > 0) {
          const newsItems: UiNewsEvent[] = data.news.map((n: any) => ({
            newsId: n.news_id,
            symbol: n.symbol,
            title: n.title,
            url: n.url,
            source: n.source,
            sentiment: n.sentiment as NewsSentiment,
            impact: n.impact as NewsImpact,
            votesPos: n.votes_pos,
            votesNeg: n.votes_neg,
            votesImp: n.votes_imp,
            timestamp: n.timestamp,
          }));
          setNews(newsItems);
        }

        console.log("[Sentiment] Loaded cached data from API");
      } catch (err) {
        console.log("[Sentiment] Could not fetch cached data:", err);
      }
    }

    fetchCachedData();
  }, []);

  // WebSocket subscription with singleton pattern
  useEffect(() => {
    mountedRef.current = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const handleFG = (fg: UiFearGreed) => {
      if (!mountedRef.current) return;
      setFearGreed(fg);
    };

    const handleSentiment = (s: UiTokenSentiment) => {
      if (!mountedRef.current) return;
      setSentiments(prev => {
        const next = new Map(prev);
        next.set(s.symbol, s);
        return next;
      });
    };

    const handleNews = (n: UiNewsEvent) => {
      if (!mountedRef.current) return;
      setNews(prev => [n, ...prev].slice(0, MAX_NEWS_ITEMS));
    };

    sentimentConnection.fgSubscribers.add(handleFG);
    sentimentConnection.sentimentSubscribers.add(handleSentiment);
    sentimentConnection.newsSubscribers.add(handleNews);

    const syncState = () => {
      if (!mountedRef.current) return;
      setIsConnected(sentimentConnection.isConnected);
      setError(sentimentConnection.error);
    };

    async function initConnection() {
      if (sentimentConnection.isConnected || sentimentConnection.isConnecting) {
        syncState();
        return;
      }

      sentimentConnection.isConnecting = true;

      try {
        console.log("[Sentiment] Creating shared WebSocket connection...");
        const wsClient = createWsClient();
        const sdk = new SDK({ public: wsClient });
        sentimentConnection.sdk = sdk;

        const fgEncoder = new SchemaEncoder(FEAR_GREED_SCHEMA);
        const sentEncoder = new SchemaEncoder(TOKEN_SENTIMENT_SCHEMA);
        const newsEncoder = new SchemaEncoder(NEWS_EVENT_SCHEMA);

        // Subscribe to Fear & Greed
        const fgSub = await sdk.streams.subscribe({
          somniaStreamsEventId: FEAR_GREED_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const fg = decodeFearGreedStatic(data, fgEncoder);
            if (fg) sentimentConnection.fgSubscribers.forEach(cb => cb(fg));
          },
          onError: (err: Error) => console.error("[Sentiment] FG error:", err.message),
        });

        // Subscribe to Token Sentiment
        const sentSub = await sdk.streams.subscribe({
          somniaStreamsEventId: TOKEN_SENTIMENT_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const s = decodeSentimentStatic(data, sentEncoder);
            if (s) sentimentConnection.sentimentSubscribers.forEach(cb => cb(s));
          },
          onError: (err: Error) => console.error("[Sentiment] Sentiment error:", err.message),
        });

        // Subscribe to News
        const newsSub = await sdk.streams.subscribe({
          somniaStreamsEventId: NEWS_EVENT_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const n = decodeNewsStatic(data, newsEncoder);
            if (n) sentimentConnection.newsSubscribers.forEach(cb => cb(n));
          },
          onError: (err: Error) => console.error("[Sentiment] News error:", err.message),
        });

        if (!(fgSub instanceof Error) && fgSub?.unsubscribe) {
          sentimentConnection.unsubscribers.push(fgSub.unsubscribe);
        }
        if (!(sentSub instanceof Error) && sentSub?.unsubscribe) {
          sentimentConnection.unsubscribers.push(sentSub.unsubscribe);
        }
        if (!(newsSub instanceof Error) && newsSub?.unsubscribe) {
          sentimentConnection.unsubscribers.push(newsSub.unsubscribe);
        }

        sentimentConnection.isConnected = true;
        sentimentConnection.isConnecting = false;
        sentimentConnection.error = null;
        console.log("[Sentiment] ✓ Connected to Somnia Data Streams");
        syncState();

      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to subscribe";
        console.error("[Sentiment] Connection failed:", message);
        sentimentConnection.isConnected = false;
        sentimentConnection.isConnecting = false;
        sentimentConnection.error = message;
        syncState();

        if (!cancelled) {
          reconnectTimer = setTimeout(initConnection, RECONNECT_DELAY);
        }
      }
    }

    initConnection();

    return () => {
      mountedRef.current = false;
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);

      sentimentConnection.fgSubscribers.delete(handleFG);
      sentimentConnection.sentimentSubscribers.delete(handleSentiment);
      sentimentConnection.newsSubscribers.delete(handleNews);

      const totalSubs = sentimentConnection.fgSubscribers.size + 
                        sentimentConnection.sentimentSubscribers.size + 
                        sentimentConnection.newsSubscribers.size;

      if (totalSubs === 0) {
        console.log("[Sentiment] No more subscribers, cleaning up");
        sentimentConnection.unsubscribers.forEach(unsub => unsub());
        sentimentConnection.unsubscribers = [];
        sentimentConnection.sdk = null;
        sentimentConnection.isConnected = false;
        sentimentConnection.isConnecting = false;
      }
    };
  }, []);

  return {
    fearGreed,
    sentiments: Array.from(sentiments.values()),
    news,
    isConnected,
    error,
  };
}


// Static decode functions
function decodePayloadStatic(payload: unknown, encoder: SchemaEncoder): ReturnType<SchemaEncoder["decodeData"]> | null {
  if (typeof payload === "string") {
    try {
      return encoder.decodeData(payload as `0x${string}`);
    } catch {
      return null;
    }
  }
  if (Array.isArray(payload)) return payload as ReturnType<SchemaEncoder["decodeData"]>;
  if (payload && typeof payload === "object" && "data" in payload) {
    return decodePayloadStatic((payload as { data: unknown }).data, encoder);
  }
  return null;
}

function decodeFearGreedStatic(payload: unknown, encoder: SchemaEncoder): UiFearGreed | null {
  try {
    const decoded = decodePayloadStatic(payload, encoder);
    if (!decoded || decoded.length < 5) return null;
    return {
      timestamp: Number(extractFieldValue(decoded[0])),
      score: Number(extractFieldValue(decoded[1])),
      zone: String(extractFieldValue(decoded[2])) as FearGreedZone,
      source: String(extractFieldValue(decoded[3])),
      nextUpdate: Number(extractFieldValue(decoded[4])),
    };
  } catch {
    return null;
  }
}

function decodeSentimentStatic(payload: unknown, encoder: SchemaEncoder): UiTokenSentiment | null {
  try {
    const decoded = decodePayloadStatic(payload, encoder);
    if (!decoded || decoded.length < 7) return null;
    return {
      timestamp: Number(extractFieldValue(decoded[0])),
      symbol: String(extractFieldValue(decoded[1])),
      upPercent: Number(extractFieldValue(decoded[2])) / 100,
      downPercent: Number(extractFieldValue(decoded[3])) / 100,
      netScore: Number(extractFieldValue(decoded[4])) / 100,
      sampleSize: Number(extractFieldValue(decoded[5])),
      source: String(extractFieldValue(decoded[6])),
    };
  } catch {
    return null;
  }
}

function decodeNewsStatic(payload: unknown, encoder: SchemaEncoder): UiNewsEvent | null {
  try {
    const decoded = decodePayloadStatic(payload, encoder);
    if (!decoded || decoded.length < 11) return null;
    return {
      newsId: String(extractFieldValue(decoded[0])),
      timestamp: Number(extractFieldValue(decoded[1])),
      symbol: String(extractFieldValue(decoded[2])),
      title: String(extractFieldValue(decoded[3])),
      url: String(extractFieldValue(decoded[4])),
      source: String(extractFieldValue(decoded[5])),
      sentiment: String(extractFieldValue(decoded[6])) as NewsSentiment,
      impact: String(extractFieldValue(decoded[7])) as NewsImpact,
      votesPos: Number(extractFieldValue(decoded[8])),
      votesNeg: Number(extractFieldValue(decoded[9])),
      votesImp: Number(extractFieldValue(decoded[10])),
    };
  } catch {
    return null;
  }
}
