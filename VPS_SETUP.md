# VPS Deployment Guide (Single Server)

Deploy both **Somnia DataGrid** (workers) and **Somnia AlertGrid** (frontend) on a single VPS.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS (Ubuntu 22.04)                        │
├─────────────────────────────────────────────────────────────┤
│  Nginx (Port 80/443) → AlertGrid (Port 3000)               │
│                                                              │
│  PM2 Process Manager:                                       │
│    - alertgrid (Next.js frontend + API)                    │
│    - datagrid (Price publisher + alerts)                   │
│                                                              │
│  Shared SQLite: /var/lib/somnia/alerts.db                  │
└─────────────────────────────────────────────────────────────┘
```

## Setup Steps

### 1. Create Droplet

- **Provider:** DigitalOcean, Hetzner, or Vultr
- **OS:** Ubuntu 22.04 LTS
- **Size:** $6/mo (1GB RAM, 1 vCPU)
- **Storage:** 25GB SSD

### 2. Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install build tools
apt install -y build-essential git

# Install PM2
npm install -g pm2

# Install Nginx
apt install -y nginx

# Setup firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 3. Clone and Setup Project

```bash
# Create app directory
mkdir -p /var/www/somnia-datagrid
cd /var/www/somnia-datagrid

# Clone repo
git clone https://github.com/your-repo/somnia-datagrid.git .

# Install dependencies
npm run install:all

# Create shared data directory
mkdir -p /var/lib/somnia
```

### 4. Configure Environment

```bash
# AlertGrid (frontend) environment
cat > frontend/.env << 'EOF'
RPC_URL=https://dream-rpc.somnia.network
WEBSOCKET_URL=wss://dream-rpc.somnia.network/ws
NEXT_PUBLIC_WEBSOCKET_URL=wss://dream-rpc.somnia.network/ws
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
PUBLISHER_ADDRESS=0xYOUR_WALLET_ADDRESS
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_secret
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourBotUsername
WORKERS_API_URL=http://localhost:3001
WORKERS_API_SECRET=shared_secret
EOF

# DataGrid (workers) environment
cat > workers/.env << 'EOF'
RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
PUBLISHER_ADDRESS=0xYOUR_WALLET_ADDRESS
TELEGRAM_BOT_TOKEN=your_bot_token
DATABASE_PATH=/var/lib/somnia/alerts.db
PUBLISH_INTERVAL_MS=30000
SYMBOLS=BTC,ETH,USDC,USDT,ARB,SOL,SOMI
WORKERS_API_PORT=3001
WORKERS_API_SECRET=shared_secret
COINGECKO_API_KEY_1=CG-xxx
ENABLE_DIA=true
EOF
```

### 5. Build Applications

```bash
# Build AlertGrid
cd frontend
npm run build

# Build DataGrid
cd ../workers
npm run build

# Initialize database
npm run db:migrate
```

### 6. Setup PM2

```bash
# Create PM2 ecosystem file
cat > /var/www/somnia-datagrid/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'alertgrid',
      cwd: '/var/www/somnia-datagrid/frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'datagrid',
      cwd: '/var/www/somnia-datagrid/workers',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    }
  ]
};
EOF

# Start services
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs
```

### 7. Configure Nginx

```bash
# Create Nginx config
cat > /etc/nginx/sites-available/somnia << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/somnia /etc/nginx/sites-enabled/

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx
```

### 8. Setup SSL (Recommended)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

### 9. Register Telegram Webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook&secret_token=<YOUR_SECRET>"
```

## Management Commands

### View Logs
```bash
pm2 logs alertgrid    # AlertGrid logs
pm2 logs datagrid     # DataGrid logs
pm2 logs              # All logs
```

### Restart Services
```bash
pm2 restart alertgrid
pm2 restart datagrid
pm2 restart all
```

### Monitor
```bash
pm2 monit
```

### Update Application
```bash
cd /var/www/somnia-datagrid
git pull
npm run install:all
cd frontend && npm run build
cd ../workers && npm run build
pm2 restart all
```

## Troubleshooting

### "Port 3000 already in use"
```bash
lsof -i :3000
kill -9 <PID>
pm2 restart alertgrid
```

### "Database locked"
```bash
pm2 restart all
```

### "Telegram webhook not working"
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
pm2 logs alertgrid | grep Telegram
```

## Cost Estimate

| Item | Cost |
|------|------|
| VPS (1GB RAM) | $6/mo |
| Domain | $12/yr |
| SSL Certificate | Free |
| **Total** | **~$6.50/mo** |
