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
