/**
 * Register Sentiment Event Schemas on Somnia Data Streams
 * 
 * Run this once to register the event schemas before publishing sentiment data.
 * Usage: npm run register-sentiment-schemas
 */

import "dotenv/config";
import { SDK, zeroBytes32 } from "@somnia-chain/streams";
import { createWalletClient, createPublicClient, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  FEAR_GREED_SCHEMA,
  FEAR_GREED_EVENT_ID,
  TOKEN_SENTIMENT_SCHEMA,
  TOKEN_SENTIMENT_EVENT_ID,
  NEWS_EVENT_SCHEMA,
  NEWS_EVENT_EVENT_ID,
  NEWS_AGG_SCHEMA,
  NEWS_AGG_EVENT_ID,
} from "./schemas/sentiment.js";

// Somnia Testnet Chain
const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://somnia-devnet.socialscan.io" },
  },
  testnet: true,
} as const;

const RPC_URL = process.env.RPC_URL || "https://dream-rpc.somnia.network";
const PRIVATE_KEY = process.env.PUBLISHER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌ PUBLISHER_PRIVATE_KEY not set in .env");
  process.exit(1);
}

// Convert schema string to EventSchema format
function schemaStringToEventSchema(schemaStr: string, eventId: string) {
  // Parse schema string like "uint64 timestamp, uint8 score, string zone"
  const params = schemaStr.split(",").map(param => {
    const [type, name] = param.trim().split(" ");
    return {
      name: name.trim(),
      paramType: type.trim(),
      isIndexed: false,
    };
  });

  const eventTopic = keccak256(toBytes(eventId));

  return {
    eventTopic,
    params,
  };
}

async function registerSentimentSchemas() {
  console.log("🔧 Registering Sentiment Event Schemas...\n");

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(RPC_URL),
  });

  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  // Event schemas to register
  const eventSchemas = [
    {
      id: FEAR_GREED_EVENT_ID,
      schema: schemaStringToEventSchema(FEAR_GREED_SCHEMA, FEAR_GREED_EVENT_ID),
    },
    {
      id: TOKEN_SENTIMENT_EVENT_ID,
      schema: schemaStringToEventSchema(TOKEN_SENTIMENT_SCHEMA, TOKEN_SENTIMENT_EVENT_ID),
    },
    {
      id: NEWS_EVENT_EVENT_ID,
      schema: schemaStringToEventSchema(NEWS_EVENT_SCHEMA, NEWS_EVENT_EVENT_ID),
    },
    {
      id: NEWS_AGG_EVENT_ID,
      schema: schemaStringToEventSchema(NEWS_AGG_SCHEMA, NEWS_AGG_EVENT_ID),
    },
  ];

  console.log(`📋 Registering ${eventSchemas.length} event schemas...\n`);

  for (const eventSchema of eventSchemas) {
    try {
      console.log(`  Registering: ${eventSchema.id}`);
      console.log(`    Topic: ${eventSchema.schema.eventTopic}`);
      
      const result = await sdk.streams.registerEventSchemas([eventSchema]);
      
      if (result instanceof Error) {
        // Check if already registered
        if (
          result.message.includes("EventSchemaAlreadyRegistered") ||
          result.message.includes("EventTopicAlreadyRegistered") ||
          (result as any).errorName === "EventSchemaAlreadyRegistered" ||
          (result as any).errorName === "EventTopicAlreadyRegistered"
        ) {
          console.log(`  ✅ ${eventSchema.id} - Already registered`);
        } else {
          console.error(`  ❌ ${eventSchema.id} - Error:`, result.message);
        }
      } else {
        console.log(`  ✅ ${eventSchema.id} - Registered successfully`);
        console.log(`     TX: ${result}`);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("EventSchemaAlreadyRegistered") ||
          error.message.includes("EventTopicAlreadyRegistered"))
      ) {
        console.log(`  ✅ ${eventSchema.id} - Already registered`);
      } else {
        console.error(`  ❌ ${eventSchema.id} - Failed:`, error);
      }
    }
    
    // Small delay between registrations
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\n✅ Schema registration complete!");
  console.log("\nYou can now start the sentiment publisher with: npm run dev");
}

registerSentimentSchemas()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Registration failed:", error);
    process.exit(1);
  });
