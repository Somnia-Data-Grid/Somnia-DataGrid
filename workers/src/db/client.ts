/**
 * SQLite Database Client
 * 
 * Fast, reliable storage for:
 * - Telegram wallet links
 * - Off-chain alerts
 * - Price history
 * - Notification logs
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Types
export interface TelegramLink {
  id?: number;
  wallet_address: string;
  telegram_chat_id: string;
  telegram_username?: string;
  linked_at: number;
  verified: number;
}

export interface OffchainAlert {
  id: string;
  wallet_address: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  threshold_price: string;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  created_at: number;
  triggered_at?: number;
  notified_at?: number;
}

export interface PriceRecord {
  id?: number;
  symbol: string;
  price: string;
  decimals: number;
  source: string;
  timestamp: number;
}

export interface TrackedToken {
  id?: number;
  coin_id: string;
  symbol: string;
  name: string;
  added_by: string;
  added_at: number;
  is_active: number;
}

export interface SentimentAlert {
  id: string;
  wallet_address: string;
  coin_id: string;
  symbol: string;
  alert_type: "SENTIMENT_UP" | "SENTIMENT_DOWN" | "FEAR_GREED";
  threshold: number;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  created_at: number;
  triggered_at?: number;
  notified_at?: number;
}

// Singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || "./data/alerts.db";
  const dbDir = dirname(dbPath);

  // Ensure directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL"); // Better concurrent access
  db.pragma("synchronous = NORMAL"); // Good balance of speed/safety

  // Run migrations
  const schemaPath = join(__dirname, "schema.sql");
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, "utf-8");
    db.exec(schema);
  }

  console.log(`[DB] Connected to ${dbPath}`);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// ============ Telegram Links ============

export function getTelegramLink(walletAddress: string): TelegramLink | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM telegram_links 
    WHERE LOWER(wallet_address) = LOWER(?)
  `);
  return stmt.get(walletAddress) as TelegramLink | null;
}

export function getTelegramLinkByChatId(chatId: string): TelegramLink | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM telegram_links 
    WHERE telegram_chat_id = ?
  `);
  return stmt.get(chatId) as TelegramLink | null;
}

export function upsertTelegramLink(link: Omit<TelegramLink, "id">): TelegramLink {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO telegram_links (wallet_address, telegram_chat_id, telegram_username, linked_at, verified)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      telegram_chat_id = excluded.telegram_chat_id,
      telegram_username = excluded.telegram_username,
      linked_at = excluded.linked_at,
      verified = excluded.verified,
      updated_at = strftime('%s', 'now')
    RETURNING *
  `);
  return stmt.get(
    link.wallet_address.toLowerCase(),
    link.telegram_chat_id,
    link.telegram_username || null,
    link.linked_at,
    link.verified
  ) as TelegramLink;
}

export function verifyTelegramLink(walletAddress: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE telegram_links 
    SET verified = 1, updated_at = strftime('%s', 'now')
    WHERE LOWER(wallet_address) = LOWER(?)
  `);
  const result = stmt.run(walletAddress);
  return result.changes > 0;
}

export function deleteTelegramLink(walletAddress: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM telegram_links 
    WHERE LOWER(wallet_address) = LOWER(?)
  `);
  const result = stmt.run(walletAddress);
  return result.changes > 0;
}

// ============ Off-chain Alerts ============

export function createOffchainAlert(alert: OffchainAlert): OffchainAlert {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO offchain_alerts (id, wallet_address, asset, condition, threshold_price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(
    alert.id,
    alert.wallet_address.toLowerCase(),
    alert.asset.toUpperCase(),
    alert.condition,
    alert.threshold_price,
    alert.status,
    alert.created_at
  ) as OffchainAlert;
}

export function getActiveAlertsByAsset(asset: string): OffchainAlert[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM offchain_alerts 
    WHERE status = 'ACTIVE' AND UPPER(asset) = UPPER(?)
  `);
  return stmt.all(asset) as OffchainAlert[];
}

export function getActiveAlerts(): OffchainAlert[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM offchain_alerts 
    WHERE status = 'ACTIVE'
    ORDER BY created_at DESC
  `);
  return stmt.all() as OffchainAlert[];
}

export function getAlertsByWallet(walletAddress: string): OffchainAlert[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM offchain_alerts 
    WHERE LOWER(wallet_address) = LOWER(?)
    ORDER BY created_at DESC
  `);
  return stmt.all(walletAddress) as OffchainAlert[];
}

export function triggerAlert(alertId: string): OffchainAlert | null {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE offchain_alerts 
    SET status = 'TRIGGERED', triggered_at = strftime('%s', 'now')
    WHERE id = ? AND status = 'ACTIVE'
    RETURNING *
  `);
  return stmt.get(alertId) as OffchainAlert | null;
}

export function markAlertNotified(alertId: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE offchain_alerts 
    SET notified_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  const result = stmt.run(alertId);
  return result.changes > 0;
}

export function deleteAlert(alertId: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM offchain_alerts WHERE id = ?`);
  const result = stmt.run(alertId);
  return result.changes > 0;
}

// ============ Price History ============

export function insertPriceRecord(record: Omit<PriceRecord, "id">): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO price_history (symbol, price, decimals, source, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(record.symbol, record.price, record.decimals, record.source, record.timestamp);
}

export function getLatestPrice(symbol: string): PriceRecord | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM price_history 
    WHERE UPPER(symbol) = UPPER(?)
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return stmt.get(symbol) as PriceRecord | null;
}

export function getPriceHistory(symbol: string, limit = 100): PriceRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM price_history 
    WHERE UPPER(symbol) = UPPER(?)
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(symbol, limit) as PriceRecord[];
}

// ============ Notification Log ============

export function logNotification(
  alertId: string,
  walletAddress: string,
  telegramChatId: string | null,
  notificationType: string,
  status: "success" | "failed",
  errorMessage?: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO notification_log (alert_id, wallet_address, telegram_chat_id, notification_type, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(alertId, walletAddress, telegramChatId, notificationType, status, errorMessage || null);
}

// ============ Tracked Tokens ============

export function addTrackedToken(coinId: string, symbol: string, name: string, addedBy: string): TrackedToken {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tracked_tokens (coin_id, symbol, name, added_by, added_at, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(coin_id) DO UPDATE SET
      is_active = 1,
      added_by = CASE WHEN added_by = 'system' THEN excluded.added_by ELSE added_by END
    RETURNING *
  `);
  return stmt.get(coinId, symbol.toUpperCase(), name, addedBy, Math.floor(Date.now() / 1000)) as TrackedToken;
}

export function removeTrackedToken(coinId: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`UPDATE tracked_tokens SET is_active = 0 WHERE coin_id = ?`);
  return stmt.run(coinId).changes > 0;
}

export function getTrackedTokens(): TrackedToken[] {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM tracked_tokens WHERE is_active = 1 ORDER BY added_at`);
  return stmt.all() as TrackedToken[];
}

export function getTrackedTokenBySymbol(symbol: string): TrackedToken | null {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM tracked_tokens WHERE UPPER(symbol) = UPPER(?) AND is_active = 1`);
  return stmt.get(symbol) as TrackedToken | null;
}

// ============ Sentiment Alerts ============

export function createSentimentAlert(alert: SentimentAlert): SentimentAlert {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sentiment_alerts (id, wallet_address, coin_id, symbol, alert_type, threshold, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(
    alert.id,
    alert.wallet_address.toLowerCase(),
    alert.coin_id,
    alert.symbol.toUpperCase(),
    alert.alert_type,
    alert.threshold,
    alert.status,
    alert.created_at
  ) as SentimentAlert;
}

export function getSentimentAlertsByWallet(walletAddress: string): SentimentAlert[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM sentiment_alerts 
    WHERE LOWER(wallet_address) = LOWER(?)
    ORDER BY created_at DESC
  `);
  return stmt.all(walletAddress) as SentimentAlert[];
}

export function getActiveSentimentAlerts(): SentimentAlert[] {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM sentiment_alerts WHERE status = 'ACTIVE'`);
  return stmt.all() as SentimentAlert[];
}

export function getActiveSentimentAlertsByCoin(coinId: string): SentimentAlert[] {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM sentiment_alerts WHERE status = 'ACTIVE' AND coin_id = ?`);
  return stmt.all(coinId) as SentimentAlert[];
}

export function triggerSentimentAlert(alertId: string): SentimentAlert | null {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE sentiment_alerts 
    SET status = 'TRIGGERED', triggered_at = strftime('%s', 'now')
    WHERE id = ? AND status = 'ACTIVE'
    RETURNING *
  `);
  return stmt.get(alertId) as SentimentAlert | null;
}

export function deleteSentimentAlert(alertId: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM sentiment_alerts WHERE id = ?`);
  return stmt.run(alertId).changes > 0;
}
