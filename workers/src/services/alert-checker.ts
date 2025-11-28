/**
 * Alert Checker Service
 * 
 * Reads alerts from SQLite (off-chain) and checks them against current prices.
 * When triggered:
 * 1. Updates alert status in SQLite
 * 2. Emits AlertTriggeredV2 event on-chain (for WebSocket subscribers)
 * 3. Sends Telegram notification
 * 
 * This is much faster than reading from blockchain (~5ms vs ~2s)
 */

import { createPublicClient, createWalletClient, http, type Hex, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { waitForTransactionReceipt } from "viem/actions";
import { 
  getActiveAlertsByAsset, 
  getActiveAlerts,
  triggerAlert, 
  markAlertNotified,
  getTelegramLink,
  logNotification,
  type OffchainAlert 
} from "../db/client.js";
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

// Event schema for broadcasting triggers (no data storage needed)
const ALERT_TRIGGERED_EVENT_ID = "AlertTriggeredV2";
const ALERT_EVENT_SCHEMA = "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt";

const PRICE_DECIMALS = 8;

// Track already triggered alerts in this session to avoid duplicates
const triggeredAlertIds = new Set<string>();

// Track if event schema is registered
let eventSchemaRegistered = false;

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

/**
 * Ensure the AlertTriggeredV2 event schema is registered on-chain
 */
async function ensureEventSchemaRegistered(): Promise<void> {
  if (eventSchemaRegistered) return;

  const { publicClient, walletClient } = getClients();
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  const eventSignature = `${ALERT_TRIGGERED_EVENT_ID}(bytes)`;
  const eventTopic = keccak256(toBytes(eventSignature));

  try {
    const result = await sdk.streams.registerEventSchemas([
      {
        id: ALERT_TRIGGERED_EVENT_ID,
        schema: {
          eventTopic,
          params: [{ name: "alertData", paramType: "bytes", isIndexed: false }],
        },
      },
    ]);

    if (result instanceof Error) {
      // Already registered is fine
      if (
        result.message.includes("EventSchemaAlreadyRegistered") ||
        result.message.includes("EventTopicAlreadyRegistered") ||
        (result as any).errorName === "EventSchemaAlreadyRegistered" ||
        (result as any).errorName === "EventTopicAlreadyRegistered"
      ) {
        eventSchemaRegistered = true;
        return;
      }
      throw result;
    }

    if (result) {
      await waitForTransactionReceipt(publicClient, { hash: result });
    }
    eventSchemaRegistered = true;
    console.log("[AlertChecker] Event schema registered");
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("EventSchemaAlreadyRegistered") ||
        error.message.includes("EventTopicAlreadyRegistered")
      ) {
        eventSchemaRegistered = true;
        return;
      }
    }
    console.error("[AlertChecker] Failed to register event schema:", error);
  }
}

/**
 * Emit alert triggered event on-chain (for WebSocket subscribers)
 * This does NOT store data - just broadcasts the event
 */
async function emitAlertTriggeredEvent(
  alert: OffchainAlert, 
  currentPrice: bigint
): Promise<Hex | null> {
  await ensureEventSchemaRegistered();

  const { publicClient, walletClient, account } = getClients();
  const sdk = new SDK({ public: publicClient, wallet: walletClient });
  const encoder = new SchemaEncoder(ALERT_EVENT_SCHEMA);

  const now = BigInt(Math.floor(Date.now() / 1000));

  const encoded = encoder.encodeData([
    { name: "alertId", value: alert.id as `0x${string}`, type: "bytes32" },
    { name: "userAddress", value: alert.wallet_address as `0x${string}`, type: "address" },
    { name: "asset", value: alert.asset, type: "string" },
    { name: "condition", value: alert.condition, type: "string" },
    { name: "thresholdPrice", value: alert.threshold_price, type: "uint256" },
    { name: "currentPrice", value: currentPrice.toString(), type: "uint256" },
    { name: "triggeredAt", value: now.toString(), type: "uint64" },
  ]);

  try {
    // Only emit event - no data storage
    const result = await sdk.streams.emitEvents([
      {
        id: ALERT_TRIGGERED_EVENT_ID,
        argumentTopics: [],
        data: encoded,
      },
    ]);

    if (result instanceof Error) {
      throw result;
    }

    if (result) {
      await waitForTransactionReceipt(publicClient, { hash: result });
      console.log(`[AlertChecker] Event emitted for ${alert.id.slice(0, 10)}...`);
      return result;
    }

    return null;
  } catch (error) {
    console.error(`[AlertChecker] Failed to emit event:`, error);
    return null;
  }
}

/**
 * Check alerts for a specific symbol and trigger if conditions met
 * Uses SQLite for fast lookups (~5ms vs ~2s from blockchain)
 */
export async function checkAndTriggerAlerts(
  symbol: string, 
  currentPrice: bigint
): Promise<string[]> {
  // Get active alerts for this symbol from SQLite (fast!)
  const alerts = getActiveAlertsByAsset(symbol);
  const triggered: string[] = [];

  for (const alert of alerts) {
    // Skip if already triggered in this session
    if (triggeredAlertIds.has(alert.id)) continue;

    const thresholdPrice = BigInt(alert.threshold_price);
    const shouldTrigger =
      (alert.condition === "ABOVE" && currentPrice >= thresholdPrice) ||
      (alert.condition === "BELOW" && currentPrice <= thresholdPrice);

    if (shouldTrigger) {
      const priceFormatted = (Number(currentPrice) / 10 ** PRICE_DECIMALS).toFixed(2);
      const thresholdFormatted = (Number(thresholdPrice) / 10 ** PRICE_DECIMALS).toFixed(2);
      
      console.log(`[AlertChecker] 🔔 Alert triggered: ${alert.asset} ${alert.condition} $${thresholdFormatted} (current: $${priceFormatted})`);
      
      // Mark as triggered to avoid duplicates
      triggeredAlertIds.add(alert.id);
      triggered.push(alert.id);

      // Update status in SQLite
      const updatedAlert = triggerAlert(alert.id);
      if (!updatedAlert) {
        console.error(`[AlertChecker] Failed to update alert status in DB`);
        continue;
      }

      // Emit event on-chain for WebSocket subscribers (fire and forget)
      emitAlertTriggeredEvent(alert, currentPrice).catch(err => {
        console.error(`[AlertChecker] Event emission failed:`, err);
      });

      // Send Telegram notification
      try {
        const sent = await sendAlertNotification({
          alertId: alert.id,
          walletAddress: alert.wallet_address,
          asset: alert.asset,
          condition: alert.condition,
          thresholdPrice: alert.threshold_price,
          currentPrice: currentPrice.toString(),
          decimals: PRICE_DECIMALS,
        });
        
        if (sent) {
          markAlertNotified(alert.id);
          console.log(`[AlertChecker] ✅ Notification sent for ${alert.id.slice(0, 10)}...`);
        }
      } catch (error) {
        console.error(`[AlertChecker] Failed to send notification:`, error);
        logNotification(
          alert.id,
          alert.wallet_address,
          null,
          "telegram",
          "failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  }

  return triggered;
}

/**
 * Get count of active alerts (for logging)
 */
export function getActiveAlertCount(): number {
  return getActiveAlerts().length;
}
