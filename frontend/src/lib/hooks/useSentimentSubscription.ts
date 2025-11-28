'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";
import {
  FEAR_GREED_SCHEMA,
  FEAR_GREED_EVENT_ID,
  TOKEN_SENTIMENT_SCHEMA,
  TOKEN_SENTIMENT_EVENT_ID,
  NEWS_EVENT_SCHEMA,
  NEWS_EVENT_EVENT_ID,
  type FearGreedData,
  type TokenSentimentData,
  type NewsEventData,
  type FearGreedZone,
  type NewsSentiment,
  type NewsImpact,
} from "../schemas";
import { somniaTestnet } from "../chain";
import { extractFieldValue } from "../utils/streams";

const FALLBACK_WS = "wss://dream-rpc.somnia.network/ws";
const MAX_NEWS_ITEMS = 50;

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

export function useSentimentSubscription() {
  const [fearGreed, setFearGreed] = useState<UiFearGreed | null>(null);
  const [sentiments, setSentiments] = useState<Map<string, UiTokenSentiment>>(new Map());
  const [news, setNews] = useState<UiNewsEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fearGreedEncoder = useMemo(() => new SchemaEncoder(FEAR_GREED_SCHEMA), []);
  const sentimentEncoder = useMemo(() => new SchemaEncoder(TOKEN_SENTIMENT_SCHEMA), []);
  const newsEncoder = useMemo(() => new SchemaEncoder(NEWS_EVENT_SCHEMA), []);

  type DecodedFields = ReturnType<SchemaEncoder["decodeData"]>;

  const decodePayload = useCallback(
    (payload: unknown, encoder: SchemaEncoder): DecodedFields | null => {
      if (typeof payload === "string") {
        try {
          return encoder.decodeData(payload as `0x${string}`);
        } catch {
          return null;
        }
      }
      if (Array.isArray(payload)) {
        return payload as DecodedFields;
      }
      if (payload && typeof payload === "object" && "data" in payload) {
        return decodePayload((payload as { data: unknown }).data, encoder);
      }
      return null;
    },
    [],
  );

  const decodeFearGreed = useCallback(
    (payload: unknown): UiFearGreed | null => {
      try {
        const decoded = decodePayload(payload, fearGreedEncoder);
        if (!decoded || decoded.length < 5) return null;

        return {
          timestamp: Number(extractFieldValue(decoded[0])),
          score: Number(extractFieldValue(decoded[1])),
          zone: String(extractFieldValue(decoded[2])) as FearGreedZone,
          source: String(extractFieldValue(decoded[3])),
          nextUpdate: Number(extractFieldValue(decoded[4])),
        };
      } catch (err) {
        console.error("[Sentiment] Fear/Greed decode error:", err);
        return null;
      }
    },
    [decodePayload, fearGreedEncoder],
  );

  const decodeSentiment = useCallback(
    (payload: unknown): UiTokenSentiment | null => {
      try {
        const decoded = decodePayload(payload, sentimentEncoder);
        if (!decoded || decoded.length < 7) return null;

        return {
          timestamp: Number(extractFieldValue(decoded[0])),
          symbol: String(extractFieldValue(decoded[1])),
          upPercent: Number(extractFieldValue(decoded[2])) / 100, // Convert from basis points
          downPercent: Number(extractFieldValue(decoded[3])) / 100,
          netScore: Number(extractFieldValue(decoded[4])) / 100,
          sampleSize: Number(extractFieldValue(decoded[5])),
          source: String(extractFieldValue(decoded[6])),
        };
      } catch (err) {
        console.error("[Sentiment] Token sentiment decode error:", err);
        return null;
      }
    },
    [decodePayload, sentimentEncoder],
  );

  const decodeNews = useCallback(
    (payload: unknown): UiNewsEvent | null => {
      try {
        const decoded = decodePayload(payload, newsEncoder);
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
      } catch (err) {
        console.error("[Sentiment] News decode error:", err);
        return null;
      }
    },
    [decodePayload, newsEncoder],
  );

  // WebSocket subscription
  useEffect(() => {
    let wsClient: ReturnType<typeof createWsClient>;
    let sdk: SDK;
    let unsubscribeFG: (() => void) | undefined;
    let unsubscribeSentiment: (() => void) | undefined;
    let unsubscribeNews: (() => void) | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    async function subscribe() {
      try {
        wsClient = createWsClient();
        sdk = new SDK({ public: wsClient });

        // Subscribe to Fear & Greed
        console.log("[Sentiment] Subscribing to Fear & Greed events...");
        const fgSub = await sdk.streams.subscribe({
          somniaStreamsEventId: FEAR_GREED_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const fg = decodeFearGreed(data);
            if (fg) {
              console.log(`[Sentiment] Fear & Greed: ${fg.score} (${fg.zone})`);
              setFearGreed(fg);
            }
          },
          onError: (err: Error) => {
            console.error("[Sentiment] Fear/Greed subscription error:", err);
          },
        });

        // Subscribe to Token Sentiment
        console.log("[Sentiment] Subscribing to Token Sentiment events...");
        const sentimentSub = await sdk.streams.subscribe({
          somniaStreamsEventId: TOKEN_SENTIMENT_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const sentiment = decodeSentiment(data);
            if (sentiment) {
              console.log(`[Sentiment] ${sentiment.symbol}: ${sentiment.upPercent}% up`);
              setSentiments(prev => {
                const next = new Map(prev);
                next.set(sentiment.symbol, sentiment);
                return next;
              });
            }
          },
          onError: (err: Error) => {
            console.error("[Sentiment] Token sentiment subscription error:", err);
          },
        });

        // Subscribe to News Events
        console.log("[Sentiment] Subscribing to News events...");
        const newsSub = await sdk.streams.subscribe({
          somniaStreamsEventId: NEWS_EVENT_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const newsItem = decodeNews(data);
            if (newsItem) {
              console.log(`[Sentiment] News: [${newsItem.symbol}] ${newsItem.title.slice(0, 50)}...`);
              setNews(prev => [newsItem, ...prev].slice(0, MAX_NEWS_ITEMS));
            }
          },
          onError: (err: Error) => {
            console.error("[Sentiment] News subscription error:", err);
          },
        });

        unsubscribeFG = fgSub instanceof Error ? undefined : fgSub?.unsubscribe;
        unsubscribeSentiment = sentimentSub instanceof Error ? undefined : sentimentSub?.unsubscribe;
        unsubscribeNews = newsSub instanceof Error ? undefined : newsSub?.unsubscribe;
        
        setIsConnected(true);
        setError(null);
        console.log("[Sentiment] ✅ WebSocket subscriptions active");

      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to subscribe";
        console.error("[Sentiment] Subscription failed:", message);
        setError(message);
        setIsConnected(false);
        reconnectTimer = setTimeout(subscribe, 5000);
      }
    }

    subscribe();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      unsubscribeFG?.();
      unsubscribeSentiment?.();
      unsubscribeNews?.();
    };
  }, [decodeFearGreed, decodeSentiment, decodeNews]);

  return {
    fearGreed,
    sentiments: Array.from(sentiments.values()),
    news,
    isConnected,
    error,
  };
}
