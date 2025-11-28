-- Telegram Links: wallet <-> telegram chat mapping
CREATE TABLE IF NOT EXISTS telegram_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL UNIQUE,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  linked_at INTEGER NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_wallet ON telegram_links(wallet_address);
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat ON telegram_links(telegram_chat_id);

-- Off-chain Alerts (for gasless alerts)
CREATE TABLE IF NOT EXISTS offchain_alerts (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  asset TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('ABOVE', 'BELOW')),
  threshold_price TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIGGERED', 'DISABLED')),
  created_at INTEGER NOT NULL,
  triggered_at INTEGER,
  notified_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_offchain_alerts_wallet ON offchain_alerts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_offchain_alerts_status ON offchain_alerts(status);
CREATE INDEX IF NOT EXISTS idx_offchain_alerts_asset ON offchain_alerts(asset);
CREATE INDEX IF NOT EXISTS idx_offchain_alerts_active ON offchain_alerts(status, asset) WHERE status = 'ACTIVE';

-- Price History (optional, for charts)
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol, timestamp DESC);

-- Notification Log (for debugging/audit)
CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  telegram_chat_id TEXT,
  notification_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_log_alert ON notification_log(alert_id);


-- Tracked Tokens (user-selected tokens for sentiment tracking)
CREATE TABLE IF NOT EXISTS tracked_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin_id TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_tracked_tokens_symbol ON tracked_tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_active ON tracked_tokens(is_active) WHERE is_active = 1;

-- Sentiment Alerts (alerts based on sentiment changes)
CREATE TABLE IF NOT EXISTS sentiment_alerts (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  coin_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('SENTIMENT_UP', 'SENTIMENT_DOWN', 'FEAR_GREED')),
  threshold INTEGER NOT NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIGGERED', 'DISABLED')),
  created_at INTEGER NOT NULL,
  triggered_at INTEGER,
  notified_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_wallet ON sentiment_alerts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_status ON sentiment_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_coin ON sentiment_alerts(coin_id);


-- Fear & Greed Cache (latest value)
CREATE TABLE IF NOT EXISTS fear_greed_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  score INTEGER NOT NULL,
  zone TEXT NOT NULL,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  next_update INTEGER,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Token Sentiment Cache (latest per symbol)
CREATE TABLE IF NOT EXISTS token_sentiment_cache (
  symbol TEXT PRIMARY KEY,
  up_percent INTEGER NOT NULL,
  down_percent INTEGER NOT NULL,
  net_score INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- News Cache (recent news items)
CREATE TABLE IF NOT EXISTS news_cache (
  news_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  impact TEXT NOT NULL,
  votes_pos INTEGER DEFAULT 0,
  votes_neg INTEGER DEFAULT 0,
  votes_imp INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_news_cache_symbol ON news_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_news_cache_timestamp ON news_cache(timestamp DESC);
