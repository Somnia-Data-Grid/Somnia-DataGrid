# 🧩 Somnia DataGrid

**Shared market data streams for the Somnia ecosystem, powered by Somnia Data Streams.**

Somnia DataGrid is a shared data layer for the Somnia ecosystem built on top of **Somnia Data Streams**. We run off-chain workers that aggregate price feeds (CoinGecko, DIA on Somnia), sentiment data, and news - then publish them on-chain as typed, documented data streams. Other Somnia dapps can subscribe to these streams via WebSocket using the standard `@somnia-chain/streams` SDK and instantly get real-time data without touching external APIs.

---

## 🌊 Somnia Data Streams Integration

This project demonstrates the power of **Somnia Data Streams** - a real-time, on-chain event streaming system that enables:

### How We Use Somnia Data Streams

| Stream Type | Event ID | Description |
|-------------|----------|-------------|
| **Price Feeds** | `PriceUpdateV2` | Real-time crypto prices (BTC, ETH, SOL, etc.) |
| **Alert Triggers** | `AlertTriggeredV2` | Price alert notifications broadcast on-chain |
| **Fear & Greed** | `FearGreedV1` | Market sentiment index (0-100) |
| **Token Sentiment** | `TokenSentimentV1` | Crowd bullish/bearish percentages |
| **News Events** | `NewsEventV1` | Crypto news with sentiment analysis |

### Why Somnia Data Streams?

```
Traditional Approach:
  App → Poll CoinGecko API → Process → Store → Poll again...
  (High latency, rate limits, each app duplicates work)

With Somnia Data Streams:
  DataGrid Workers → Publish to Somnia Data Streams → Any dapp subscribes instantly
  (Real-time push, shared infrastructure, on-chain verifiable)
```

**Benefits:**
- ⚡ **Real-time push** - No polling, instant updates via WebSocket
- 🔗 **On-chain provenance** - Data stored on Somnia, verifiable and composable
- 🤝 **Shared infrastructure** - Dapps don't need their own API integrations
- 📊 **Typed schemas** - Consistent, versioned data formats
- 🚀 **Fast prototyping** - Build DeFi apps in hours by wiring into existing streams

### Subscribe to DataGrid Streams

Any Somnia dapp can consume our streams:

```typescript
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";

const client = createPublicClient({
  transport: webSocket("wss://dream-rpc.somnia.network/ws"),
});
const sdk = new SDK({ public: client });

// Subscribe to real-time price updates
await sdk.streams.subscribe({
  somniaStreamsEventId: "PriceUpdateV2",
  onData: (data) => {
    const encoder = new SchemaEncoder(
      "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress"
    );
    const decoded = encoder.decodeData(data);
    console.log(`${decoded[1].value}: $${Number(decoded[2].value) / 1e8}`);
  },
});
```

---

## What's in This Repo

| Component | Description |
|-----------|-------------|
| **Somnia DataGrid** (`workers/`) | Off-chain workers that publish on-chain market data streams |
| **Somnia AlertGrid** (`frontend/`) | Reference dapp with price alerts, sentiment dashboard, Telegram notifications |


```
┌─────────────────────────────────────────────────────────────────┐
│                      Somnia DataGrid                             │
│              (workers/ - Market Data Publisher)                  │
├─────────────────────────────────────────────────────────────────┤
│  📈 Price Feeds (PriceUpdateV2)                                 │
│  • CoinGecko + DIA Oracle → Real-time prices on-chain           │
│                                                                  │
│  📊 Sentiment Streams                                           │
│  • Fear & Greed Index (FearGreedV1)                             │
│  • Token Crowd Sentiment (TokenSentimentV1)                     │
│  • News Events (NewsEventV1)                                    │
│                                                                  │
│  🔔 Alert System                                                │
│  • Price alerts stored in SQLite (Drizzle ORM)                  │
│  • Triggers broadcast via AlertTriggeredV2 events               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Somnia Data Streams
                              │ (WebSocket subscription)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Somnia AlertGrid                            │
│              (frontend/ - Reference DeFi Dapp)                   │
├─────────────────────────────────────────────────────────────────┤
│  • Real-time price dashboard (subscribes to PriceUpdateV2)      │
│  • Price alerts with toast notifications                        │
│  • Sentiment dashboard (Fear/Greed, token sentiment)            │
│  • Telegram bot integration for mobile alerts                   │
│  • Token tracking for custom sentiment monitoring               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Clone and install
git clone <repo>
cd somnia-datagrid
npm run install:all

# Configure environment
cp frontend/.env.example frontend/.env
cp workers/.env.example workers/.env
# Edit both .env files with your keys

# Start development (runs both services)
npm run dev
```

