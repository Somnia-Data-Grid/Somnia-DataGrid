# Deployment Guide

Deploy **Somnia DataGrid** (workers) and **Somnia AlertGrid** (frontend) to production.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Vercel (AlertGrid)                          │
│  - Next.js Frontend (Dashboard, WalletConnect)              │
│  - API Routes (/api/prices, /api/alerts/*, /api/telegram/*) │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Reads from Somnia Data Streams
                              │
┌─────────────────────────────────────────────────────────────┐
│              Railway/Render (DataGrid)                       │
│  - Price Publisher (continuous loop)                        │
│  - Alert Checker (runs with publisher)                      │
│  - Telegram Notifier                                        │
│  - SQLite Database                                          │
└─────────────────────────────────────────────────────────────┘
```

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

1. **Clone and install dependencies:**
```bash
# From root
npm run install:all
```

2. **Configure environment:**
```bash
cp frontend/.env.example frontend/.env
cp workers/.env.example workers/.env
# Edit both .env files with your values
```

3. **Initialize database:**
```bash
cd workers && npm run db:migrate
```

4. **Start development:**
```bash
# From root - runs both services
npm run dev

# Or use startup scripts:
# Windows: ./scripts/dev.ps1
# Unix: ./scripts/dev.sh
```

## Production Deployment

### AlertGrid Frontend (Vercel)

1. **Connect to Vercel:**
```bash
cd frontend
npx vercel
```

2. **Set environment variables in Vercel dashboard:**
- `NEXT_PUBLIC_WEBSOCKET_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `RPC_URL`
- `PUBLISHER_ADDRESS`
- `WORKERS_API_URL` (your Railway/DO URL)
- `WORKERS_API_SECRET`

3. **Deploy:**
```bash
npx vercel --prod
```

### DataGrid Workers (Railway)

1. **Create Railway project:**
- Go to https://railway.app
- Create new project from GitHub repo
- Select the `workers` directory

2. **Set environment variables:**
- `RPC_URL`
- `PRIVATE_KEY`
- `PUBLISHER_ADDRESS`
- `TELEGRAM_BOT_TOKEN`
- `DATABASE_PATH=./data/alerts.db`
- `PUBLISH_INTERVAL_MS=30000`
- `SYMBOLS=BTC,ETH,USDC,USDT,ARB,SOL,SOMI`
- `WORKERS_API_PORT=3001`
- `WORKERS_API_SECRET` (same as Vercel)
- `COINGECKO_API_KEY_1`
- `ENABLE_DIA=true`

3. **Deploy:**
Railway auto-deploys on push to main branch.

### DataGrid Workers (DigitalOcean Droplet)

1. **Create droplet:**
- Ubuntu 22.04
- $6/mo (1GB RAM, 1 vCPU)

2. **Setup:**
```bash
ssh root@your-droplet-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone https://github.com/your-repo/somnia-datagrid.git
cd somnia-datagrid/workers

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env  # Edit with your values

# Initialize database
npm run db:migrate

# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "datagrid" -- run start
pm2 save
pm2 startup
```

## Telegram Bot Setup

1. **Create bot:**
- Message @BotFather on Telegram
- Send `/newbot`
- Follow prompts to create bot
- Save the bot token

2. **Set webhook:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-vercel-app.vercel.app/api/telegram/webhook&secret_token=<YOUR_SECRET>"
```

3. **Verify webhook:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

## Environment Variables Reference

### AlertGrid (frontend/.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `RPC_URL` | Somnia RPC endpoint | Yes |
| `WEBSOCKET_URL` | Somnia WebSocket endpoint | Yes |
| `NEXT_PUBLIC_WEBSOCKET_URL` | Public WebSocket URL | Yes |
| `PRIVATE_KEY` | Publisher wallet private key | Yes |
| `PUBLISHER_ADDRESS` | Publisher wallet address | Yes |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook validation secret | No |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username for deep links | No |
| `WORKERS_API_URL` | DataGrid API URL | Yes |
| `WORKERS_API_SECRET` | Shared secret | Yes |

### DataGrid (workers/.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `RPC_URL` | Somnia RPC endpoint | Yes |
| `PRIVATE_KEY` | Publisher wallet private key | Yes |
| `PUBLISHER_ADDRESS` | Publisher wallet address | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |
| `DATABASE_PATH` | SQLite database path | No |
| `PUBLISH_INTERVAL_MS` | Price publish interval | No |
| `SYMBOLS` | Comma-separated symbols | No |
| `WORKERS_API_PORT` | API port | No |
| `WORKERS_API_SECRET` | Shared secret | Yes |
| `COINGECKO_API_KEY_1` | CoinGecko Demo API key | Yes |
| `ENABLE_DIA` | Enable DIA Oracle | No |

## Monitoring

### Railway
- View logs in Railway dashboard
- Set up alerts for crashes

### DigitalOcean
```bash
pm2 logs datagrid
pm2 monit
pm2 restart datagrid
```

## Troubleshooting

### "No price data"
- Check if DataGrid workers are running
- Verify `PRIVATE_KEY` and `PUBLISHER_ADDRESS` are correct
- Check CoinGecko API rate limits

### "Telegram notifications not working"
- Verify bot token is correct
- Check webhook is registered
- Ensure user has linked their wallet
- Check `WORKERS_API_SECRET` matches in both services

### "WebSocket disconnected"
- Check `NEXT_PUBLIC_WEBSOCKET_URL` is correct
- Somnia testnet may have temporary outages
