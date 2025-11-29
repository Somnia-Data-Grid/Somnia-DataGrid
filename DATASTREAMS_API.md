# Somnia DataGrid - Data Streams API

This document provides all the information needed for other developers to consume our published data streams on Somnia.

## Publisher Information

| Field | Value |
|-------|-------|
| **Publisher Address** | `0xCdBc32445c71a5d0a525060e2760bE6982606F20` |
| **Network** | Somnia Testnet (Chain ID: 50312) |
| **RPC URL** | `https://dream-rpc.somnia.network` |
| **WebSocket URL** | `wss://dream-rpc.somnia.network/ws` |

> **Note:** Schema IDs are computed deterministically from the schema string using `keccak256`. You can either use `sdk.streams.computeSchemaId(schema)` or use the pre-computed IDs below.

---

## Available Data Streams

### 1. Price Feed Stream

Real-time cryptocurrency prices from CoinGecko and DIA Oracle.

| Field | Value |
|-------|-------|
| **Schema** | `uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress` |
| **Schema ID** | `0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd` |
| **Event ID** | `PriceUpdateV2` |
| **Update Frequency** | Every 30 seconds |
| **Supported Symbols** | BTC, ETH, USDC, USDT, ARB, SOL, WETH, STT |

**Data ID Format:** `price-{symbol}` (e.g., `price-btc`, `price-eth`)

---

### 2. Fear & Greed Index Stream

Market sentiment indicator (0-100 scale).

| Field | Value |
|-------|-------|
| **Schema** | `uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate` |
| **Schema ID** | `0x2677cc5213165393c4dc709037e567c40b4c5651aa7236bed50b5c79615f690e` |
| **Event ID** | `FearGreedUpdateV1` |
| **Update Frequency** | Every 60 minutes (or when value changes) |

**Data ID:** `fear-greed-index`

**Zone Values:** `EXTREME_FEAR`, `FEAR`, `NEUTRAL`, `GREED`, `EXTREME_GREED`

---

### 3. Token Sentiment Stream

Crowd sentiment from CoinGecko votes.

| Field | Value |
|-------|-------|
| **Schema** | `uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source` |
| **Schema ID** | `0xac6d6a398b120ea9d97cf671eb2d5565c63d1a42fdb4085f6e159bf48120a002` |
| **Event ID** | `TokenSentimentUpdateV1` |
| **Update Frequency** | Every 2 hours |
| **Supported Symbols** | BTC, ETH, SOL |

**Data ID Format:** `sentiment-{symbol}` (e.g., `sentiment-btc`)

**Note:** Percentages are in basis points (7500 = 75.00%)

---

### 4. News Event Stream

Individual crypto news articles with sentiment.

| Field | Value |
|-------|-------|
| **Schema** | `bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp` |
| **Schema ID** | `0x563069d74bccf2f025244f9d6401505b503437075584ee94c9bb436afe2891cd` |
| **Event ID** | `NewsEventV1` |
| **Update Frequency** | Real-time (polled every 30 minutes) |

**Data ID:** Uses `newsId` (hash of article ID)

---

### 5. News Aggregate Stream

Aggregated news sentiment per symbol.

| Field | Value |
|-------|-------|
| **Schema** | `uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd` |
| **Schema ID** | `0xcd70abe18f00ff9fbde632bd8d885314af623f6020e4d73d5f0acd1cfeef8de8` |
| **Event ID** | `NewsAggregateV1` |
| **Update Frequency** | Every 60 minutes |

**Data ID Format:** `news-agg-{symbol}` (e.g., `news-agg-btc`)

---

### 6. Alert Triggered Event Stream

Emitted when a price alert is triggered (event only, no data storage).

| Field | Value |
|-------|-------|
| **Schema** | `bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt` |
| **Schema ID** | `0x23a742dfe97765a981a611d4e2a1d911bcc5f683ecfb8704f90cb146e0c29d45` |
| **Event ID** | `AlertTriggeredV2` |

---

## Quick Start

### Installation

```bash
npm install @somnia-chain/streams viem dotenv
```

### Network Configuration

Create `dream-chain.js`:

```javascript
const { defineChain } = require("viem");

const dreamChain = defineChain({
  id: 50312,
  name: "Somnia Dream",
  network: "somnia-dream",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
});

module.exports = { dreamChain };
```

### Environment Setup

Create `.env`:

```bash
# Only needed if you want to publish (not required for reading)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# DataGrid publisher address (for reading our streams)
PUBLISHER_WALLET=0xCdBc32445c71a5d0a525060e2760bE6982606F20
```

---

## Reading Data (Subscriber)

### Read All Prices