**Services:**
- **AlertGrid Frontend:** http://localhost:3000
- **DataGrid Workers API:** http://localhost:3001

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Somnia Testnet + `@somnia-chain/streams` SDK |
| **Frontend** | Next.js 16 + React 19 + TypeScript + Tailwind v4 |
| **Workers** | Node.js + Drizzle ORM + better-sqlite3 |
| **Price Sources** | CoinGecko API (multi-key rotation) + DIA Oracle |
| **Notifications** | Telegram Bot API |

---

## Data Streams Reference

### Price Feeds (`PriceUpdateV2`)

**Schema:** `uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress`

| Source | Assets |
|--------|--------|
| **CoinGecko** | BTC, ETH, USDC, USDT, ARB, SOL, LINK, UNI, AAVE, MATIC, AVAX |
| **DIA Oracle** | STT (Somnia native), fallback for others |

### Sentiment Streams

| Stream | Event ID | Schema | Update Frequency |
|--------|----------|--------|------------------|
| **Fear & Greed** | `FearGreedV1` | `uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate` | Daily |
| **Token Sentiment** | `TokenSentimentV1` | `uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source` | 2 hours |
| **News Events** | `NewsEventV1` | `bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp` | Real-time |

### Alert Events (`AlertTriggeredV2`)

**Schema:** `bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt`

When a price alert triggers, the event is broadcast on-chain so any subscribed client receives instant notification.

---

## Features

### Price Alerts
- Create alerts for any tracked asset (BTC, ETH, etc.)
- Conditions: Price goes ABOVE or BELOW threshold
- Instant toast notifications in browser
- Telegram notifications for mobile

### Sentiment Dashboard
- Fear & Greed Index gauge
- Token sentiment cards (bullish/bearish %)
- Track custom tokens for sentiment monitoring
- Live news feed with sentiment analysis

### Telegram Integration
- Link wallet to Telegram via deep link
- Receive price alert notifications
- Receive sentiment alert notifications
- Commands: `/alerts`, `/test`, `/unlink`, `/help`

---

## Database (Drizzle ORM)

Workers use SQLite with Drizzle ORM for type-safe database operations:

```bash
cd workers

# Generate migration after schema changes
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Visual database browser
npm run db:studio
```

**Tables:** `offchain_alerts`, `telegram_links`, `tracked_tokens`, `sentiment_alerts`, `price_history`, `fear_greed_cache`, `token_sentiment_cache`, `news_cache`

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Deep dive into Somnia Data Streams, schemas, system design |
| [QUICK_START.md](./QUICK_START.md) | Fast setup guide and FAQ |
| [DATAGRID_API.md](./DATAGRID_API.md) | Workers API reference |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment (Vercel + Railway) |
| [VPS_SETUP.md](./VPS_SETUP.md) | Self-hosted VPS setup |

---

## Project Structure

```
somnia-datagrid/
├── frontend/              # Somnia AlertGrid (reference dapp)
│   ├── src/
│   │   ├── app/          # Next.js pages and API routes
│   │   ├── components/   # React components
│   │   └── lib/          # Services, hooks, utilities
│   └── package.json
│
├── workers/               # Somnia DataGrid (data infrastructure)
│   ├── src/
│   │   ├── services/     # Price publisher, sentiment publisher, alert checker
│   │   ├── db/           # Drizzle ORM schema and client
│   │   └── api.ts        # HTTP API for frontend sync
│   ├── drizzle/          # Database migrations
│   └── package.json
│
├── scripts/               # Development helpers
└── README.md              # This file
```

---

## Roadmap

- [x] Price feeds (CoinGecko + DIA)
- [x] On-chain price publishing to Somnia Data Streams
- [x] Real-time WebSocket subscriptions
- [x] AlertGrid reference dapp
- [x] Telegram notifications
- [x] Fear & Greed Index stream
- [x] Token Crowd Sentiment stream
- [x] News Events stream
- [x] Drizzle ORM migration
- [x] Toast notifications for triggered alerts
- [ ] More price sources
- [ ] Historical price charts

---

## License

MIT
