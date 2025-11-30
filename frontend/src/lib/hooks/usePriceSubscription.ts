'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";
import {
  ALERT_SCHEMA,
  ALERT_TRIGGERED_EVENT_ID,
  PRICE_FEED_SCHEMA,
  PRICE_UPDATE_EVENT_ID,
} from "../schemas";
import { somniaTestnet } from "../chain";
import { extractFieldValue } from "../utils/streams";

export interface UiPrice {
  symbol: string;
  price: string;
  priceRaw: string;
  decimals: number;
  source: "PROTOFIRE" | "DIA" | "COINGECKO" | "OFFCHAIN";
  timestamp: number;
  sourceAddress: string;
  priceChange24h?: number;
}

export interface AlertNotification {
  alertId: string;
  userAddress: string;
  asset: string;
  condition: string;
  thresholdPrice: string;
  currentPrice: string;
  triggeredAt: number;
}

const FALLBACK_WS = "wss://dream-rpc.somnia.network/ws";
const MAX_SEEN_ALERTS = 500;
const RECONNECT_DELAY = 10000; // 10 seconds between reconnects

const seenAlertIds = new Set<string>();

function addSeenAlert(key: string) {
  seenAlertIds.add(key);
  if (seenAlertIds.size > MAX_SEEN_ALERTS) {
    const iterator = seenAlertIds.values();
    const oldest = iterator.next().value;
    if (oldest) seenAlertIds.delete(oldest);
  }
}

// Singleton connection manager to prevent multiple subscriptions
let globalConnection: {
  sdk: SDK | null;
  priceUnsubscribe: (() => void) | null;
  alertUnsubscribe: (() => void) | null;
  subscribers: Set<(price: UiPrice) => void>;
  alertSubscribers: Set<(alert: AlertNotification) => void>;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
} = {
  sdk: null,
  priceUnsubscribe: null,
  alertUnsubscribe: null,
  subscribers: new Set(),
  alertSubscribers: new Set(),
  isConnecting: false,
  isConnected: false,
  error: null,
};

function createWsClient() {
  const url = process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? FALLBACK_WS;
  return createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(url),
  });
}