```javascript
const { SDK, SchemaEncoder } = require("@somnia-chain/streams");
const { createPublicClient, http } = require("viem");
const { dreamChain } = require("./dream-chain");
require("dotenv").config();

const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";
const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";

async function getAllPrices() {
  const publicClient = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: publicClient });

  const schemaId = await sdk.streams.computeSchemaId(PRICE_SCHEMA);
  console.log("Price Schema ID:", schemaId);

  const allData = await sdk.streams.getAllPublisherDataForSchema(schemaId, PUBLISHER);

  if (!allData || allData instanceof Error) {
    console.log("No data found");
    return [];
  }

  const prices = [];
  for (const dataItem of allData) {
    const fields = dataItem.data ?? dataItem;
    
    let timestamp, symbol, price, decimals, source, sourceAddress;
    
    for (const field of fields) {
      const val = field.value?.value ?? field.value;
      if (field.name === "timestamp") timestamp = Number(val);
      if (field.name === "symbol") symbol = String(val);
      if (field.name === "price") price = BigInt(val);
      if (field.name === "decimals") decimals = Number(val);
      if (field.name === "source") source = String(val);
      if (field.name === "sourceAddress") sourceAddress = String(val);
    }

    if (symbol && price) {
      const priceUSD = Number(price) / 10 ** decimals;
      prices.push({ symbol, price: priceUSD, source, timestamp });
      console.log(`${symbol}: $${priceUSD.toFixed(2)} (${source})`);
    }
  }

  return prices;
}

getAllPrices();
```

### Read Fear & Greed Index

```javascript
const { SDK } = require("@somnia-chain/streams");
const { createPublicClient, http } = require("viem");
const { dreamChain } = require("./dream-chain");

const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";
const FEAR_GREED_SCHEMA = "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate";

async function getFearGreed() {
  const publicClient = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: publicClient });

  const schemaId = await sdk.streams.computeSchemaId(FEAR_GREED_SCHEMA);
  const data = await sdk.streams.getLastPublishedDataForSchema(schemaId, PUBLISHER);

  if (!data || data instanceof Error || !data.length) {
    console.log("No Fear & Greed data found");
    return null;
  }

  const fields = data[0].data ?? data[0];
  let score, zone;

  for (const field of fields) {
    const val = field.value?.value ?? field.value;
    if (field.name === "score") score = Number(val);
    if (field.name === "zone") zone = String(val);
  }

  console.log(`Fear & Greed Index: ${score} (${zone})`);
  return { score, zone };
}

getFearGreed();
```

### Read Token Sentiment

```javascript
const { SDK } = require("@somnia-chain/streams");
const { createPublicClient, http } = require("viem");
const { dreamChain } = require("./dream-chain");

const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";
const SENTIMENT_SCHEMA = "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source";

async function getTokenSentiment() {
  const publicClient = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: publicClient });

  const schemaId = await sdk.streams.computeSchemaId(SENTIMENT_SCHEMA);
  const allData = await sdk.streams.getAllPublisherDataForSchema(schemaId, PUBLISHER);

  if (!allData || allData instanceof Error) {
    console.log("No sentiment data found");
    return [];
  }

  for (const dataItem of allData) {
    const fields = dataItem.data ?? dataItem;
    
    let symbol, upPercent, downPercent, netScore;
    
    for (const field of fields) {
      const val = field.value?.value ?? field.value;
      if (field.name === "symbol") symbol = String(val);
      if (field.name === "upPercent") upPercent = Number(val) / 100; // basis points to %
      if (field.name === "downPercent") downPercent = Number(val) / 100;
      if (field.name === "netScore") netScore = Number(val) / 100;
    }

    if (symbol) {
      console.log(`${symbol}: ${upPercent.toFixed(1)}% bullish, ${downPercent.toFixed(1)}% bearish`);
    }
  }
}

getTokenSentiment();
```

---

## Real-Time Polling Subscriber

Poll for updates every few seconds (simple approach):

```javascript
const { SDK } = require("@somnia-chain/streams");
const { createPublicClient, http } = require("viem");
const { dreamChain } = require("./dream-chain");

const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";
const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";

async function main() {
  const publicClient = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: publicClient });

  const schemaId = await sdk.streams.computeSchemaId(PRICE_SCHEMA);
  const seen = new Set();

  console.log("🔄 Polling for price updates...\n");

  setInterval(async () => {
    try {
      const allData = await sdk.streams.getAllPublisherDataForSchema(schemaId, PUBLISHER);

      if (!allData || allData instanceof Error) return;

      for (const dataItem of allData) {
        const fields = dataItem.data ?? dataItem;
        
        let timestamp, symbol, price, decimals, source;
        
        for (const field of fields) {
          const val = field.value?.value ?? field.value;
          if (field.name === "timestamp") timestamp = Number(val);
          if (field.name === "symbol") symbol = String(val);
          if (field.name === "price") price = BigInt(val);
          if (field.name === "decimals") decimals = Number(val);
          if (field.name === "source") source = String(val);
        }

        const id = `${symbol}-${timestamp}`;
        if (!seen.has(id) && symbol && price) {
          seen.add(id);
          const priceUSD = Number(price) / 10 ** decimals;
          const time = new Date(timestamp * 1000).toLocaleTimeString();
          console.log(`🆕 ${symbol}: $${priceUSD.toFixed(2)} (${source}) at ${time}`);
        }
      }
    } catch (err) {
      console.error("Poll error:", err.message);
    }
  }, 5000); // Poll every 5 seconds
}

main();
```

