/**
 * Somnia DataGrid Workers
 * 
 * Background services for:
 * - Price publishing to Somnia Data Streams
 * - Sentiment publishing (Fear/Greed, Token Sentiment, News)
 * - Alert checking and triggering
 * - Telegram notifications
 * - API for syncing data with frontend
 * 
 * Run with: npm run dev (development)
 * Run with: npm start (production)
 */

import "dotenv/config";
import { getDb, closeDb } from "./db/client.js";
import { startApi } from "./api.js";

// Re-export for use by other modules
export * from "./db/client.js";
export * from "./services/telegram.js";
export * from "./schemas/sentiment.js";

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 Somnia DataGrid Workers");
  console.log("═".repeat(60));
  
  // Initialize database
  console.log("[Main] Initializing database...");
  getDb();
  
  // Start API server for frontend sync
  console.log("[Main] Starting API server...");
  startApi();
  
  // Check which publishers to run
  const enablePrices = process.env.ENABLE_PRICES !== "false";
  const enableSentiment = process.env.ENABLE_SENTIMENT !== "false";

  // Start price publisher
  if (enablePrices) {
    console.log("[Main] Starting price publisher...");
    import("./services/price-publisher.js").catch(err => {
      console.error("[Main] Price publisher failed:", err);
    });
  }

  // Start sentiment publisher
  if (enableSentiment) {
    console.log("[Main] Starting sentiment publisher...");
    import("./services/sentiment-publisher.js").then(mod => {
      mod.startSentimentPublisher().catch(err => {
        console.error("[Main] Sentiment publisher failed:", err);
      });
    }).catch(err => {
      console.error("[Main] Failed to load sentiment publisher:", err);
    });
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Main] Shutting down...");
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Main] Received SIGTERM, shutting down...");
  closeDb();
  process.exit(0);
});

main().catch((error) => {
  console.error("[Main] Fatal error:", error);
  closeDb();
  process.exit(1);
});
