import "dotenv/config";
import { fetchProtofirePrice } from "@/lib/oracles/protofire";
import { publishPrice } from "@/lib/services/pricePublisher";
import { getLatestPrice } from "@/lib/services/priceReader";
import { formatPrice } from "@/lib/schemas";

async function run() {
  console.log("=== Somnia Integration Test ===");

  console.log("[1] Fetching Protofire BTC price…");
  const protoPrice = await fetchProtofirePrice("BTC/USD");
  console.log(
    `    -> ${formatPrice(protoPrice.price, protoPrice.decimals)} (timestamp ${protoPrice.timestamp})`,
  );

  console.log("[2] Publishing BTC price to Data Streams…");
  const publishHash = await publishPrice("BTC");
  console.log(`    -> tx ${publishHash}`);

  console.log("[3] Reading latest BTC price from Data Streams…");
  const latest = await getLatestPrice("BTC");
  if (!latest) {
    throw new Error("No BTC price found on chain");
  }
  console.log(`    -> ${formatPrice(latest.price, latest.decimals)} from ${latest.source}`);

  console.log("All integration checks passed ✅");
}

run().catch((error) => {
  console.error("Integration test failed", error);
  process.exit(1);
});

