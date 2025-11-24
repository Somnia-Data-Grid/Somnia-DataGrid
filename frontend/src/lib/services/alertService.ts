import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { waitForTransactionReceipt } from "viem/actions";
import { type Hex, keccak256, toBytes, stringToBytes } from "viem";
import {
  ALERT_PARENT,
  ALERT_SCHEMA,
  ALERT_SCHEMA_ID,
  ALERT_TRIGGERED_EVENT_ID,
  type AlertData,
} from "../schemas";
import { getPublicHttpClient, getPublisherAddress, getWalletClient } from "../clients";
import { extractFieldValue } from "../utils/streams";

// Cache schema registration status to avoid repeated checks
let schemaRegistered = false;
let eventSchemaRegistered = false;
let emitterRegistered = false;

function initSdk() {
  return new SDK({
    public: getPublicHttpClient(),
    wallet: getWalletClient(),
  });
}

export async function registerAlertSchema(): Promise<Hex | null> {
  // Skip if already registered in this session
  if (schemaRegistered && eventSchemaRegistered && emitterRegistered) {
    return null;
  }

  const sdk = initSdk();
  const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
  const schemaId = schemaIdResult as `0x${string}`;

  // Check if data schema is registered
  if (!schemaRegistered) {
    const isRegisteredResult = await sdk.streams.isDataSchemaRegistered(schemaId);
    const isRegistered = !(isRegisteredResult instanceof Error) && isRegisteredResult;

    if (!isRegistered) {
      const txHash = await sdk.streams.registerDataSchemas(
        [
          {
            schemaName: ALERT_SCHEMA_ID,
            schema: ALERT_SCHEMA,
            parentSchemaId: ALERT_PARENT as `0x${string}`,
          },
        ],
        true,
      );

      if (txHash instanceof Error) {
        throw txHash;
      }

      if (txHash) {
        await waitForTransactionReceipt(getPublicHttpClient(), { hash: txHash });
      }
    }
    schemaRegistered = true;
  }

  // Register event schema if needed
  if (!eventSchemaRegistered) {
    await ensureAlertEventSchemaRegistered(sdk);
    eventSchemaRegistered = true;
  }

  // Register emitter if needed
  if (!emitterRegistered) {
    await ensureEmitterRegistered(sdk);
    emitterRegistered = true;
  }

  return null;
}

async function ensureAlertEventSchemaRegistered(sdk: SDK) {
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
        !result.message.includes("EventSchemaAlreadyRegistered") &&
        (result as any).errorName !== "EventSchemaAlreadyRegistered"
      ) {
        // Ignore EventTopicAlreadyRegistered too
        if (
          !result.message.includes("EventTopicAlreadyRegistered") &&
          (result as any).errorName !== "EventTopicAlreadyRegistered"
        ) {
          throw result;
        }
      }
    } else if (result) {
      await waitForTransactionReceipt(getPublicHttpClient(), { hash: result });
    }
  } catch (error) {
    // Ignore "already registered" errors
    if (error instanceof Error) {
      if (
        error.message.includes("EventSchemaAlreadyRegistered") ||
        error.message.includes("EventTopicAlreadyRegistered") ||
        (error as any).errorName === "EventSchemaAlreadyRegistered" ||
        (error as any).errorName === "EventTopicAlreadyRegistered"
      ) {
        return;
      }
    }
    throw error;
  }
}

async function ensureEmitterRegistered(sdk: SDK) {
  try {
    const result = await sdk.streams.manageEventEmittersForRegisteredStreamsEvent(
      ALERT_TRIGGERED_EVENT_ID,
      getPublisherAddress() as `0x${string}`,
      true,
    );

    if (result instanceof Error) {
      // Ignore "already registered" errors
      const msg = result.message.toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("nonce") ||
        (result as any).errorName === "EventTopicAlreadyRegistered"
      ) {
        return;
      }
      throw result;
    }

    if (result) {
      await waitForTransactionReceipt(getPublicHttpClient(), { hash: result });
    }
  } catch (error) {
    // Ignore "already registered" and nonce errors (means it's already set up)
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("nonce too low") ||
        (error as any).errorName === "EventTopicAlreadyRegistered"
      ) {
        return;
      }
    }
    throw error;
  }
}

