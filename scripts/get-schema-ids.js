/**
 * Get DataGrid Schema IDs
 * 
 * Run this script to get all Schema IDs for DataGrid data streams.
 * 
 * Usage (from project root):
 *   cd workers && node ../scripts/get-schema-ids.js
 * 
 * Or install deps first:
 *   npm install @somnia-chain/streams viem
 *   node scripts/get-schema-ids.js
 */

const { SDK } = require("@somnia-chain/streams");
const { createPublicClient, http, defineChain } = require("viem");

const dreamChain = defineChain({
  id: 50312,
  name: "Somnia Dream",
  network: "somnia-dream",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
});

const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";

const SCHEMAS = {
  PRICE_FEED: {
    schema: "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress",
    eventId: "PriceUpdateV2",
    description: "Real-time crypto prices (BTC, ETH, etc.)",
  },
  FEAR_GREED: {
    schema: "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate",
    eventId: "FearGreedUpdateV1",
    description: "Market Fear & Greed Index (0-100)",
  },
  TOKEN_SENTIMENT: {
    schema: "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source",
    eventId: "TokenSentimentUpdateV1",
    description: "Crowd sentiment per token",
  },
  NEWS_EVENT: {
    schema: "bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp",
    eventId: "NewsEventV1",
    description: "Individual news articles",
  },
  NEWS_AGGREGATE: {
    schema: "uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd",
    eventId: "NewsAggregateV1",
    description: "Aggregated news sentiment",
  },
  ALERT_TRIGGERED: {
    schema: "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt",
    eventId: "AlertTriggeredV2",
    description: "Price alert trigger events",
  },
};

async function main() {
  const publicClient = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: publicClient });

  console.log("═".repeat(70));
  console.log("📊 Somnia DataGrid - Schema IDs");
  console.log("═".repeat(70));
  console.log(`Publisher: ${PUBLISHER}`);
  console.log(`Network: Somnia Testnet (Chain ID: 50312)`);
  console.log("═".repeat(70));
  console.log();

  for (const [name, { schema, eventId, description }] of Object.entries(SCHEMAS)) {
    const schemaId = await sdk.streams.computeSchemaId(schema);
    
    console.log(`📌 ${name}`);
    console.log(`   ${description}`);
    console.log(`   Schema ID: ${schemaId}`);
    console.log(`   Event ID:  ${eventId}`);
    console.log();
  }

  console.log("═".repeat(70));
  console.log("Use these Schema IDs with sdk.streams.getAllPublisherDataForSchema()");
  console.log("═".repeat(70));
}

main().catch(console.error);
