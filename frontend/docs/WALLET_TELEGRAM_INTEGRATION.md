# Wallet & Telegram Integration Guide

## Overview

This guide covers how to set up wallet connection (RainbowKit) and Telegram notifications for price alerts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  • WalletConnect via RainbowKit                             │
│  • In-memory Telegram link storage (serverless-friendly)    │
│  • Webhook handler for Telegram bot                         │
│  • Alert creation → writes to Somnia blockchain             │
│  • Syncs Telegram links to Workers API                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (sync via HTTP API)
┌─────────────────────────────────────────────────────────────┐
│                     Workers Service                          │
├─────────────────────────────────────────────────────────────┤
│  • SQLite database for persistent storage                   │
│  • CoinGecko price fetching (multi-key fallback)           │
│  • DIA Oracle for Somnia native token (STT)                │
│  • Alert checking & triggering                              │
│  • Telegram notification sending                            │
│  • HTTP API for frontend sync (port 3001)                  │
└─────────────────────────────────────────────────────────────┘
```

## Wallet Connection Setup

### 1. Get WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Copy the Project ID

### 2. Configure Environment

```bash
# web/.env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### 3. Usage

The wallet connection is already integrated. Users can:
- Click "Connect Wallet" button in the header
- Select their preferred wallet (MetaMask, WalletConnect, etc.)
- Sign in to Somnia Testnet

## Telegram Bot Setup

### 1. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow the prompts to name your bot
4. Copy the API token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Configure Environment

```bash
# web/.env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=your_random_secret_string
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourBotUsername

# workers/.env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Set Up Webhook (Production)

After deploying, set the webhook URL:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook&secret_token=<YOUR_WEBHOOK_SECRET>"
```

### 4. User Flow

1. User connects wallet on dashboard
2. User clicks "Link Telegram" button
3. Opens Telegram with deep link to bot
4. User clicks "Confirm Link" in Telegram
5. Bot sends welcome message
6. User receives alerts when triggered

## Price Sources

### CoinGecko (Primary)

For most assets: BTC, ETH, USDC, USDT, ARB, SOL, etc.

1. Go to [CoinGecko API](https://www.coingecko.com/en/api/pricing)
2. Sign up for free Demo tier
3. Go to [Developer Dashboard](https://www.coingecko.com/en/developers/dashboard)
4. Create up to 3 API keys for fallback

```bash
# workers/.env
COINGECKO_API_KEY_1=CG-your-first-api-key
COINGECKO_API_KEY_2=CG-your-second-api-key
COINGECKO_API_KEY_3=CG-your-third-api-key
```

Rate Limits:
- Demo tier: 30 calls/minute per key
- With 3 keys: effectively 90 calls/minute
- Auto-fallback if one key hits rate limit

### DIA Oracle (On-Chain)

For Somnia native token (STT) and fallback:

```bash
# workers/.env
ENABLE_DIA=true
```

DIA Oracle reads prices directly from Somnia Testnet:
- Address: `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D`
- Supported: STT, SOMI, BTC, ETH, USDT, USDC, ARB, SOL

### Supported Symbols

```bash
# workers/.env
SYMBOLS=BTC,ETH,USDC,USDT,STT,ARB,SOL
```

| Symbol | Source | Notes |
|--------|--------|-------|
| BTC | CoinGecko | Bitcoin |
| ETH | CoinGecko | Ethereum (uses WETH on DIA) |
| USDC | CoinGecko | USD Coin |
| USDT | CoinGecko | Tether |
| ARB | CoinGecko | Arbitrum |
| SOL | CoinGecko | Solana |
| SOMNIA | CoinGecko | Somnia mainnet token |
| SOMI | DIA | Somnia token (on DIA Oracle) |

**Note**: STT is the native gas token on Somnia Testnet (like ETH on Ethereum). It doesn't have a price feed because it's used for gas, not as a tradeable asset. To track Somnia token price, use SOMI (DIA) or SOMNIA (CoinGecko).

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot / link wallet |
| `/help` | Show available commands |
| `/alerts` | View your active alerts |
| `/test` | Send a test notification |
| `/unlink` | Unlink your wallet |

## Troubleshooting

### Wallet Connection Issues

- Ensure WalletConnect Project ID is set
- Check browser console for errors
- Try clearing browser cache

### Telegram Not Working

1. Verify bot token is correct
2. Check webhook is set (GET `/api/telegram/webhook` should return status)
3. Ensure `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` matches your bot

### Alerts Not Triggering

1. Check Workers service is running
2. Verify CoinGecko API keys are valid
3. Check Workers logs for errors

## Security Notes

- Never expose `TELEGRAM_BOT_TOKEN` to client
- Use `TELEGRAM_WEBHOOK_SECRET` to verify webhook requests
- `PRIVATE_KEY` should only be in server environment
