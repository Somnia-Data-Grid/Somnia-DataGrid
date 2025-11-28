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
  asset: string;
  condition: string;
  thresholdPrice: string;
  currentPrice: string;
  triggeredAt: number;
}

const FALLBACK_WS = "wss://dream-rpc.somnia.network/ws";
const MAX_SEEN_ALERTS = 500;

const seenAlertIds = new Set<string>();

function addSeenAlert(key: string) {
  seenAlertIds.add(key);
  if (seenAlertIds.size > MAX_SEEN_ALERTS) {
    const iterator = seenAlertIds.values();
    const oldest = iterator.next().value;
    if (oldest) seenAlertIds.delete(oldest);
  }
}

function createWsClient() {
  const url = process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? FALLBACK_WS;
  return createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(url),
  });
}

export function usePriceSubscription() {
  const [prices, setPrices] = useState<Map<string, UiPrice>>(new Map());
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPollRef = useRef<number>(0);

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
        if (!decoded || decoded.length < 6) {
          return null;
        }

        const timestamp = Number(extractFieldValue(decoded[0]) as string | number);
        const symbol = String(extractFieldValue(decoded[1]));
        const priceRaw = BigInt(extractFieldValue(decoded[2]) as string | number | bigint);
        const decimals = Number(extractFieldValue(decoded[3]) as string | number);
        const source = String(extractFieldValue(decoded[4])) as UiPrice["source"];
        const sourceAddress = String(extractFieldValue(decoded[5]));

        const divisor = BigInt(10 ** decimals);
        const whole = priceRaw / divisor;
        const fraction = priceRaw % divisor;
        const formatted = `${whole}.${fraction
          .toString()
          .padStart(decimals, "0")
          .slice(0, 2)}`;

        return {
          symbol,
          price: formatted,
          priceRaw: priceRaw.toString(),
          decimals,
          source,
          timestamp,
          sourceAddress,
        };
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
        if (!decoded || decoded.length < 7) {
          return null;
        }

        const alertId = String(extractFieldValue(decoded[0]));
        const triggeredAtRaw = extractFieldValue(decoded[6]);
        const triggeredAt = Number(triggeredAtRaw as string | number | bigint);
        const dedupeKey = `${alertId}-${triggeredAt}`;
        if (seenAlertIds.has(dedupeKey)) {
          return null;
        }
        addSeenAlert(dedupeKey);

        return {
          alertId,
          asset: String(extractFieldValue(decoded[2])),
          condition: String(extractFieldValue(decoded[3])),
          thresholdPrice: String(extractFieldValue(decoded[4])),
          currentPrice: String(extractFieldValue(decoded[5])),
          triggeredAt,
        };
      } catch {
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

  useEffect(() => {
    let wsClient: ReturnType<typeof createWsClient>;
    let sdk: SDK;
    let unsubscribePrice: (() => void) | undefined;
    let unsubscribeAlert: (() => void) | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    async function subscribe() {
      try {
        wsClient = createWsClient();
        sdk = new SDK({ public: wsClient });

        const priceSub = await sdk.streams.subscribe({
          somniaStreamsEventId: PRICE_UPDATE_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const price = decodePrice(data);
            if (price) {
              setPrices((prev) => {
                const next = new Map(prev);
                next.set(price.symbol, price);
                return next;
              });
            }
          },
          onError: (err: Error) => {
            setError(err.message);
            setIsConnected(false);
            reconnectTimer = setTimeout(subscribe, 5000);
          },
        });

        const alertSub = await sdk.streams.subscribe({
          somniaStreamsEventId: ALERT_TRIGGERED_EVENT_ID,
          ethCalls: [],
          onlyPushChanges: false,
          onData: (data: unknown) => {
            const alert = decodeAlert(data);
            if (alert) {
              setAlerts((prev) => [alert, ...prev].slice(0, 10));
            }
          },
          onError: () => {},
        });

        unsubscribePrice = priceSub instanceof Error ? undefined : priceSub?.unsubscribe;
        unsubscribeAlert = alertSub instanceof Error ? undefined : alertSub?.unsubscribe;
        setIsConnected(true);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to subscribe";
        setError(message);
        setIsConnected(false);
        reconnectTimer = setTimeout(subscribe, 5000);
      }
    }

    subscribe();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      unsubscribePrice?.();
      unsubscribeAlert?.();
    };
  }, [decodeAlert, decodePrice]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/alerts/triggered?since=" + lastPollRef.current);
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.success && data.alerts?.length) {
          data.alerts.forEach((alert: AlertNotification) => {
            addAlert(alert);
          });
          lastPollRef.current = Date.now();
        }
      } catch {
        // Polling is best-effort
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [addAlert]);

  return {
    prices: Array.from(prices.values()),
    alerts,
    isConnected,
    error,
    addAlert,
  };
}
