# 🖥 Somnia AlertGrid

**DeFi alerts powered by Somnia DataGrid.**

Somnia AlertGrid is a DeFi alerts and analytics dashboard built on top of Somnia DataGrid. It subscribes to DataGrid's price streams on Somnia, lets users create on-chain alert configurations, and sends real-time notifications when conditions are met.

---

## Features

- **Real-time Price Dashboard**: Live prices from DataGrid streams via WebSocket
- **On-Chain Alerts**: Create alerts stored on Somnia blockchain
- **Telegram Notifications**: Get notified instantly when alerts trigger
- **Wallet Integration**: Connect with MetaMask, WalletConnect, etc.

---

## Quick Start

```bash
# From root directory
npm run dev:frontend

# Or directly
cd frontend && npm run dev
```

Visit http://localhost:3000

---

## Environment Variables

```bash
# Copy example
cp .env.example .env
```

### Required
```env
RPC_URL=https://dream-rpc.somnia.network
WEBSOCKET_URL=wss://dream-rpc.somnia.network/ws
NEXT_PUBLIC_WEBSOCKET_URL=wss://dream-rpc.somnia.network/ws
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
PUBLISHER_ADDRESS=0xYOUR_WALLET_ADDRESS
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Telegram (Optional)
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=random_secret
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourBotUsername
```

### Workers API (for persistent Telegram links)
```env
WORKERS_API_URL=http://localhost:3001
WORKERS_API_SECRET=shared_secret
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prices` | GET | Get latest prices from DataGrid |
| `/api/alerts/create` | POST | Create a new on-chain alert |
| `/api/alerts/check` | POST | Check alerts for a price |
| `/api/telegram/link` | GET | Get Telegram deep link |
| `/api/telegram/webhook` | POST | Telegram bot webhook |
| `/api/telegram/poll` | GET | Poll Telegram (dev mode) |

---

## Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Add token to `.env` as `TELEGRAM_BOT_TOKEN`
3. Set webhook (production):
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/telegram/webhook
   ```

### Local Development
Telegram webhooks can't reach localhost. The system automatically uses polling:
- Frontend polls `/api/telegram/poll` when waiting for link confirmation
- No webhook setup needed for local testing

### Bot Commands
- `/start` - Start the bot / link wallet
- `/alerts` - View your active alerts
- `/test` - Send a test notification
- `/unlink` - Unlink your wallet
- `/help` - Show help

---

## How It Works

AlertGrid is a **consumer** of DataGrid streams:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Somnia DataGrid                             │
│              (publishes prices to Data Streams)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket subscription
                              │ (PriceUpdateV2 events)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Somnia AlertGrid                            │
│                                                                  │
│  1. Subscribe to DataGrid price streams                         │
│  2. Display real-time prices in dashboard                       │
│  3. Let users create on-chain alerts                            │
│  4. Check alerts when prices update                             │
│  5. Send Telegram notifications when triggered                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TypeScript + Tailwind v4
- **Blockchain**: Viem + `@somnia-chain/streams` SDK
- **Wallet**: wagmi + WalletConnect

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Deployment

### Vercel (Recommended)
```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard.

### Self-Hosted
See [VPS_SETUP.md](../VPS_SETUP.md) for PM2 + Nginx setup.

---

## Related

- **[Somnia DataGrid](../workers/)** - The data infrastructure that powers AlertGrid
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Technical deep dive
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Production deployment guide
