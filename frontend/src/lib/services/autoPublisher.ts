/**
 * Auto Publisher Service
 * 
 * Automatically publishes price feeds at a configurable interval.
 * Can be enabled via environment variable: AUTO_PUBLISH=true
 * 
 * This runs as a singleton within the Next.js server process.
 */

import { publishAllPrices, registerPriceFeedSchema, setPublisherConfig, getDefaultSymbols } from "./pricePublisher";
import { registerAlertSchema } from "./alertService";

// Configuration from environment
const AUTO_PUBLISH_ENABLED = process.env.AUTO_PUBLISH === "true";
const AUTO_PUBLISH_INTERVAL = parseInt(process.env.AUTO_PUBLISH_INTERVAL || "30", 10) * 1000; // Default 30s
const AUTO_PUBLISH_SYMBOLS = process.env.AUTO_PUBLISH_SYMBOLS?.split(",") || getDefaultSymbols();

// Singleton state
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastPublishTime: number | null = null;
let lastPublishCount = 0;
let totalPublishes = 0;

export interface AutoPublisherStatus {
  enabled: boolean;
  running: boolean;
  interval: number;
  symbols: string[];
  lastPublishTime: number | null;
  lastPublishCount: number;
  totalPublishes: number;
}

/**
 * Get the current status of the auto publisher
 */
export function getAutoPublisherStatus(): AutoPublisherStatus {
  return {
    enabled: AUTO_PUBLISH_ENABLED,
    running: isRunning,
    interval: AUTO_PUBLISH_INTERVAL,
    symbols: AUTO_PUBLISH_SYMBOLS,
    lastPublishTime,
    lastPublishCount,
    totalPublishes,
  };
}

/**
 * Initialize and start the auto publisher if enabled
 */
export async function initAutoPublisher(): Promise<void> {
  if (!AUTO_PUBLISH_ENABLED) {
    console.log("[AutoPublisher] Disabled (set AUTO_PUBLISH=true to enable)");
    return;
  }

  if (isRunning) {
    console.log("[AutoPublisher] Already running");
    return;
  }

  console.log("[AutoPublisher] Initializing...");
  console.log(`[AutoPublisher] Interval: ${AUTO_PUBLISH_INTERVAL / 1000}s`);
  console.log(`[AutoPublisher] Symbols: ${AUTO_PUBLISH_SYMBOLS.join(", ")}`);

  // Configure the publisher
  setPublisherConfig({
    priority: "OFFCHAIN_FIRST",
    enableCoinGecko: true,
    enableDIA: true,
    enableProtofire: false,
    publishIntervalMs: AUTO_PUBLISH_INTERVAL,
    symbolDelayMs: 300,
  });

  try {
    // Register schemas first
    console.log("[AutoPublisher] Registering schemas...");
    await registerPriceFeedSchema();
    await registerAlertSchema();
    console.log("[AutoPublisher] Schemas ready");

    // Start the publishing loop
    isRunning = true;
    
    // Publish immediately on start
    await publishCycle();

    // Then set up the interval
    intervalId = setInterval(publishCycle, AUTO_PUBLISH_INTERVAL);
    
    console.log("[AutoPublisher] Started successfully");
  } catch (error) {
    console.error("[AutoPublisher] Failed to initialize:", error);
    isRunning = false;
  }
}

/**
 * Stop the auto publisher
 */
export function stopAutoPublisher(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  console.log("[AutoPublisher] Stopped");
}

/**
 * Single publish cycle
 */
async function publishCycle(): Promise<void> {
  try {
    console.log(`[AutoPublisher] Publishing ${AUTO_PUBLISH_SYMBOLS.length} symbols...`);
    const results = await publishAllPrices(AUTO_PUBLISH_SYMBOLS);
    
    lastPublishTime = Date.now();
    lastPublishCount = results.length;
    totalPublishes += results.length;
    
    console.log(`[AutoPublisher] Published ${results.length}/${AUTO_PUBLISH_SYMBOLS.length} prices`);
  } catch (error) {
    console.error("[AutoPublisher] Publish cycle failed:", error);
  }
}

/**
 * Manually trigger a publish cycle (useful for testing)
 */
export async function triggerManualPublish(): Promise<{ count: number; symbols: string[] }> {
  if (!AUTO_PUBLISH_ENABLED) {
    throw new Error("Auto publisher is not enabled");
  }
  
  await publishCycle();
  return {
    count: lastPublishCount,
    symbols: AUTO_PUBLISH_SYMBOLS,
  };
}

