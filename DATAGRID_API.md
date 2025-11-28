# Somnia DataGrid API

Real-time on-chain data streams for crypto prices, sentiment, and news.

## Overview

Somnia DataGrid publishes data to Somnia Data Streams, allowing any dapp to subscribe to real-time updates via WebSocket. All data is stored on-chain and can be queried or subscribed to.

## Available Streams

### 1. Price Feeds (`PriceUpdateV2`)

Real-time price updates with 8 decimal precision.

**Schema:**
```
uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress
```

**Default Tokens:** BTC, ETH, USDC, USDT, SOL, ARB, LINK, UNI, AAVE, AVAX, MATIC, STT

**Update Interval:** 30 seconds

**Sources:** CoinGecko, DIA Oracle

### 2. Token Sentiment (`TokenSentimentV1`)

Crowd sentiment data showing bullish/bearish percentages.

**Schema:**
```
uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source
```

**Default Tokens:** BTC, ETH, SOL

**Update Interval:** 2 hours

**Source:** CoinGecko

### 3. Fear & Greed Index (`FearGreedV1`)

Market fear & greed index (0-100 scale).

**Schema:**
```
uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate
```

**Zones:** Extreme Fear (0-24), Fear (25-44), Neutral (45-55), Greed (56-75), Extreme Greed (76-100)

**Update Interval:** 1 hour

**Source:** Alternative.me

### 4. News Feeds (Coming Soon)

Real-time crypto news with sentiment analysis.

**Status:** In development - evaluating data sources for reliable, high-quality news feeds.

**Planned Features:**
- Individual news events with sentiment scoring
- Aggregated news sentiment over time windows
- Multi-source news aggregation
- Breaking news alerts

**Note:** The CryptoPanic widget is available in the UI for now, but on-chain news data streams are coming soon with a better data provider.

## Integration Guide

### Using the Somnia Streams SDK

```typescript
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";

// Connect to Somnia
const client = createPublicClient({
  chain: {
    id: 50312,
    name: "Somnia Devnet",
    nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
    rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
  },
  transport: webSocket("wss://dream-rpc.somnia.network/ws"),
});

const sdk = new SDK({ public: client });

// Subscribe to price updates
const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
const encoder = new SchemaEncoder(PRICE_SCHEMA);

await sdk.streams.subscribe({
  somniaStreamsEventId: "PriceUpdateV2",
  onData: (data) => {
    const decoded = encoder.decodeData(data);
    const symbol = decoded[1].value;
    const price = Number(decoded[2].value) / 1e8;
    console.log(`${symbol}: $${price.toFixed(2)}`);
  },
});
```

### REST API Endpoints

Base URL: `https://your-workers-api.com` (or `http://localhost:3001` for local dev)

#### Get All Active Streams
```
GET /api/streams
GET /api/streams?type=PRICE
GET /api/streams?type=SENTIMENT
```

Response:
```json
{
  "success": true,
  "streams": [
    {
      "id": "price-btc",
      "type": "PRICE",
      "symbol": "BTC",
      "name": "Bitcoin",
      "eventId": "PriceUpdateV2",
      "schema": "uint64 timestamp, string symbol, ...",
      "updateInterval": 30,
      "sources": ["CoinGecko"],
      "isActive": true
    }
  ],
  "count": 12
}
```

#### Get Stream Documentation
```
GET /api/streams/docs
```

Returns full API documentation including schemas, examples, and integration guide.

#### Request New Token
```
POST /api/streams/request
Content-Type: application/json

{
  "symbol": "DOGE",
  "name": "Dogecoin",
  "coingeckoId": "dogecoin",
  "type": "PRICE"
}
```

Response:
```json
{
  "success": true,
  "message": "Token DOGE added to PRICE streams"
}
```

#### Check Token Support
```
GET /api/streams/check?symbol=BTC&type=PRICE
```

Response:
```json
{
  "success": true,
  "symbol": "BTC",
  "type": "PRICE",
  "supported": true
}
```

#### Get Active Symbols
```
GET /api/streams/symbols?type=PRICE
```

Response:
```json
{
  "success": true,
  "type": "PRICE",
  "symbols": ["BTC", "ETH", "USDC", "..."],
  "count": 12
}
```

### Cached Data Endpoints

For initial page load or fallback when WebSocket is unavailable:

```
GET /api/sentiment                    # All sentiment data
GET /api/sentiment/fear-greed         # Fear & Greed only
GET /api/sentiment/tokens             # Token sentiments only
GET /api/sentiment/news?limit=20      # Recent news
```

## Adding Custom Tokens

### Via API

```bash
curl -X POST https://your-api.com/api/streams/request \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PEPE",
    "name": "Pepe",
    "coingeckoId": "pepe",
    "type": "PRICE"
  }'
```

### Via Environment Variables

Add to `workers/.env`:
```
SYMBOLS=BTC,ETH,USDC,USDT,SOL,PEPE,DOGE
SENTIMENT_SYMBOLS=BTC,ETH,SOL,PEPE
```

### Supported Data Sources

| Source | Tokens | Notes |
|--------|--------|-------|
| CoinGecko | 10,000+ | Requires `coingeckoId` |
| DIA Oracle | STT, SOMI | On-chain oracle |

To find a token's CoinGecko ID:
```
GET /api/tokens/search?q=pepe
```

## Health Endpoints

### Basic Health Check
```
GET /health
```
Returns: `{ "status": "ok", "timestamp": 1234567890 }`

### Detailed Health Status
```
GET /api/health
```
Returns comprehensive status including:
- Database connection status
- Active alerts count
- Data freshness (prices, sentiment, news)
- Service availability (Telegram, CoinGecko, CryptoPanic)
- Uptime

Example response:
```json
{
  "status": "ok",
  "timestamp": 1732780800000,
  "uptime": 3600,
  "version": "1.0.0",
  "database": {
    "connected": true,
    "activeAlerts": 5,
    "activeSentimentAlerts": 2,
    "verifiedTelegramLinks": 10,
    "activeStreams": 12
  },
  "dataFreshness": {
    "prices": {
      "lastUpdate": 1732780750,
      "ageSeconds": 50,
      "stale": false
    },
    "fearGreed": {
      "lastUpdate": 1732777200,
      "ageSeconds": 3600,
      "score": 65
    }
  },
  "services": {
    "telegram": true,
    "coingecko": true,
    "cryptopanic": true
  }
}
```

## Rate Limits

- WebSocket: Unlimited subscriptions
- REST API: 100 requests/minute
- Token requests: 10/hour (to prevent spam)

## Self-Hosting

To run your own DataGrid instance:

1. Clone the repository
2. Configure `workers/.env` with API keys
3. Run `npm run dev` in the workers directory
4. Point your dapp to your workers API

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.

## Support

- GitHub Issues: [Report bugs or request features]
- Discord: [Join our community]
