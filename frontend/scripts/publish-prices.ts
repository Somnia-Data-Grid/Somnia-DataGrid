import "dotenv/config";
import {
  publishAllPrices,
  registerPriceFeedSchema,
  setPublisherConfig,
  getDefaultSymbols,
  startContinuousPublishing,
} from "@/lib/services/pricePublisher";
import { registerAlertSchema } from "@/lib/services/alertService";

// Parse command line arguments
const args = process.argv.slice(2);
const isContinuous = args.includes("--continuous") || args.includes("-c");
const intervalArg = args.find((a) => a.startsWith("--interval="));
const intervalMs = intervalArg ? parseInt(intervalArg.split("=")[1], 10) * 1000 : 30000;
const symbolsArg = args.find((a) => a.startsWith("--symbols="));
const symbols = symbolsArg ? symbolsArg.split("=")[1].split(",") : getDefaultSymbols();

async function main() {
  console.log("=".repeat(60));
  console.log("🚀 Somnia AlertGrid Price Publisher");
  console.log("=".repeat(60));
  console.log("");
  console.log("📊 Configuration:");
  console.log(`   Source Priority: OFFCHAIN_FIRST (CoinGecko → DIA fallback)`);
  console.log(`   Symbols: ${symbols.join(", ")}`);
  console.log(`   Mode: ${isContinuous ? `Continuous (every ${intervalMs / 1000}s)` : "Single run"}`);
  console.log("");

  // Configure publisher to use off-chain first
  setPublisherConfig({
    priority: "OFFCHAIN_FIRST",
    enableCoinGecko: true,
    enableDIA: true,
    enableProtofire: false,
    publishIntervalMs: intervalMs,
    symbolDelayMs: 300,
  });

  console.log("📝 Registering schemas (idempotent)...");
  await registerPriceFeedSchema();
  await registerAlertSchema();
  console.log("✅ Schemas ready\n");

  if (isContinuous) {
    console.log("🔄 Starting continuous publishing...");
    console.log("   Press Ctrl+C to stop\n");
    
    const stop = startContinuousPublishing(symbols, intervalMs);
    
    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n\n⏹️  Stopping publisher...");
      stop();
      setTimeout(() => process.exit(0), 1000);
    });
  } else {
    console.log("📤 Publishing prices (single run)...\n");
    const results = await publishAllPrices(symbols);
    
    console.log("\n" + "=".repeat(60));
    console.log("📈 Summary:");
    console.log(`   Total: ${results.length}/${symbols.length} published`);
    results.forEach(({ symbol, priceData }) => {
      const price = Number(priceData.price) / 10 ** priceData.decimals;
      console.log(`   ${symbol}: $${price.toFixed(4)} (${priceData.source})`);
    });
    console.log("=".repeat(60));
  }
}

main().catch((error) => {
  console.error("\n❌ Publish script failed:", error);
  process.exit(1);
});

