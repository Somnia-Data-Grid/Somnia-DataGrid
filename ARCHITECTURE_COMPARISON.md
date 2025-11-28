# Architecture Comparison

## Overview

This document compares three deployment architectures for the Somnia DeFi Tracker.

## Option 1: Vercel + Railway (Recommended for Hackathon)

### Architecture
```
Vercel (Frontend)          Railway (Workers)
Port: 443                  No HTTP server
├─ Next.js App            ├─ Price Publisher
├─ API Routes             ├─ Alert Checker
├─ Telegram Webhook       ├─ Telegram Notifier
└─ In-memory Store        └─ SQLite Database
```

### Communication Flow
1. **Frontend → Somnia:** WebSocket subscription for live prices
2. **Workers → Somnia:** Publishes prices via SDK
3. **Workers → Telegram:** Sends notifications (outbound only)
4. **Telegram → Frontend:** Webhook to `/api/telegram/webhook`
5. **No direct communication** between Vercel and Railway

### Telegram Webhook
- **URL:** `https://your-app.vercel.app/api/telegram/webhook`
- **Handler:** Next.js API route
- **Port:** 443 (HTTPS)

### Database
- **Frontend:** In-memory (ephemeral)
- **Workers:** SQLite (`/app/data/alerts.db`)
- **Shared:** No (separate instances)

### Pros
- ✅ Free tier available (Vercel + Railway)
- ✅ Auto-scaling
- ✅ Global CDN
- ✅ Easy deployment
- ✅ Automatic HTTPS

### Cons
- ❌ Frontend database is ephemeral
- ❌ Two separate deployments
- ❌ Telegram links lost on Vercel redeploy

### Cost
- **Vercel:** Free
- **Railway:** Free (500 hrs/month) or $5/mo
- **Total:** $0-5/mo

### Setup Commands
```bash
# Deploy frontend
cd web && npx vercel --prod

# Deploy workers (via Railway dashboard)
# Connect GitHub → Select workers/ directory → Deploy

# Register Telegram webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook"
```

---

## Option 2: Single VPS (Best for Production)

### Architecture
```
VPS (Ubuntu 22.04)
IP: 123.45.67.89
├─ Nginx (Port 80/443)
│  └─ Reverse Proxy → Next.js (Port 3000)
├─ PM2 Process Manager
│  ├─ next-app (Next.js)
│  └─ workers (Background service)
└─ SQLite (/var/lib/somnia-defi/alerts.db)
   ├─ Accessed by Next.js
   └─ Accessed by Workers
```

### Communication Flow
1. **Frontend → Somnia:** WebSocket subscription
2. **Workers → Somnia:** Publishes prices
3. **Workers → Telegram:** Sends notifications
4. **Telegram → Nginx → Next.js:** Webhook to `/api/telegram/webhook`
5. **Both services → SQLite:** Shared database file

### Telegram Webhook
- **URL:** `https://your-domain.com/api/telegram/webhook`
- **Handler:** Next.js API route (via Nginx)
- **Port:** 443 (Nginx) → 3000 (Next.js)

### Database
- **Location:** `/var/lib/somnia-defi/alerts.db`
- **Shared:** Yes (both services access same file)
- **Mode:** WAL (Write-Ahead Logging) for concurrent access

### Pros
- ✅ Persistent database
- ✅ Full control
- ✅ Single deployment
- ✅ Shared SQLite database
- ✅ No vendor lock-in

### Cons
- ❌ Manual server management
- ❌ No auto-scaling
- ❌ Single point of failure
- ❌ Need to manage SSL certificates

### Cost
- **VPS:** $6/mo (DigitalOcean) or $5/mo (Hetzner)
- **Domain:** $12/yr (~$1/mo)
- **Total:** ~$7/mo

### Setup Commands
```bash
# See VPS_SETUP.md for full guide

# Quick start
ssh root@your-server-ip
git clone <repo>
npm run install:all
cd workers && npm run db:migrate
pm2 start ecosystem.config.js
```

---

## Option 3: Local Development

### Architecture
```
Localhost
├─ Next.js (Port 3000)
│  ├─ Frontend
│  ├─ API Routes
│  └─ Telegram Webhook (via ngrok)
└─ Workers (Background process)
   ├─ Price Publisher
   └─ SQLite (./workers/data/alerts.db)
```

