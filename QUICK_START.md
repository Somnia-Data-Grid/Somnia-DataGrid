# Quick Start Guide

## TL;DR

```bash
# Install everything
npm run install:all

# Push database schema (Drizzle ORM)
cd workers && npm run db:push && cd ..

# Start development
npm run dev
```

Visit http://localhost:3000

## What's Running?

| Service | Component | Where |
|---------|-----------|-------|
| AlertGrid | Frontend + API | http://localhost:3000 |
| DataGrid | Price publisher + Alerts | Background (port 3001) |
| SQLite | Database | `workers/data/alerts.db` |

## Key Concepts

**Somnia DataGrid** = Infrastructure layer (workers that publish price feeds to Somnia Data Streams)
**Somnia AlertGrid** = Reference dapp (frontend that consumes DataGrid streams)

```
DataGrid powers AlertGrid.
```

## Key Questions Answered

### Q: How do Vercel and Railway communicate?
**A: They don't directly!** Both read/write to Somnia Data Streams independently.

```
Vercel (AlertGrid) ──┐
                     ├──→ Somnia Data Streams ←── Both read/write here
Railway (DataGrid) ──┘
```

### Q: Where does Telegram webhook go?
**A: Always to AlertGrid** (Vercel or VPS, never to DataGrid workers)

```
Telegram → https://your-app.vercel.app/api/telegram/webhook
```

### Q: What about VPS deployment?
**A: Both services share one SQLite database**

```
VPS Server
├─ AlertGrid (Port 3000)
├─ DataGrid (Background)
└─ SQLite (/var/lib/somnia/alerts.db) ← Shared
```

## Environment Setup

### Frontend (frontend/.env)
```bash
# Required
RPC_URL=https://dream-rpc.somnia.network
WEBSOCKET_URL=wss://dream-rpc.somnia.network/ws
NEXT_PUBLIC_WEBSOCKET_URL=wss://dream-rpc.somnia.network/ws
PRIVATE_KEY=0x...
PUBLISHER_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Optional (for Telegram)
TELEGRAM_BOT_TOKEN=...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=...

# Workers API (must match workers/.env)
WORKERS_API_URL=http://localhost:3001
WORKERS_API_SECRET=shared_secret
```

### Workers (workers/.env)
```bash
# Required
RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=0x...
PUBLISHER_ADDRESS=0x...

# Optional
TELEGRAM_BOT_TOKEN=...
DATABASE_PATH=./data/alerts.db
PUBLISH_INTERVAL_MS=30000
SYMBOLS=BTC,ETH,USDC,USDT,ARB,SOL

# API (must match frontend/.env)
WORKERS_API_PORT=3001
WORKERS_API_SECRET=shared_secret

# Price sources
COINGECKO_API_KEY_1=CG-xxx
ENABLE_DIA=true
```

## Deployment Cheat Sheet

### Vercel (AlertGrid Frontend)
```bash
cd frontend
npx vercel --prod
```

Set env vars in Vercel dashboard.

### Railway (DataGrid Workers)
1. Connect GitHub repo
2. Select `workers/` directory
3. Set environment variables
4. Deploy

### VPS (Everything)
```bash
# See VPS_SETUP.md for full guide
ssh root@server
git clone <repo>
npm run install:all
cd workers && npm run db:migrate
pm2 start ecosystem.config.js
```

### Telegram Webhook
```bash
# Vercel
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook"

# VPS
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook"
```

## Troubleshooting

### "No prices showing"
```bash
# Check if DataGrid workers are running
cd workers && npm run publisher:once
```

### "Telegram not working"
```bash
# Check webhook status
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Should show your URL and "pending_update_count": 0
```

### "Database locked"
```bash
# Only happens on VPS with shared DB
# Restart both services
pm2 restart all
```

## File Structure

```
somnia-datagrid/
├── frontend/               # Somnia AlertGrid (reference dapp)
│   ├── src/
│   │   ├── app/           # Pages and API routes
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities
│   │   │   ├── db/        # In-memory store
│   │   │   ├── hooks/     # React hooks (usePriceSubscription, etc.)
│   │   │   ├── services/  # Alert service, price publisher
│   │   │   └── telegram/  # Telegram helpers
│   │   └── ...
│   └── package.json
│
├── workers/                # Somnia DataGrid (data infrastructure)
│   ├── src/
│   │   ├── db/            # Drizzle ORM
│   │   │   ├── schema.ts  # TypeScript schema definitions
│   │   │   └── client.ts  # Database client
│   │   └── services/
│   │       ├── price-publisher.ts
│   │       ├── sentiment-publisher.ts
│   │       ├── alert-checker.ts
│   │       ├── coingecko.ts
│   │       ├── dia.ts
│   │       └── telegram.ts
│   ├── drizzle/           # Database migrations
│   ├── data/              # SQLite database (gitignored)
│   └── package.json
│
├── scripts/               # Development helpers
│   ├── dev.sh            # Unix startup
│   └── dev.ps1           # Windows startup
│
├── package.json           # Root package (convenience scripts)
├── README.md              # Main readme
├── ARCHITECTURE.md        # Technical deep dive
├── QUICK_START.md         # This file
├── DEPLOYMENT.md          # Vercel + Railway guide
└── VPS_SETUP.md           # Single server guide
```

## Next Steps

1. **Local Development:** Follow this guide
2. **Hackathon Demo:** Read `DEPLOYMENT.md` (Vercel + Railway)
3. **Production:** Read `VPS_SETUP.md` (Single server)
4. **Architecture:** Read `ARCHITECTURE.md` (Deep dive)
