/**
 * Alert Checker Service
 * 
 * Reads alerts from Somnia Data Streams (blockchain) and checks them against current prices.
 * Sends Telegram notifications when alerts are triggered.
 */

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { waitForTransactionReceipt } from "viem/actions";
import { getTelegramLink, logNotification } from "../db/client.js";
import { sendAlertNotification } from "./telegram.js";

// Somnia Testnet Chain
const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
} as const;

// Alert Schema (must match web/src/lib/schemas.ts)
const ALERT_SCHEMA = "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, string status, uint64 createdAt, uint64 triggeredAt";
const ALERT_TRIGGERED_EVENT_ID = "AlertTriggeredV2";

const PRICE_DECIMALS = 8;

interface AlertData {
  alertId: `0x${string}`;
  userAddress: `0x${string}`;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: bigint;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  createdAt: bigint;
  triggeredAt: bigint;
}

// Track already triggered alerts to avoid duplicates
const triggeredAlertIds = new Set<string>();

function getClients() {
  const rpcUrl = process.env.RPC_URL || "https://dream-rpc.somnia.network";
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient, account };
}

function extractFieldValue(field: unknown): unknown {
  if (typeof field === "object" && field !== null && "value" in field) {
    return extractFieldValue((field as { value: unknown }).value);
  }
  return field;
}

function decodeAlert(record: unknown[]): AlertData | null {
  try {
    if (record.length < 8) return null;

    const extractBigInt = (val: unknown): bigint => BigInt(val as string | number | bigint);

    return {
      alertId: extractFieldValue(record[0]) as `0x${string}`,
      userAddress: extractFieldValue(record[1]) as `0x${string}`,
      asset: String(extractFieldValue(record[2])),
      condition: String(extractFieldValue(record[3])) as AlertData["condition"],
      thresholdPrice: extractBigInt(extractFieldValue(record[4])),
      status: String(extractFieldValue(record[5])) as AlertData["status"],
      createdAt: extractBigInt(extractFieldValue(record[6])),
      triggeredAt: extractBigInt(extractFieldValue(record[7])),
    };
  } catch {
    return null;
  }
}

export async function getActiveAlertsFromBlockchain(): Promise<AlertData[]> {
  const { publicClient } = getClients();
  const sdk = new SDK({ public: publicClient });
  
  const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
  if (schemaIdResult instanceof Error) {
    console.error("[AlertChecker] Failed to compute schema ID:", schemaIdResult);
    return [];
  }
  const schemaId = schemaIdResult as `0x${string}`;
  
  const publisher = process.env.PUBLISHER_ADDRESS as `0x${string}`;
  if (!publisher) {
    console.error("[AlertChecker] PUBLISHER_ADDRESS not set");
    return [];
  }

  const rawData = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher);

  if (rawData instanceof Error || !rawData?.length) {
    return [];
  }

  const alerts: AlertData[] = [];
  for (const data of rawData) {
    if (Array.isArray(data)) {
      const alert = decodeAlert(data as unknown[]);
      if (alert && alert.status === "ACTIVE") {
        alerts.push(alert);
      }
    }
  }
  
  return alerts;
}

export async function checkAndTriggerAlerts(
  symbol: string, 
  currentPrice: bigint
): Promise<string[]> {
  const alerts = await getActiveAlertsFromBlockchain();
  const triggered: string[] = [];

  for (const alert of alerts) {
    // Skip if not for this symbol
    if (alert.asset.toUpperCase() !== symbol.toUpperCase()) continue;
    
    // Skip if already triggered in this session
    if (triggeredAlertIds.has(alert.alertId)) continue;

    const shouldTrigger =
      (alert.condition === "ABOVE" && currentPrice >= alert.thresholdPrice) ||
      (alert.condition === "BELOW" && currentPrice <= alert.thresholdPrice);

    if (shouldTrigger) {
      console.log(`[AlertChecker] 🔔 Alert triggered: ${alert.asset} ${alert.condition} ${alert.thresholdPrice}`);
      
      // Mark as triggered to avoid duplicates
      triggeredAlertIds.add(alert.alertId);
      triggered.push(alert.alertId);

      // Update alert status on blockchain
      try {
        await triggerAlertOnChain(alert);
      } catch (error) {
        console.error(`[AlertChecker] Failed to update alert on chain:`, error);
      }

      // Send Telegram notification
      try {
        const sent = await sendAlertNotification({
          alertId: alert.alertId,
          walletAddress: alert.userAddress,
          asset: alert.asset,
          condition: alert.condition,
          thresholdPrice: alert.thresholdPrice.toString(),
          currentPrice: currentPrice.toString(),
          decimals: PRICE_DECIMALS,
        });
        
        if (sent) {
          console.log(`[AlertChecker] ✅ Notification sent for ${alert.alertId}`);
        }
      } catch (error) {
        console.error(`[AlertChecker] Failed to send notification:`, error);
      }
    }
  }

  return triggered;
}

async function triggerAlertOnChain(alert: AlertData): Promise<void> {
  const { publicClient, walletClient } = getClients();
  const sdk = new SDK({ public: publicClient, wallet: walletClient });
  const encoder = new SchemaEncoder(ALERT_SCHEMA);
  
  const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
  if (schemaIdResult instanceof Error) throw schemaIdResult;
  const schemaId = schemaIdResult as `0x${string}`;
  
  const now = BigInt(Math.floor(Date.now() / 1000));

  const encoded = encoder.encodeData([
    { name: "alertId", value: alert.alertId, type: "bytes32" },
    { name: "userAddress", value: alert.userAddress, type: "address" },
    { name: "asset", value: alert.asset, type: "string" },
    { name: "condition", value: alert.condition, type: "string" },
    { name: "thresholdPrice", value: alert.thresholdPrice.toString(), type: "uint256" },
    { name: "status", value: "TRIGGERED", type: "string" },
    { name: "createdAt", value: alert.createdAt.toString(), type: "uint64" },
    { name: "triggeredAt", value: now.toString(), type: "uint64" },
  ]);

  const txHash = await sdk.streams.setAndEmitEvents(
    [{ id: alert.alertId, schemaId, data: encoded }],
    [{ id: ALERT_TRIGGERED_EVENT_ID, argumentTopics: [], data: encoded }]
  );

  if (txHash instanceof Error) throw txHash;
  
  if (txHash) {
    await waitForTransactionReceipt(publicClient, { hash: txHash });
    console.log(`[AlertChecker] Alert ${alert.alertId.slice(0, 10)}... marked as TRIGGERED on chain`);
  }
}

// Get count of active alerts for logging
export async function getActiveAlertCount(): Promise<number> {
  const alerts = await getActiveAlertsFromBlockchain();
  return alerts.length;
}
