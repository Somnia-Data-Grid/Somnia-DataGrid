# Somnia DataGrid - Architecture Deep Dive

This document explains how Somnia DataGrid leverages Somnia Data Streams to provide shared market data infrastructure for the Somnia ecosystem.

**DataGrid** = The infrastructure (workers that publish price feeds)
**AlertGrid** = The reference dapp (frontend that consumes the feeds)

---

## Table of Contents
1. [Somnia Data Streams Overview](#1-somnia-data-streams-overview)
2. [Price Feed Architecture](#2-price-feed-architecture)
3. [Alert System Architecture](#3-alert-system-architecture)
4. [WebSocket Event Subscription](#4-websocket-event-subscription)
5. [Web & Workers Architecture](#5-web--workers-architecture)
6. [Deployment Scenarios](#6-deployment-scenarios)

---

## 1. Somnia Data Streams Overview

### What is Somnia Data Streams?
Somnia Data Streams is an on-chain data layer built on Somnia blockchain that allows:
- **Publishing structured data** with defined schemas
- **Emitting events** that can be subscribed to via WebSocket
- **Reading data** from the blockchain by schema and publisher

### SDK Usage (`@somnia-chain/streams`)
```typescript
import { SDK, SchemaEncoder } from "@somnia-chain/streams";

// Initialize SDK with viem clients
const sdk = new SDK({
  public: publicClient,   // For reading
  wallet: walletClient,   // For writing (requires private key)
});
```

### Key Concepts

#### 1. Schemas
Schemas define the structure of data stored on-chain:
```typescript
// Price Feed Schema
const PRICE_FEED_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";

// Alert Schema  
const ALERT_SCHEMA = "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, string status, uint64 createdAt, uint64 triggeredAt";
```

#### 2. Schema Registration
Before publishing data, schemas must be registered:
```typescript
// Compute schema ID (deterministic hash)
const schemaId = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);

// Check if already registered
const isRegistered = await sdk.streams.isDataSchemaRegistered(schemaId);

// Register if needed
if (!isRegistered) {
  await sdk.streams.registerDataSchemas([{
    schemaName: "defi_price_feed",
    schema: PRICE_FEED_SCHEMA,
    parentSchemaId: zeroBytes32,  // No parent
  }], true);
}
```

#### 3. Event Schemas
Events allow real-time subscriptions:
```typescript
// Register event schema
await sdk.streams.registerEventSchemas([{
  id: "PriceUpdateV2",
  schema: {
    eventTopic: keccak256(toBytes("PriceUpdateV2(bytes)")),
    params: [{ name: "priceData", paramType: "bytes", isIndexed: false }],
  },
}]);

// Register emitter (who can emit this event)
await sdk.streams.manageEventEmittersForRegisteredStreamsEvent(
  "PriceUpdateV2",
  publisherAddress,
  true  // allow
);
```

---

## 2. Price Feed Architecture

### Data Flow
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────┐
│   CoinGecko     │────▶│                 │────▶│   Somnia Data Streams   │
│   (Off-chain)   │     │  Price          │     │   (On-chain storage)    │
└─────────────────┘     │  Publisher      │     └─────────────────────────┘
                        │  (Workers)      │                │
┌─────────────────┐     │                 │                ▼
│   DIA Oracle    │────▶│                 │────▶│   PriceUpdateV2 Event   │
│   (On-chain)    │     └─────────────────┘     │   (WebSocket broadcast) │
└─────────────────┘                             └─────────────────────────┘
```

### Price Sources

#### CoinGecko (Primary - Off-chain)
- **Type**: REST API (off-chain)
- **Assets**: BTC, ETH, USDC, USDT, ARB, SOL, WETH, LINK, UNI, etc.
- **Rate Limit**: 30 calls/min per Demo API key
- **Multi-key Fallback**: Supports up to 3 API keys with automatic rotation

```typescript
// workers/src/services/coingecko.ts
const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  // ...
};

// Fetch prices
const prices = await coingeckoClient.fetchPrices(["BTC", "ETH"]);
// Returns: Map<symbol, { price: bigint, timestamp: bigint }>
```

#### DIA Oracle (Secondary - On-chain)
- **Type**: Smart contract on Somnia Testnet
- **Address**: `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D`
- **Assets**: SOMI (Somnia token), BTC, ETH, USDC, USDT, ARB, SOL
- **Use Case**: Somnia-native tokens + fallback for CoinGecko failures

```typescript
// workers/src/services/dia.ts
const DIA_ORACLE_V2_ABI = parseAbi([
  "function getValue(string key) external view returns (uint128 price, uint128 timestamp)",
]);

// Fetch from on-chain oracle
const [price, timestamp] = await client.readContract({
  address: DIA_ORACLE_ADDRESS,
  abi: DIA_ORACLE_V2_ABI,
  functionName: "getValue",
  args: ["BTC/USD"],
});
```

### Publishing to Somnia Data Streams

```typescript
// workers/src/services/price-publisher.ts

// 1. Encode data using schema
const encoder = new SchemaEncoder(PRICE_FEED_SCHEMA);
const encodedData = encoder.encodeData([
  { name: "timestamp", value: timestamp.toString(), type: "uint64" },
  { name: "symbol", value: "BTC", type: "string" },
  { name: "price", value: price.toString(), type: "uint256" },
  { name: "decimals", value: "8", type: "uint8" },
  { name: "source", value: "COINGECKO", type: "string" },
  { name: "sourceAddress", value: "0x0000...", type: "address" },
]);

// 2. Create unique data ID
const dataId = `0x${Buffer.from("price-btc").toString("hex").padEnd(64, "0")}`;

// 3. Publish data AND emit event in single transaction
const txHash = await sdk.streams.setAndEmitEvents(
  [{ id: dataId, schemaId, data: encodedData }],  // Data to store
  [{ id: "PriceUpdateV2", argumentTopics: [], data: encodedData }]  // Event to emit
);
```

---

## 3. Alert System Architecture

### Hybrid Approach: Off-chain Storage + On-chain Events

Alerts use a **hybrid architecture** for optimal performance:
- **Storage**: SQLite in Workers (fast CRUD, ~5ms)
- **Notifications**: On-chain events via Somnia Data Streams (WebSocket push)

This gives us instant alert creation while still leveraging blockchain for real-time notifications.

### Alert Lifecycle
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User        │────▶│  Create      │────▶│  Store in    │────▶│  Alert       │
│  Dashboard   │     │  Alert       │     │  SQLite      │     │  ACTIVE      │
└──────────────┘     └──────────────┘     │  (Workers)   │     │  (~5ms)      │
                                          └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Telegram    │◀────│  Emit Event  │◀────│  Trigger     │◀────│  Price       │
│  Notification│     │  On-chain    │     │  Alert       │     │  Check       │
└──────────────┘     │  (WebSocket) │     │  (SQLite)    │     │  (~5ms)      │
                     └──────────────┘     └──────────────┘     └──────────────┘
```

### Why Hybrid?

| Aspect | On-chain Only | Hybrid (Current) |
|--------|---------------|------------------|
| Create alert | 2-5 seconds | ~5ms |
| Check alerts | 500ms-2s | ~5ms |
| Trigger notification | On-chain event ✅ | On-chain event ✅ |
| WebSocket push | ✅ | ✅ |
| Scalability | Limited by gas | Unlimited |

### Creating Alerts (Off-chain via Workers API)

```typescript
// Frontend calls Workers API
const response = await fetch("/api/alerts/create", {
  method: "POST",
  body: JSON.stringify({
    walletAddress: "0x...",
    asset: "BTC",
    condition: "ABOVE",
    thresholdPrice: "10000000000000", // 8 decimals
  }),
});

// Workers stores in SQLite (instant)
const alert = createOffchainAlert({
  id: alertId,
  wallet_address: walletAddress,
  asset: asset.toUpperCase(),
  condition,
  threshold_price: thresholdPrice,
  status: "ACTIVE",
  created_at: Math.floor(Date.now() / 1000),
});
```

### Reading Alerts (from SQLite)

```typescript
// Get all alerts for a wallet (fast!)
const alerts = getAlertsByWallet(walletAddress);
const activeAlerts = alerts.filter(a => a.status === "ACTIVE");
```

### Triggering Alerts + Emitting On-chain Events

```typescript
// workers/src/services/alert-checker.ts

export async function checkAndTriggerAlerts(symbol: string, currentPrice: bigint) {
  // 1. Read active alerts from SQLite (fast! ~5ms)
  const alerts = await getActiveAlertsFromBlockchain();

  for (const alert of alerts) {
    // 2. Check condition
    const shouldTrigger =
      (alert.condition === "ABOVE" && currentPrice >= alert.thresholdPrice) ||
      (alert.condition === "BELOW" && currentPrice <= alert.thresholdPrice);

    if (shouldTrigger) {
      // 3. Update alert status in SQLite
      triggerAlert(alert.id);

      // 4. Emit event on-chain (for WebSocket subscribers) - NO data storage!
      await sdk.streams.emitEvents([
        { id: "AlertTriggeredV2", argumentTopics: [], data: encodedAlertEvent }
      ]);

      // 5. Send Telegram notification
      await sendAlertNotification({
        walletAddress: alert.wallet_address,
        asset: alert.asset,
        condition: alert.condition,
        thresholdPrice: alert.threshold_price,
        currentPrice,
      });
    }
  }
}
```

---

## 4. WebSocket Event Subscription

### How Frontend Subscribes to Events

```typescript
// web/src/lib/hooks/usePriceSubscription.ts

// 1. Create WebSocket client
const wsClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket("wss://dream-rpc.somnia.network/ws"),
});

// 2. Initialize SDK with WebSocket client
const sdk = new SDK({ public: wsClient });

// 3. Subscribe to price events
const subscription = await sdk.streams.subscribe({
  somniaStreamsEventId: "PriceUpdateV2",
  ethCalls: [],
  onlyPushChanges: false,
  onData: (data) => {
    // Decode and update UI
    const price = decodePrice(data);
    setPrices(prev => new Map(prev).set(price.symbol, price));
  },
  onError: (err) => {
    // Handle reconnection
  },
});

// 4. Subscribe to alert events
await sdk.streams.subscribe({
  somniaStreamsEventId: "AlertTriggeredV2",
  onData: (data) => {
    const alert = decodeAlert(data);
    setAlerts(prev => [alert, ...prev]);
  },
});
```

### Event Flow
```
Publisher (Workers)                    Somnia Blockchain                    Frontend
       │                                      │                                │
       │  setAndEmitEvents()                  │                                │
       │─────────────────────────────────────▶│                                │
       │                                      │                                │
       │                                      │  WebSocket broadcast           │
       │                                      │───────────────────────────────▶│
       │                                      │                                │
       │                                      │                    onData()    │
       │                                      │                    callback    │
       │                                      │                                │
```

---

## 5. DataGrid & AlertGrid Architecture

### Component Overview
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ALERTGRID (frontend/ - Next.js)                          │
│  Port: 3000                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend (React)           │  API Routes                                   │
│  ├─ PriceDashboard         │  ├─ /api/prices          (read prices)        │
│  ├─ AlertManager           │  ├─ /api/alerts/create   (create alert)       │
│  ├─ TelegramLinkButton     │  ├─ /api/telegram/link   (get deep link)      │
│  └─ usePriceSubscription   │  ├─ /api/telegram/webhook (bot webhook)       │
│      (WebSocket hook)      │  └─ /api/telegram/poll   (dev polling)        │
│                            │                                                │
│  In-Memory Storage         │  Blockchain Interaction                        │
│  └─ Telegram links cache   │  └─ @somnia-chain/streams SDK                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTP API (sync Telegram links)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DATAGRID (workers/ - Node.js)                           │
│  Port: 3001                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Services                   │  HTTP API                                     │
│  ├─ Price Publisher        │  ├─ /health                                   │
│  │   ├─ CoinGecko client   │  ├─ /api/telegram/sync                        │
│  │   └─ DIA Oracle client  │  ├─ /api/telegram/get                         │
│  ├─ Alert Checker          │  ├─ /api/telegram/get-by-chat                 │
│  └─ Telegram Notifier      │  └─ /api/telegram/delete                      │
│                            │                                                │
│  SQLite Database           │  Blockchain Interaction                        │
│  ├─ telegram_links         │  └─ @somnia-chain/streams SDK                 │
│  ├─ price_history          │                                                │
│  └─ notification_log       │                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Between AlertGrid & DataGrid

```
┌─────────────────┐                              ┌─────────────────┐
│   ALERTGRID     │                              │    DATAGRID     │
│   (frontend/)   │                              │   (workers/)    │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │  1. User links Telegram                        │
         │  ─────────────────────────────────────────────▶│
         │     POST /api/telegram/sync                    │
         │     { walletAddress, chatId, verified }        │
         │                                                │
         │                                                │  2. Store in SQLite
         │                                                │     (persistent)
         │                                                │
         │  3. User checks link status                    │
         │  ─────────────────────────────────────────────▶│
         │     GET /api/telegram/get?wallet=0x...         │
         │                                                │
         │  4. Return link data                           │
         │  ◀─────────────────────────────────────────────│
         │     { link: { verified: true, ... } }          │
         │                                                │
         │                                                │  5. Price Publisher
         │                                                │     fetches prices
         │                                                │
         │                                                │  6. Publishes to
         │                                                │     Somnia Data Streams
         │                                                │
         │  7. WebSocket receives                         │
         │     PriceUpdateV2 event                        │
         │  ◀═══════════════════════════════════════════════════════════════
         │     (from blockchain)                          │
         │                                                │
         │                                                │  8. Alert Checker
         │                                                │     triggers alert
         │                                                │
         │                                                │  9. Sends Telegram
         │                                                │     notification
         │                                                │
```

---

## 6. Deployment Scenarios

### Scenario 1: Local Development
```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Machine (localhost)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐         ┌─────────────────┐               │
│   │  AlertGrid      │◀───────▶│  DataGrid       │               │
│   │  localhost:3000 │  HTTP   │  localhost:3001 │               │
│   └────────┬────────┘         └────────┬────────┘               │
│            │                           │                         │
│            │ WebSocket                 │ HTTP                    │
│            ▼                           ▼                         │
│   ┌─────────────────────────────────────────────────────────────┤
│   │              Somnia Testnet (dream-rpc.somnia.network)      │
│   └─────────────────────────────────────────────────────────────┘
│                                                                  │
│   Note: Telegram webhooks won't work (can't reach localhost)    │
│   Solution: Use /api/telegram/poll endpoint (auto-polling)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Commands:
  npm run dev  (from root - runs both)
  # Or separately:
  cd frontend && npm run dev
  cd workers && npm run dev
```

### Scenario 2: Vercel (AlertGrid) + Railway/DigitalOcean (DataGrid)
```
┌─────────────────────────────────────────────────────────────────┐
│                          VERCEL                                  │
│                    (Serverless Functions)                        │
├─────────────────────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 AlertGrid (Next.js)                      │   │
│   │                 https://your-app.vercel.app              │   │
│   │                                                          │   │
│   │  • Frontend React app                                    │   │
│   │  • API routes (serverless)                               │   │
│   │  • In-memory storage (resets on cold start)              │   │
│   │  • Telegram webhook endpoint                             │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (WORKERS_API_URL)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RAILWAY / DIGITALOCEAN                         │
│                      (Persistent Server)                         │
├─────────────────────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 DataGrid (Node.js)                       │   │
│   │              https://workers.your-domain.com             │   │
│   │                                                          │   │
│   │  • Price Publisher (continuous loop)                     │   │
│   │  • Alert Checker                                         │   │
│   │  • Telegram Notifier                                     │   │
│   │  • SQLite database (persistent)                          │   │
│   │  • HTTP API for frontend sync                            │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

Environment Variables:

# Vercel (frontend/.env)
WORKERS_API_URL=https://workers.your-domain.com
WORKERS_API_SECRET=shared_secret_123
TELEGRAM_BOT_TOKEN=xxx

# Railway/DO (workers/.env)
WORKERS_API_SECRET=shared_secret_123
TELEGRAM_BOT_TOKEN=xxx
COINGECKO_API_KEY_1=xxx
```

### Scenario 3: Single VPS (Self-Hosted)
```
┌─────────────────────────────────────────────────────────────────┐
│                    VPS (DigitalOcean/AWS/etc)                    │
│                      your-server.com                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                      NGINX                               │   │
│   │                   (Reverse Proxy)                        │   │
│   │                                                          │   │
│   │   /              → localhost:3000 (AlertGrid)            │   │
│   │   /api/workers/* → localhost:3001 (DataGrid API)         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                   │
│   ┌─────────────────┐             ┌─────────────────┐           │
│   │   AlertGrid     │◀───────────▶│    DataGrid     │           │
│   │  PM2 Process    │   HTTP      │   PM2 Process   │           │
│   │  Port 3000      │             │   Port 3001     │           │
│   └─────────────────┘             └─────────────────┘           │
│                                           │                      │
│                                   ┌───────┴───────┐             │
│                                   │    SQLite     │             │
│                                   │  ./data/      │             │
│                                   │  alerts.db    │             │
│                                   └───────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

# PM2 ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'alertgrid',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      env: { PORT: 3000 }
    },
    {
      name: 'datagrid',
      cwd: './workers',
      script: 'npm',
      args: 'start',
      env: { WORKERS_API_PORT: 3001 }
    }
  ]
};
```

### Key Differences by Deployment

| Feature | Local Dev | Vercel + Railway | Single VPS |
|---------|-----------|------------------|------------|
| Web hosting | localhost:3000 | Vercel (serverless) | PM2 + Nginx |
| Workers hosting | localhost:3001 | Railway/DO | PM2 + Nginx |
| Telegram links | In-memory + Workers | Workers SQLite | Workers SQLite |
| Telegram webhook | Polling mode | Real webhook | Real webhook |
| Price publishing | Manual/continuous | Continuous | Continuous |
| Database | Workers SQLite | Workers SQLite | Workers SQLite |
| Cost | Free | ~$5-10/mo | ~$5-20/mo |

---

## Summary

### What Somnia Data Streams Provides
1. **On-chain data storage** with typed schemas
2. **Event emission** for real-time subscriptions
3. **Data retrieval** by schema and publisher
4. **Decentralized** - data lives on blockchain

### How We Use It
1. **Price Feeds**: Publish prices from CoinGecko/DIA → Store on-chain → Emit events → Frontend subscribes
2. **Alerts**: Create alerts on-chain → Workers check prices → Trigger alerts → Emit events → Send notifications

### Why This Architecture
- **Reliability**: Prices stored on-chain, not just in memory
- **Real-time**: WebSocket subscriptions for instant updates
- **Decentralized**: Other dApps can read our price feeds
- **Scalable**: Workers handle heavy lifting, frontend stays light
