/**
 * End-to-End Alert Flow Test
 * 
 * This script tests the complete alert flow:
 * 1. Register schemas
 * 2. Create an alert that WILL trigger
 * 3. Publish a price that crosses the threshold
 * 4. Verify the alert was triggered
 * 5. Check if Telegram notification was sent (if configured)
 * 
 * Usage:
 *   npx tsx scripts/test-alert-flow.ts
 */

import "dotenv/config";
import { registerPriceFeedSchema, fetchBestPrice, publishPrice } from "@/lib/services/pricePublisher";
import { registerAlertSchema, createAlert, getActiveAlerts, checkAlerts } from "@/lib/services/alertService";
import { formatPrice, parsePrice } from "@/lib/schemas";
import { getPublisherAddress } from "@/lib/clients";

const TEST_SYMBOL = "ETH"; // Use ETH for faster CoinGecko response

async function main() {
  console.log("═".repeat(60));
  console.log("🧪 End-to-End Alert Flow Test");
  console.log("═".repeat(60));
  console.log("");

  // Check environment
  console.log("📋 Environment Check:");
  console.log(`   PUBLISHER_ADDRESS: ${process.env.PUBLISHER_ADDRESS ? "✓" : "✗"}`);
  console.log(`   PRIVATE_KEY: ${process.env.PRIVATE_KEY ? "✓" : "✗"}`);
  console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? "✓ (notifications enabled)" : "✗ (notifications disabled)"}`);
  console.log("");

  // Step 1: Register schemas
  console.log("📝 Step 1: Registering schemas...");
  try {
    await registerPriceFeedSchema();
    await registerAlertSchema();
    console.log("   ✅ Schemas registered\n");
  } catch (error) {
    console.error("   ❌ Schema registration failed:", error);
    process.exit(1);
  }

  // Step 2: Get current price
  console.log(`📊 Step 2: Fetching current ${TEST_SYMBOL} price...`);
  let currentPrice;
  try {
    currentPrice = await fetchBestPrice(TEST_SYMBOL);
    const priceFormatted = formatPrice(currentPrice.price, currentPrice.decimals, 2);
    console.log(`   Current ${TEST_SYMBOL}: $${priceFormatted} (${currentPrice.source})`);
    console.log(`   Raw: ${currentPrice.price.toString()}`);
    console.log(`   Decimals: ${currentPrice.decimals}\n`);
  } catch (error) {
    console.error("   ❌ Failed to fetch price:", error);
    process.exit(1);
  }

  // Step 3: Create alert that WILL trigger
  // Set threshold 5% ABOVE current price, condition BELOW
  // This means: alert when price goes BELOW threshold (which it already is!)
  const threshold = (currentPrice.price * 105n) / 100n;
  const thresholdFormatted = formatPrice(threshold, currentPrice.decimals, 2);
  
  console.log("🎯 Step 3: Creating test alert...");
  console.log(`   Asset: ${TEST_SYMBOL}`);
  console.log(`   Condition: BELOW`);
  console.log(`   Threshold: $${thresholdFormatted}`);
  console.log(`   Current price: $${formatPrice(currentPrice.price, currentPrice.decimals, 2)}`);
  console.log(`   Will trigger: YES (current < threshold)\n`);

  const userAddress = getPublisherAddress() as `0x${string}`;
  let alertId: string;
  
  try {
    const result = await createAlert({
      userAddress,
      asset: TEST_SYMBOL,
      condition: "BELOW",
      thresholdPrice: threshold,
    });
    alertId = result.alertId;
    console.log(`   ✅ Alert created: ${alertId.slice(0, 10)}...`);
    console.log(`   Tx: ${result.txHash}\n`);
  } catch (error) {
    console.error("   ❌ Failed to create alert:", error);
    process.exit(1);
  }

  // Step 4: Verify alert is active
  console.log("📋 Step 4: Verifying alert is active...");
  try {
    const activeAlerts = await getActiveAlerts();
    const ourAlert = activeAlerts.find((a) => a.alertId === alertId);
    
    if (ourAlert) {
      console.log(`   ✅ Alert found in active list`);
      console.log(`   Status: ${ourAlert.status}`);
      console.log(`   Total active: ${activeAlerts.length}\n`);
    } else {
      console.log(`   ⚠️ Alert not found (may need indexing time)\n`);
    }
  } catch (error) {
    console.warn("   ⚠️ Could not verify alert:", error);
  }

  // Step 5: Publish price to trigger alert check
  console.log("🚀 Step 5: Publishing price to trigger alert...");
  try {
    const { txHash, priceData } = await publishPrice(TEST_SYMBOL);
    console.log(`   Published: $${formatPrice(priceData.price, priceData.decimals, 2)}`);
    console.log(`   Tx: ${txHash}\n`);
  } catch (error) {
    console.error("   ❌ Failed to publish price:", error);
    // Continue anyway to check alerts manually
  }

  // Step 6: Manually check alerts (backup)
  console.log("🔍 Step 6: Checking alerts manually...");
  try {
    const triggered = await checkAlerts(TEST_SYMBOL, currentPrice.price);
    
    if (triggered.length > 0) {
      console.log(`   🎉 ${triggered.length} alert(s) triggered!`);
      triggered.forEach((id) => console.log(`      - ${id.slice(0, 10)}...`));
    } else {
      console.log("   ℹ️ No alerts triggered (may already be triggered)");
    }
  } catch (error) {
    console.error("   ❌ Alert check failed:", error);
  }

  // Step 7: Final verification
  console.log("\n📊 Step 7: Final status check...");
  try {
    const finalAlerts = await getActiveAlerts();
    const stillActive = finalAlerts.find((a) => a.alertId === alertId);
    
    if (stillActive) {
      console.log(`   ⚠️ Alert still active (status: ${stillActive.status})`);
      console.log("   This might indicate the trigger didn't work as expected.");
    } else {
      console.log("   ✅ Alert was triggered and removed from active list!");
      console.log("   Check your Telegram if configured.");
    }
  } catch (error) {
    console.warn("   Could not verify final status:", error);
  }

  console.log("\n" + "═".repeat(60));
  console.log("🧪 Test complete!");
  console.log("═".repeat(60));
  console.log("\nNext steps:");
  console.log("1. Run `npm run dev` to start the dashboard");
  console.log("2. Open http://localhost:3000");
  console.log("3. Check if toast notifications appear");
  console.log("4. If Telegram is configured, check for bot messages");
}

main().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