export async function createAlert({
  userAddress,
  asset,
  condition,
  thresholdPrice,
}: {
  userAddress: `0x${string}`;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: bigint;
}): Promise<{ alertId: `0x${string}`; txHash: Hex }> {
  const sdk = initSdk();
  const encoder = new SchemaEncoder(ALERT_SCHEMA);
  const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
  const schemaId = schemaIdResult as `0x${string}`;

  const alertKey = `${userAddress}-${asset}-${Date.now()}`;
  const alertId = keccak256(stringToBytes(alertKey)) as `0x${string}`;
  const now = BigInt(Math.floor(Date.now() / 1000));

  const encoded = encoder.encodeData([
    { name: "alertId", value: alertId, type: "bytes32" },
    { name: "userAddress", value: userAddress, type: "address" },
    { name: "asset", value: asset, type: "string" },
    { name: "condition", value: condition, type: "string" },
    { name: "thresholdPrice", value: thresholdPrice.toString(), type: "uint256" },
    { name: "status", value: "ACTIVE", type: "string" },
    { name: "createdAt", value: now.toString(), type: "uint64" },
    { name: "triggeredAt", value: "0", type: "uint64" },
  ]);

  const txHash = await sdk.streams.set([
    {
      id: alertId,
      schemaId,
      data: encoded,
    },
  ]);

  if (txHash instanceof Error) {
    throw txHash;
  }

  if (!txHash) {
    throw new Error("Failed to create alert");
  }

  await waitForTransactionReceipt(getPublicHttpClient(), { hash: txHash });

  return { alertId, txHash };
}

function decodeAlert(record: unknown[]): AlertData {
  if (record.length < 8) {
    throw new Error("Malformed alert record");
  }

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
}

export async function getActiveAlerts(): Promise<AlertData[]> {
  const sdk = initSdk();
  const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
  const schemaId = schemaIdResult as `0x${string}`;

  const publisher = getPublisherAddress() as `0x${string}`;
  const rawData = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher);

  if (rawData instanceof Error || !rawData?.length) {
    return [];
  }

  const alerts: AlertData[] = [];
  for (const data of rawData) {
    if (Array.isArray(data)) {
      try {
        const alert = decodeAlert(data as unknown[]);
        if (alert.status === "ACTIVE") {
          alerts.push(alert);
        }
      } catch {
        // Skip malformed records
      }
    }
  }
  return alerts;
}

export async function checkAlerts(symbol: string, currentPrice: bigint): Promise<string[]> {
  const activeAlerts = await getActiveAlerts();
  const triggered: string[] = [];

  for (const alert of activeAlerts) {
    if (alert.asset !== symbol) continue;

    const shouldTrigger =
      (alert.condition === "ABOVE" && currentPrice >= alert.thresholdPrice) ||
      (alert.condition === "BELOW" && currentPrice <= alert.thresholdPrice);

    if (shouldTrigger) {
      triggered.push(alert.alertId);
      await triggerAlert(alert, currentPrice);
    }
  }

  return triggered;
}

async function triggerAlert(alert: AlertData, currentPrice?: bigint) {
  const sdk = initSdk();
  const encoder = new SchemaEncoder(ALERT_SCHEMA);
  const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
  if (schemaIdResult instanceof Error) {
    throw schemaIdResult;
  }
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
    [
      {
        id: alert.alertId,
        schemaId,
        data: encoded,
      },
    ],
    [
      {
        id: ALERT_TRIGGERED_EVENT_ID,
        argumentTopics: [],
        data: encoded,
      },
    ],
  );

  if (txHash instanceof Error) {
    throw txHash;
  }

  if (!txHash) {
    throw new Error("Failed to update alert");
  }

  await waitForTransactionReceipt(getPublicHttpClient(), { hash: txHash });

  // Send Telegram notification (fire and forget)
  try {
    const { sendAlertNotification } = await import("../telegram/notify");
    await sendAlertNotification({
      walletAddress: alert.userAddress,
      asset: alert.asset,
      condition: alert.condition,
      thresholdPrice: alert.thresholdPrice,
      currentPrice: currentPrice ?? alert.thresholdPrice,
      decimals: 8,
    });
    console.log(`[Alert] Telegram notification sent for ${alert.alertId}`);
  } catch (error) {
    console.warn(`[Alert] Failed to send Telegram notification:`, error);
    // Don't throw - Telegram notification is best-effort
  }
}