### Communication Flow
1. **Frontend → Somnia:** WebSocket subscription
2. **Workers → Somnia:** Publishes prices
3. **Workers → Telegram:** Sends notifications
4. **Telegram → ngrok → Next.js:** Webhook forwarding

### Telegram Webhook
- **URL:** `https://abc123.ngrok.io/api/telegram/webhook`
- **Handler:** Next.js API route (via ngrok tunnel)
- **Port:** ngrok → 3000

### Database
- **Location:** `./workers/data/alerts.db`
- **Shared:** Yes (if web configured with DATABASE_PATH)

### Setup Commands
```bash
# Terminal 1: Next.js
cd web && npm run dev

# Terminal 2: Workers
cd workers && npm run dev

# Terminal 3: ngrok (for Telegram testing)
ngrok http 3000

# Register webhook with ngrok URL
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://abc123.ngrok.io/api/telegram/webhook"
```

---

## Feature Comparison

| Feature | Vercel + Railway | VPS | Local Dev |
|---------|------------------|-----|-----------|
| **Database Persistence** | Workers only | Yes | Yes |
| **Telegram Webhook** | Direct | Direct | Via ngrok |
| **Shared Database** | No | Yes | Optional |
| **Auto-scaling** | Yes | No | No |
| **Cost** | $0-5/mo | $7/mo | Free |
| **Setup Complexity** | Low | Medium | Low |
| **Maintenance** | Low | Medium | None |
| **Production Ready** | Yes | Yes | No |

---

## Database Access Patterns

### Vercel + Railway (Separate DBs)

**Frontend (In-memory):**
- Telegram links stored temporarily
- Lost on redeploy
- Good enough for webhook handling

**Workers (SQLite):**
- Persistent storage
- Alert history
- Notification logs

### VPS (Shared SQLite)

**Both services access same file:**
```
/var/lib/somnia-defi/alerts.db
├─ Read by Next.js (Telegram webhook, API routes)
└─ Read/Write by Workers (Alerts, notifications)
```

**SQLite WAL mode** handles concurrent access:
- Multiple readers simultaneously
- One writer at a time
- No locking issues

---

## Telegram Webhook Flow

### All Scenarios (Same Flow)

```
1. User sends /start to bot
   ↓
2. Telegram sends POST to webhook URL
   ↓
3. Next.js /api/telegram/webhook receives it
   ↓
4. Stores link in database (in-memory or SQLite)
   ↓
5. Sends welcome message back to user
```

**Key Point:** Telegram webhook ALWAYS goes to Next.js, never to workers.

### Webhook URLs by Deployment

| Deployment | Webhook URL |
|------------|-------------|
| Vercel + Railway | `https://your-app.vercel.app/api/telegram/webhook` |
| VPS | `https://your-domain.com/api/telegram/webhook` |
| Local (ngrok) | `https://abc123.ngrok.io/api/telegram/webhook` |

---

## Existing Scripts Compatibility

### All scripts still work!

```bash
# From web/ directory (old way - still works)
npm run publish:prices          # ✅ Works
npm run publish:continuous      # ✅ Works
npm run test:alerts            # ✅ Works
npm run test:alert-flow        # ✅ Works

# From workers/ directory (new way)
npm run publisher              # ✅ Same as publish:continuous
npm run publisher:once         # ✅ Same as publish:prices
npm run db:migrate            # ✅ Initialize SQLite

# From root directory (convenience)
npm run dev                    # ✅ Starts both services
npm run install:all           # ✅ Install all dependencies
```

---

## Recommendation by Use Case

### Hackathon Demo
→ **Vercel + Railway**
- Fast deployment
- Free tier
- Professional URLs
- No server management

### Production (Small Scale)
→ **Single VPS**
- Persistent database
- Full control
- Cost-effective
- Shared SQLite

### Production (Large Scale)
→ **Vercel + Railway + PostgreSQL**
- Replace SQLite with PostgreSQL
- Both services connect to same DB
- Auto-scaling
- High availability

### Local Development
→ **npm run dev**
- Fast iteration
- No deployment needed
- Full debugging access