export function usePriceSubscription(walletAddress?: string) {
  const [prices, setPrices] = useState<Map<string, UiPrice>>(new Map());
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [isConnected, setIsConnected] = useState(globalConnection.isConnected);
  const [error, setError] = useState<string | null>(globalConnection.error);
  const walletAddressRef = useRef<string | undefined>(walletAddress);
  const mountedRef = useRef(true);

  // Keep wallet address ref updated
  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  const priceEncoder = useMemo(() => new SchemaEncoder(PRICE_FEED_SCHEMA), []);
  const alertEncoder = useMemo(() => new SchemaEncoder(ALERT_SCHEMA), []);

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
        const data = (payload as { data: unknown }).data;
        return decodePayload(data, encoder);
      }
      return null;
    },
    [],
  );

  const decodePrice = useCallback(
    (payload: unknown): UiPrice | null => {
      try {
        const decoded = decodePayload(payload, priceEncoder);
        if (!decoded || decoded.length < 6) return null;

        const timestamp = Number(extractFieldValue(decoded[0]) as string | number);
        const symbol = String(extractFieldValue(decoded[1]));
        const priceRaw = BigInt(extractFieldValue(decoded[2]) as string | number | bigint);
        const decimals = Number(extractFieldValue(decoded[3]) as string | number);
        const source = String(extractFieldValue(decoded[4])) as UiPrice["source"];
        const sourceAddress = String(extractFieldValue(decoded[5]));

        const divisor = BigInt(10 ** decimals);
        const whole = priceRaw / divisor;
        const fraction = priceRaw % divisor;
        const formatted = `${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 2)}`;

        return { symbol, price: formatted, priceRaw: priceRaw.toString(), decimals, source, timestamp, sourceAddress };
      } catch {
        return null;
      }
    },
    [decodePayload, priceEncoder],
  );

  const decodeAlert = useCallback(
    (payload: unknown): AlertNotification | null => {
      try {
        const decoded = decodePayload(payload, alertEncoder);
        if (!decoded || decoded.length < 7) return null;

        const alertId = String(extractFieldValue(decoded[0]));
        const userAddress = String(extractFieldValue(decoded[1]));
        const triggeredAtRaw = extractFieldValue(decoded[6]);
        const triggeredAt = Number(triggeredAtRaw as string | number | bigint);
        const dedupeKey = `${alertId}-${triggeredAt}`;
        if (seenAlertIds.has(dedupeKey)) return null;
        addSeenAlert(dedupeKey);

        return {
          alertId,
          userAddress,
          asset: String(extractFieldValue(decoded[2])),
          condition: String(extractFieldValue(decoded[3])),
          thresholdPrice: String(extractFieldValue(decoded[4])),
          currentPrice: String(extractFieldValue(decoded[5])),
          triggeredAt,
        };
      } catch (err) {
        console.error("[AlertDecode] Failed to decode:", err);
        return null;
      }
    },
    [alertEncoder, decodePayload],
  );

  const addAlert = useCallback((alert: AlertNotification) => {
    const dedupeKey = `${alert.alertId}-${alert.triggeredAt}`;
    if (seenAlertIds.has(dedupeKey)) return;
    addSeenAlert(dedupeKey);
    setAlerts((prev) => [alert, ...prev].slice(0, 10));
  }, []);


  // Subscribe to price updates
  useEffect(() => {
    mountedRef.current = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // Handler for this component instance
    const handlePrice = (price: UiPrice) => {
      if (!mountedRef.current) return;
      setPrices((prev) => {
        const next = new Map(prev);
        next.set(price.symbol, price);
        return next;
      });
    };

    const handleAlert = (alert: AlertNotification) => {
      if (!mountedRef.current) return;
      const currentWallet = walletAddressRef.current;
      if (currentWallet && alert.userAddress.toLowerCase() === currentWallet.toLowerCase()) {
        setAlerts((prev) => [alert, ...prev].slice(0, 10));
      }
    };

    // Add this component as a subscriber
    globalConnection.subscribers.add(handlePrice);
    globalConnection.alertSubscribers.add(handleAlert);

    // Sync state from global connection
    const syncState = () => {
      if (!mountedRef.current) return;
      setIsConnected(globalConnection.isConnected);
      setError(globalConnection.error);
    };

    async function initConnection() {
      // If already connected or connecting, just sync state
      if (globalConnection.isConnected || globalConnection.isConnecting) {
        syncState();
        return;
      }

      // Prevent multiple simultaneous connection attempts
      if (globalConnection.isConnecting) return;
      globalConnection.isConnecting = true;

      try {
        console.log("[PriceSub] Creating shared WebSocket connection...");
        const wsClient = createWsClient();
        const sdk = new SDK({ public: wsClient });
        globalConnection.sdk = sdk;

        // Subscribe to price updates
        const priceSub = await sdk.streams.subscribe({
          somniaStreamsEventId: PRICE_UPDATE_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const priceEncoder = new SchemaEncoder(PRICE_FEED_SCHEMA);
            const decoded = decodePayloadStatic(data, priceEncoder);
            if (!decoded || decoded.length < 6) return;

            const price = decodePriceStatic(decoded);
            if (price) {
              globalConnection.subscribers.forEach(cb => cb(price));
            }
          },
          onError: (err: Error) => {
            console.error("[PriceSub] Stream error:", err.message);
            globalConnection.isConnected = false;
            globalConnection.error = err.message;
            globalConnection.subscribers.forEach(() => syncState());
            
            // Schedule reconnect
            if (!cancelled) {
              reconnectTimer = setTimeout(() => {
                globalConnection.isConnecting = false;
                initConnection();
              }, RECONNECT_DELAY);
            }
          },
        });

        if (priceSub instanceof Error) {
          throw priceSub;
        }

        globalConnection.priceUnsubscribe = priceSub?.unsubscribe;

        // Subscribe to alerts
        const alertSub = await sdk.streams.subscribe({
          somniaStreamsEventId: ALERT_TRIGGERED_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const alertEncoder = new SchemaEncoder(ALERT_SCHEMA);
            const decoded = decodePayloadStatic(data, alertEncoder);
            if (!decoded || decoded.length < 7) return;

            const alert = decodeAlertStatic(decoded);
            if (alert) {
              globalConnection.alertSubscribers.forEach(cb => cb(alert));
            }
          },
          onError: (err: Error) => {
            console.error("[AlertSub] Stream error:", err.message);
          },
        });

        if (!(alertSub instanceof Error)) {
          globalConnection.alertUnsubscribe = alertSub?.unsubscribe;
        }

        globalConnection.isConnected = true;
        globalConnection.isConnecting = false;
        globalConnection.error = null;
        console.log("[PriceSub] ✓ Connected to Somnia Data Streams");
        syncState();

      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to subscribe";
        console.error("[PriceSub] Connection failed:", message);
        globalConnection.isConnected = false;
        globalConnection.isConnecting = false;
        globalConnection.error = message;
        syncState();

        // Schedule reconnect
        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            initConnection();
          }, RECONNECT_DELAY);
        }
      }
    }

    initConnection();

    return () => {
      mountedRef.current = false;
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      
      // Remove this component from subscribers
      globalConnection.subscribers.delete(handlePrice);
      globalConnection.alertSubscribers.delete(handleAlert);

      // Only cleanup global connection if no more subscribers
      if (globalConnection.subscribers.size === 0) {
        console.log("[PriceSub] No more subscribers, cleaning up connection");
        globalConnection.priceUnsubscribe?.();
        globalConnection.alertUnsubscribe?.();
        globalConnection.sdk = null;
        globalConnection.priceUnsubscribe = null;
        globalConnection.alertUnsubscribe = null;
        globalConnection.isConnected = false;
        globalConnection.isConnecting = false;
      }
    };
  }, []); // Empty deps - connection is managed globally

  return {
    prices: Array.from(prices.values()),
    alerts,
    isConnected,
    error,
    addAlert,
  };
}


