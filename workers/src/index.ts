/**
 * Somnia DeFi Workers
 * 
 * Background services for:
 * - Price publishing to Somnia Data Streams
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

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 Somnia DeFi Workers");
  console.log("═".repeat(60));
  
  // Initialize database
  console.log("[Main] Initializing database...");
  getDb();
  
  // Start API server for frontend sync
  console.log("[Main] Starting API server...");
  startApi();
  
  // Import and run price publisher
  console.log("[Main] Starting price publisher...");
  await import("./services/price-publisher.js");
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