---

## WebSocket Subscription (Real-Time)

For true real-time updates using WebSocket:

```javascript
const { SDK, SchemaEncoder } = require("@somnia-chain/streams");
const { createPublicClient, webSocket } = require("viem");
const { dreamChain } = require("./dream-chain");

const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";

async function subscribeToPrice() {
  // Use WebSocket transport for subscriptions
  const wsClient = createPublicClient({
    chain: dreamChain,
    transport: webSocket("wss://dream-rpc.somnia.network/ws"),
  });

  const sdk = new SDK({ public: wsClient });
  const encoder = new SchemaEncoder(PRICE_SCHEMA);

  console.log("📡 Subscribing to PriceUpdateV2 events...\n");

  const subscription = await sdk.streams.subscribe({
    somniaStreamsEventId: "PriceUpdateV2",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data) => {
      try {
        // Decode the event data
        const decoded = encoder.decodeData(data.result.data);
        
        let timestamp, symbol, price, decimals, source;
        
        for (const field of decoded) {
          const val = field.value?.value ?? field.value;
          if (field.name === "timestamp") timestamp = Number(val);
          if (field.name === "symbol") symbol = String(val);
          if (field.name === "price") price = BigInt(val);
          if (field.name === "decimals") decimals = Number(val);
          if (field.name === "source") source = String(val);
        }

        if (symbol && price) {
          const priceUSD = Number(price) / 10 ** decimals;
          const time = new Date(timestamp * 1000).toLocaleTimeString();
          console.log(`📈 ${symbol}: $${priceUSD.toFixed(2)} (${source}) at ${time}`);
        }
      } catch (err) {
        console.error("Decode error:", err.message);
      }
    },
    onError: (err) => {
      console.error("Subscription error:", err);
    },
  });

  console.log("✅ Subscribed! Waiting for updates...\n");

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nUnsubscribing...");
    subscription.unsubscribe();
    process.exit(0);
  });
}

subscribeToPrice();
```

---

## All Schemas Reference

```javascript
// ============ Publisher ============
const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";

// ============ Price Feed ============
const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
const PRICE_EVENT_ID = "PriceUpdateV2";

// ============ Fear & Greed ============
const FEAR_GREED_SCHEMA = "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate";
const FEAR_GREED_EVENT_ID = "FearGreedUpdateV1";

// ============ Token Sentiment ============
const TOKEN_SENTIMENT_SCHEMA = "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source";
const TOKEN_SENTIMENT_EVENT_ID = "TokenSentimentUpdateV1";

// ============ News Event ============
const NEWS_EVENT_SCHEMA = "bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp";
const NEWS_EVENT_EVENT_ID = "NewsEventV1";

// ============ News Aggregate ============
const NEWS_AGG_SCHEMA = "uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd";
const NEWS_AGG_EVENT_ID = "NewsAggregateV1";

// ============ Alert Triggered (event only) ============
const ALERT_TRIGGERED_SCHEMA = "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt";
const ALERT_TRIGGERED_EVENT_ID = "AlertTriggeredV2";
```

---

## Get Schema IDs

Schema IDs are computed from the schema string. Run this script to get all Schema IDs:

```javascript
// get-schema-ids.js
const { SDK } = require("@somnia-chain/streams");
const { createPublicClient, http } = require("viem");
const { dreamChain } = require("./dream-chain");

const SCHEMAS = {
  PRICE: "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress",
  FEAR_GREED: "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate",
  TOKEN_SENTIMENT: "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source",
  NEWS_EVENT: "bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp",
  NEWS_AGG: "uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd",
  ALERT_TRIGGERED: "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt",
};

async function main() {
  const publicClient = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: publicClient });

  console.log("DataGrid Schema IDs:\n");
  
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const schemaId = await sdk.streams.computeSchemaId(schema);
    console.log(`${name}:`);
    console.log(`  Schema: "${schema}"`);
    console.log(`  ID: ${schemaId}\n`);
  }
}

main();
```

Run with: `node get-schema-ids.js`

This will output all the Schema IDs you need to query our data streams.

---

## Notes

- **Price decimals:** All prices use 8 decimals (divide by 10^8 to get USD value)
- **Percentages:** Sentiment percentages are in basis points (divide by 100 to get %)
- **Timestamps:** All timestamps are Unix timestamps in seconds
- **Schema IDs:** Computed deterministically from schema string using `sdk.streams.computeSchemaId()`
- **Field Access:** Use `field.value?.value ?? field.value` to handle nested value objects

## Support

- Somnia Docs: [docs.somnia.network](https://docs.somnia.network)
- Somnia Data Streams SDK: [@somnia-chain/streams](https://www.npmjs.com/package/@somnia-chain/streams)