// Static decode functions for use in callbacks (avoid closure issues)
function decodePayloadStatic(payload: unknown, encoder: SchemaEncoder): ReturnType<SchemaEncoder["decodeData"]> | null {
  if (typeof payload === "string") {
    try {
      return encoder.decodeData(payload as `0x${string}`);
    } catch {
      return null;
    }
  }
  if (Array.isArray(payload)) {
    return payload as ReturnType<SchemaEncoder["decodeData"]>;
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data: unknown }).data;
    return decodePayloadStatic(data, encoder);
  }
  return null;
}

function decodePriceStatic(decoded: ReturnType<SchemaEncoder["decodeData"]>): UiPrice | null {
  try {
    const timestamp = Number(extractFieldValue(decoded[0]) as string | number);
    const symbol = String(extractFieldValue(decoded[1]));
    const priceRaw = BigInt(extractFieldValue(decoded[2]) as string | number | bigint);
    const decimals = Number(extractFieldValue(decoded[3]) as string | number);
    const source = String(extractFieldValue(decoded[4])) as UiPrice["source"];
    const sourceAddress = String(extractFieldValue(decoded[5]));

    const divisor = BigInt(10 ** decimals);
    const whole = priceRaw / divisor;
    const fraction = priceRaw % divisor;
    const formatted = `${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 2)}`;

    return { symbol, price: formatted, priceRaw: priceRaw.toString(), decimals, source, timestamp, sourceAddress };
  } catch {
    return null;
  }
}

function decodeAlertStatic(decoded: ReturnType<SchemaEncoder["decodeData"]>): AlertNotification | null {
  try {
    const alertId = String(extractFieldValue(decoded[0]));
    const userAddress = String(extractFieldValue(decoded[1]));
    const triggeredAtRaw = extractFieldValue(decoded[6]);
    const triggeredAt = Number(triggeredAtRaw as string | number | bigint);
    const dedupeKey = `${alertId}-${triggeredAt}`;
    if (seenAlertIds.has(dedupeKey)) return null;
    addSeenAlert(dedupeKey);

    return {
      alertId,
      userAddress,
      asset: String(extractFieldValue(decoded[2])),
      condition: String(extractFieldValue(decoded[3])),
      thresholdPrice: String(extractFieldValue(decoded[4])),
      currentPrice: String(extractFieldValue(decoded[5])),
      triggeredAt,
    };
  } catch {
    return null;
  }
}
