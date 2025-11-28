/**
 * Alert Testing Script
 * 
 * This script tests the full alert flow:
 * 1. Creates a test alert with a threshold that WILL trigger
 * 2. Publishes a price that crosses the threshold
 * 3. Verifies the alert was triggered
 * 
 * Usage:
 *   npx tsx scripts/test-alerts.ts
 *   npx tsx scripts/test-alerts.ts --symbol=SOL --condition=ABOVE --threshold=100
 */

import "dotenv/config";
import { registerPriceFeedSchema, publishPrice, fetchBestPrice } from "@/lib/services/pricePublisher";
import { registerAlertSchema, createAlert, getActiveAlerts, checkAlerts } from "@/lib/services/alertService";
import { formatPrice, parsePrice } from "@/lib/schemas";
import { getPublisherAddress } from "@/lib/clients";

// Parse command line arguments (support npm/yarn/tsx invocation quirks)
const scriptIndex = process.argv.findIndex((arg) => arg.endsWith("test-alerts.ts"));
const args =
  scriptIndex >= 0 ? process.argv.slice(scriptIndex + 1) : process.argv.slice(2);
const symbolArg = args.find((a) => a.startsWith("--symbol="));
const conditionArg = args.find((a) => a.startsWith("--condition="));
const thresholdArg = args.find((a) => a.startsWith("--threshold="));

const testSymbol = symbolArg?.split("=")[1] || "BTC";
const testCondition = (conditionArg?.split("=")[1]?.toUpperCase() || "BELOW") as "ABOVE" | "BELOW";

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 Alert Testing Script");
  console.log("=".repeat(60));
  console.log("");

  // Step 1: Register schemas
  console.log("📝 Step 1: Registering schemas...");
  await registerPriceFeedSchema();
  await registerAlertSchema();
  console.log("✅ Schemas ready\n");

  // Step 2: Get current price
  console.log(`📊 Step 2: Fetching current ${testSymbol} price...`);
  const currentPrice = await fetchBestPrice(testSymbol);
  const currentPriceFormatted = formatPrice(currentPrice.price, currentPrice.decimals, 2);
  console.log(`   Current ${testSymbol} price: $${currentPriceFormatted} (${currentPrice.source})`);
  console.log(`   Raw price: ${currentPrice.price.toString()}`);
  console.log(`   Decimals: ${currentPrice.decimals}\n`);

  // Step 3: Calculate test threshold
  // For BELOW: set threshold ABOVE current price so it triggers
  // For ABOVE: set threshold BELOW current price so it triggers
  let testThreshold: bigint;
  
  if (thresholdArg) {
    // User provided threshold
    testThreshold = parsePrice(thresholdArg.split("=")[1], currentPrice.decimals);
  } else {
    // Auto-calculate threshold that WILL trigger
    if (testCondition === "BELOW") {
      // Set threshold 5% above current price
      testThreshold = (currentPrice.price * 105n) / 100n;
    } else {
      // Set threshold 5% below current price
      testThreshold = (currentPrice.price * 95n) / 100n;
    }
  }
  
  const thresholdFormatted = formatPrice(testThreshold, currentPrice.decimals, 2);
  console.log(`🎯 Step 3: Setting up test alert...`);
  console.log(`   Asset: ${testSymbol}`);
  console.log(`   Condition: ${testCondition}`);
  console.log(`   Threshold: $${thresholdFormatted}`);
  console.log(`   Current price: $${currentPriceFormatted}`);
  
  const willTrigger = 
    (testCondition === "BELOW" && currentPrice.price <= testThreshold) ||
    (testCondition === "ABOVE" && currentPrice.price >= testThreshold);
  
  console.log(`   Expected to trigger: ${willTrigger ? "YES ✅" : "NO ❌"}\n`);

  // Step 4: Create the alert
  console.log("📢 Step 4: Creating alert on-chain...");
  const userAddress = getPublisherAddress() as `0x${string}`;
  
  try {
    const { alertId, txHash } = await createAlert({
      userAddress,
      asset: testSymbol,
      condition: testCondition,
      thresholdPrice: testThreshold,
    });
    
    console.log(`   Alert ID: ${alertId}`);
    console.log(`   Tx Hash: ${txHash}\n`);

    // Step 5: Check active alerts
    console.log("📋 Step 5: Verifying alert was created...");
    const activeAlerts = await getActiveAlerts();
    const ourAlert = activeAlerts.find((a) => a.alertId === alertId);
    
    if (ourAlert) {
      console.log(`   ✅ Alert found in active alerts`);
      console.log(`   Status: ${ourAlert.status}`);
      console.log(`   Total active alerts: ${activeAlerts.length}\n`);
    } else {
      console.log(`   ⚠️ Alert not found in active alerts (may take a moment to index)\n`);
    }

    // Step 6: Publish price and check if alert triggers
    console.log("🚀 Step 6: Publishing price to trigger alert check...");
    const { txHash: publishTxHash, priceData } = await publishPrice(testSymbol);
    console.log(`   Published price: $${formatPrice(priceData.price, priceData.decimals, 2)}`);
    console.log(`   Tx Hash: ${publishTxHash}\n`);

    // Step 7: Manually check alerts (in case the publish didn't trigger it)
    console.log("🔍 Step 7: Manually checking alerts...");
    const triggered = await checkAlerts(testSymbol, priceData.price);
    
    if (triggered.length > 0) {
      console.log(`   🎉 ${triggered.length} alert(s) triggered!`);
      triggered.forEach((id) => console.log(`      - ${id}`));
    } else {
      console.log("   ℹ️ No alerts triggered (threshold not crossed or already triggered)");
    }

    // Step 8: Final status check
    console.log("\n📊 Step 8: Final alert status...");
    const finalAlerts = await getActiveAlerts();
    const finalAlert = finalAlerts.find((a) => a.alertId === alertId);
    
    if (finalAlert) {
      console.log(`   Alert still active (not triggered)`);
      console.log(`   Status: ${finalAlert.status}`);
    } else {
      console.log(`   ✅ Alert was triggered and removed from active list`);
    }

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🧪 Test complete!");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ Test script failed:", error);
  process.exit(1);
});

