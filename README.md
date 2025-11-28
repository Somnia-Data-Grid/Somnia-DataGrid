# 🧩 Somnia DataGrid

**Shared market data streams for the Somnia ecosystem.**

Somnia DataGrid is a shared data layer for the Somnia ecosystem built on top of **Somnia Data Streams**. We run off-chain workers that aggregate price feeds (CoinGecko, DIA on Somnia) and publish them on-chain as typed, documented data streams. Other Somnia dapps can subscribe to these streams via WebSocket using the standard `@somnia-chain/streams` SDK and instantly get real-time prices without touching external APIs.

> **Coming Soon:** Fear/greed indices and token sentiment streams.

---

## What's in This Repo

| Component | Description |
|-----------|-------------|
| **Somnia DataGrid** (`workers/`) | Off-chain workers that publish on-chain market data streams |
| **Somnia AlertGrid** (`frontend/`) | Reference dapp that subscribes to DataGrid streams for DeFi alerts and dashboards |

```
┌─────────────────────────────────────────────────────────────────┐
│                      Somnia DataGrid                             │
│              (workers/ - Market Data Publisher)                  │
├─────────────────────────────────────────────────────────────────┤
│  📈 Price Feeds                                                 │
│  • CoinGecko + DIA Oracle → PriceUpdateV2 events                │
│                                                                  │
│  📊 Sentiment Streams                                           │
│  • Fear & Greed Index → FearGreedUpdateV1 events                │
│  • Token Crowd Sentiment → TokenSentimentUpdateV1 events        │
│  • News Events → NewsEventV1 events (CryptoPanic)               │
│  • News Aggregates → NewsAggregateV1 events                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Somnia Data Streams
                              │ (on-chain, any dapp can read)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Somnia AlertGrid                            │
│              (frontend/ - Reference DeFi Dapp)                   │
├─────────────────────────────────────────────────────────────────┤
│  • Real-time price dashboard                                    │
│  • On-chain alert creation                                      │
│  • Telegram notifications when alerts trigger                   │
│  • Shows how to consume DataGrid streams                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why DataGrid is Useful for the Ecosystem

| Benefit | Description |
|---------|-------------|
| **Shared infra** | Dapps don't need to integrate CoinGecko, DIA, or sentiment APIs themselves |
| **Standardized schemas** | Price feeds published with stable, versioned schemas on Somnia Data Streams |
| **Real-time by default** | Push updates via WebSocket instead of polling |
| **On-chain provenance** | Values stored on Somnia, verifiable and composable |
| **Faster prototyping** | Build DeFi protocols in hours by wiring into DataGrid streams |

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
- **DataGrid Workers:** Background process (port 3001 API)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Somnia Testnet + `@somnia-chain/streams` SDK |
| **Frontend** | Next.js 16 + React 19 + TypeScript + Tailwind v4 |
| **Workers** | Node.js + better-sqlite3 + TypeScript |
| **Price Sources** | CoinGecko Demo API (multi-key) + DIA Oracle |
| **Notifications** | Telegram Bot API |

---

## Data Streams

### Price Feeds
| Source | Assets |
|--------|--------|
| **CoinGecko** | BTC, ETH, USDC, USDT, ARB, SOL, WETH, LINK, UNI, AAVE, MATIC, AVAX, and more |
| **DIA Oracle** | SOMI (Somnia token), BTC, ETH, USDC, USDT, ARB, SOL |

### Sentiment Streams
| Stream | Source | Update Frequency |
|--------|--------|------------------|
| **Fear & Greed Index** | Alternative.me | Daily |
| **Token Crowd Sentiment** | CoinGecko votes | Every 2 hours |
| **News Events** | CryptoPanic | Real-time (60s poll) |
| **News Aggregates** | CryptoPanic | Every 10 minutes |

---

## How Other Dapps Can Use DataGrid

Any Somnia dapp can subscribe to DataGrid streams using the standard SDK:

```typescript
import { SDK } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";

// Connect to Somnia
const client = createPublicClient({
  transport: webSocket("wss://dream-rpc.somnia.network/ws"),
});
const sdk = new SDK({ public: client });

// Subscribe to price updates
await sdk.streams.subscribe({
  somniaStreamsEventId: "PriceUpdateV2",
  onData: (data) => {
    // Decode and use the price data
    console.log("New price:", data);
  },
});
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed schemas and examples.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Deep dive into Somnia Data Streams, schemas, and system design |
| [QUICK_START.md](./QUICK_START.md) | Fast setup guide and FAQ |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment (Vercel + Railway) |
| [VPS_SETUP.md](./VPS_SETUP.md) | Self-hosted VPS setup |
| [frontend/README.md](./frontend/README.md) | AlertGrid dapp documentation |

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
│   │   ├── services/     # Price publisher, alert checker
│   │   ├── db/           # SQLite for persistence
│   │   └── api.ts        # HTTP API for frontend sync
│   └── package.json
│
├── scripts/               # Development helpers
├── ARCHITECTURE.md        # Technical deep dive
├── QUICK_START.md         # Setup guide
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
- [x] News Events stream (CryptoPanic)
- [x] News Aggregates stream
- [ ] LLM-enriched narrative sentiment (optional)
- [ ] More price sources

---

## License

MIT
