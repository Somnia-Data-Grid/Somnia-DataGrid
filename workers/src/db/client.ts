/**
 * Database Client (Drizzle ORM)
 * 
 * Type-safe database operations for:
 * - Telegram wallet links
 * - Off-chain alerts
 * - Price history
 * - Sentiment data
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

import * as schema from "./schema.js";
import {
  telegramLinks,
  offchainAlerts,
  priceHistory,
  notificationLog,
  trackedTokens,
  sentimentAlerts,
  fearGreedCache,
  tokenSentimentCache,
  newsCache,
} from "./schema.js";

// Re-export types from schema
export type {
  TelegramLink,
  OffchainAlert,
  PriceRecord,
  TrackedToken,
  SentimentAlert,
  FearGreedCache,
  TokenSentimentCache,
  NewsCache,
} from "./schema.js";

// Legacy type aliases for backward compatibility
export type FearGreedCacheData = {
  score: number;
  zone: string;
  source: string;
  timestamp: number;
  next_update: number | null;
};

export type TokenSentimentCacheData = {
  symbol: string;
  up_percent: number;
  down_percent: number;
  net_score: number;
  sample_size: number;
  source: string;
  timestamp: number;
};

export type NewsCacheData = {
  news_id: string;
  symbol: string;
  title: string;
  url: string;
  source: string;
  sentiment: string;
  impact: string;
  votes_pos: number;
  votes_neg: number;
  votes_imp: number;
  timestamp: number;
};


// Singleton instances
let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || "./data/alerts.db";
  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");

  db = drizzle(sqlite, { schema });
  console.log(`[DB] Connected to ${dbPath} (Drizzle ORM)`);
  return db;
}

export function getSqlite(): Database.Database {
  if (!sqlite) getDb();
  return sqlite!;
}

export function closeDb() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

// ============ Telegram Links ============

export function getTelegramLink(walletAddress: string) {
  const result = getDb()
    .select()
    .from(telegramLinks)
    .where(eq(sql`LOWER(${telegramLinks.walletAddress})`, walletAddress.toLowerCase()))
    .get();
  return result || null;
}

export function getTelegramLinkByChatId(chatId: string) {
  const result = getDb()
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.telegramChatId, chatId))
    .get();
  return result || null;
}

export function upsertTelegramLink(link: {
  wallet_address: string;
  telegram_chat_id: string;
  telegram_username?: string | null;
  linked_at: number;
  verified: number;
}) {
  const db = getDb();
  const existing = getTelegramLink(link.wallet_address);
  
  if (existing) {
    return db
      .update(telegramLinks)
      .set({
        telegramChatId: link.telegram_chat_id,
        telegramUsername: link.telegram_username,
        linkedAt: link.linked_at,
        verified: link.verified,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(telegramLinks.id, existing.id))
      .returning()
      .get()!;
  }
  
  return db
    .insert(telegramLinks)
    .values({
      walletAddress: link.wallet_address.toLowerCase(),
      telegramChatId: link.telegram_chat_id,
      telegramUsername: link.telegram_username,
      linkedAt: link.linked_at,
      verified: link.verified,
    })
    .returning()
    .get()!;
}

export function verifyTelegramLink(walletAddress: string): boolean {
  const result = getDb()
    .update(telegramLinks)
    .set({ verified: 1, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(sql`LOWER(${telegramLinks.walletAddress})`, walletAddress.toLowerCase()))
    .run();
  return result.changes > 0;
}

export function deleteTelegramLink(walletAddress: string): boolean {
  const result = getDb()
    .delete(telegramLinks)
    .where(eq(sql`LOWER(${telegramLinks.walletAddress})`, walletAddress.toLowerCase()))
    .run();
  return result.changes > 0;
}


// ============ Off-chain Alerts ============

export function createOffchainAlert(alert: {
  id: string;
  wallet_address: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  threshold_price: string;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  created_at: number;
}) {
  return getDb()
    .insert(offchainAlerts)
    .values({
      id: alert.id,
      walletAddress: alert.wallet_address.toLowerCase(),
      asset: alert.asset.toUpperCase(),
      condition: alert.condition,
      thresholdPrice: alert.threshold_price,
      status: alert.status,
      createdAt: alert.created_at,
    })
    .returning()
    .get()!;
}

export function getActiveAlertsByAsset(asset: string) {
  return getDb()
    .select()
    .from(offchainAlerts)
    .where(and(
      eq(offchainAlerts.status, "ACTIVE"),
      eq(sql`UPPER(${offchainAlerts.asset})`, asset.toUpperCase())
    ))
    .all();
}

export function getActiveAlerts() {
  return getDb()
    .select()
    .from(offchainAlerts)
    .where(eq(offchainAlerts.status, "ACTIVE"))
    .orderBy(desc(offchainAlerts.createdAt))
    .all();
}

export function getTriggeredAlertsSince(sinceTimestamp: number, limit = 20) {
  return getDb()
    .select()
    .from(offchainAlerts)
    .where(and(
      eq(offchainAlerts.status, "TRIGGERED"),
      sql`${offchainAlerts.triggeredAt} > ${sinceTimestamp}`
    ))
    .orderBy(desc(offchainAlerts.triggeredAt))
    .limit(limit)
    .all();
}

export function getAlertsByWallet(walletAddress: string) {
  return getDb()
    .select()
    .from(offchainAlerts)
    .where(eq(sql`LOWER(${offchainAlerts.walletAddress})`, walletAddress.toLowerCase()))
    .orderBy(desc(offchainAlerts.createdAt))
    .all();
}

export function triggerAlert(alertId: string) {
  const result = getDb()
    .update(offchainAlerts)
    .set({ 
      status: "TRIGGERED", 
      triggeredAt: Math.floor(Date.now() / 1000) 
    })
    .where(and(
      eq(offchainAlerts.id, alertId),
      eq(offchainAlerts.status, "ACTIVE")
    ))
    .returning()
    .get();
  return result || null;
}

export function markAlertNotified(alertId: string): boolean {
  const result = getDb()
    .update(offchainAlerts)
    .set({ notifiedAt: Math.floor(Date.now() / 1000) })
    .where(eq(offchainAlerts.id, alertId))
    .run();
  return result.changes > 0;
}

export function deleteAlert(alertId: string): boolean {
  const result = getDb()
    .delete(offchainAlerts)
    .where(eq(offchainAlerts.id, alertId))
    .run();
  return result.changes > 0;
}

// ============ Price History ============

export function insertPriceRecord(record: {
  symbol: string;
  price: string;
  decimals: number;
  source: string;
  timestamp: number;
}) {
  getDb()
    .insert(priceHistory)
    .values(record)
    .run();
}

export function getLatestPrice(symbol: string) {
  const result = getDb()
    .select()
    .from(priceHistory)
    .where(eq(sql`UPPER(${priceHistory.symbol})`, symbol.toUpperCase()))
    .orderBy(desc(priceHistory.timestamp))
    .limit(1)
    .get();
  return result || null;
}

export function getPriceHistory(symbol: string, limit = 100) {
  return getDb()
    .select()
    .from(priceHistory)
    .where(eq(sql`UPPER(${priceHistory.symbol})`, symbol.toUpperCase()))
    .orderBy(desc(priceHistory.timestamp))
    .limit(limit)
    .all();
}

// ============ Notification Log ============

export function logNotification(
  alertId: string,
  walletAddress: string,
  telegramChatId: string | null,
  notificationType: string,
  status: "success" | "failed",
  errorMessage?: string
) {
  getDb()
    .insert(notificationLog)
    .values({
      alertId,
      walletAddress,
      telegramChatId,
      notificationType,
      status,
      errorMessage: errorMessage || null,
    })
    .run();
}


// ============ Tracked Tokens ============

export function addTrackedToken(coinId: string, symbol: string, name: string, addedBy: string) {
  const db = getDb();
  
  // Check if exists
  const existing = db
    .select()
    .from(trackedTokens)
    .where(and(
      eq(trackedTokens.coinId, coinId),
      eq(sql`LOWER(${trackedTokens.addedBy})`, addedBy.toLowerCase())
    ))
    .get();
  
  if (existing) {
    return db
      .update(trackedTokens)
      .set({ isActive: 1, symbol: symbol.toUpperCase(), name })
      .where(eq(trackedTokens.id, existing.id))
      .returning()
      .get()!;
  }
  
  return db
    .insert(trackedTokens)
    .values({
      coinId,
      symbol: symbol.toUpperCase(),
      name,
      addedBy: addedBy.toLowerCase(),
      addedAt: Math.floor(Date.now() / 1000),
      isActive: 1,
    })
    .returning()
    .get()!;
}

export function removeTrackedToken(coinId: string, wallet: string): boolean {
  const result = getDb()
    .update(trackedTokens)
    .set({ isActive: 0 })
    .where(and(
      eq(trackedTokens.coinId, coinId),
      eq(sql`LOWER(${trackedTokens.addedBy})`, wallet.toLowerCase())
    ))
    .run();
  return result.changes > 0;
}

export function getTrackedTokens(wallet?: string) {
  const db = getDb();
  if (wallet) {
    return db
      .select()
      .from(trackedTokens)
      .where(and(
        eq(trackedTokens.isActive, 1),
        or(
          eq(trackedTokens.addedBy, "system"),
          eq(sql`LOWER(${trackedTokens.addedBy})`, wallet.toLowerCase())
        )
      ))
      .orderBy(trackedTokens.addedAt)
      .all();
  }
  return db
    .select()
    .from(trackedTokens)
    .where(eq(trackedTokens.isActive, 1))
    .orderBy(trackedTokens.addedAt)
    .all();
}

export function getUserTrackedTokens(wallet: string) {
  return getDb()
    .select()
    .from(trackedTokens)
    .where(and(
      eq(trackedTokens.isActive, 1),
      eq(sql`LOWER(${trackedTokens.addedBy})`, wallet.toLowerCase()),
      sql`${trackedTokens.addedBy} != 'system'`
    ))
    .orderBy(trackedTokens.addedAt)
    .all();
}

export function getTrackedTokenBySymbol(symbol: string) {
  const result = getDb()
    .select()
    .from(trackedTokens)
    .where(and(
      eq(sql`UPPER(${trackedTokens.symbol})`, symbol.toUpperCase()),
      eq(trackedTokens.isActive, 1)
    ))
    .limit(1)
    .get();
  return result || null;
}

export function isTokenTrackedByUser(coinId: string, wallet: string): boolean {
  const result = getDb()
    .select({ id: trackedTokens.id })
    .from(trackedTokens)
    .where(and(
      eq(trackedTokens.coinId, coinId),
      eq(sql`LOWER(${trackedTokens.addedBy})`, wallet.toLowerCase()),
      eq(trackedTokens.isActive, 1)
    ))
    .get();
  return !!result;
}


// ============ Sentiment Alerts ============

export function createSentimentAlert(alert: {
  id: string;
  wallet_address: string;
  coin_id: string;
  symbol: string;
  alert_type: "SENTIMENT_UP" | "SENTIMENT_DOWN" | "FEAR_GREED";
  threshold: number;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  created_at: number;
}) {
  return getDb()
    .insert(sentimentAlerts)
    .values({
      id: alert.id,
      walletAddress: alert.wallet_address.toLowerCase(),
      coinId: alert.coin_id,
      symbol: alert.symbol.toUpperCase(),
      alertType: alert.alert_type,
      threshold: alert.threshold,
      status: alert.status,
      createdAt: alert.created_at,
    })
    .returning()
    .get()!;
}

export function getSentimentAlertsByWallet(walletAddress: string) {
  return getDb()
    .select()
    .from(sentimentAlerts)
    .where(eq(sql`LOWER(${sentimentAlerts.walletAddress})`, walletAddress.toLowerCase()))
    .orderBy(desc(sentimentAlerts.createdAt))
    .all();
}

export function getActiveSentimentAlerts() {
  return getDb()
    .select()
    .from(sentimentAlerts)
    .where(eq(sentimentAlerts.status, "ACTIVE"))
    .all();
}

export function getActiveSentimentAlertsByCoin(coinId: string) {
  return getDb()
    .select()
    .from(sentimentAlerts)
    .where(and(
      eq(sentimentAlerts.status, "ACTIVE"),
      eq(sentimentAlerts.coinId, coinId)
    ))
    .all();
}

export function triggerSentimentAlert(alertId: string) {
  const result = getDb()
    .update(sentimentAlerts)
    .set({ 
      status: "TRIGGERED", 
      triggeredAt: Math.floor(Date.now() / 1000) 
    })
    .where(and(
      eq(sentimentAlerts.id, alertId),
      eq(sentimentAlerts.status, "ACTIVE")
    ))
    .returning()
    .get();
  return result || null;
}

export function deleteSentimentAlert(alertId: string): boolean {
  const result = getDb()
    .delete(sentimentAlerts)
    .where(eq(sentimentAlerts.id, alertId))
    .run();
  return result.changes > 0;
}

export function markSentimentAlertNotified(alertId: string): boolean {
  const result = getDb()
    .update(sentimentAlerts)
    .set({ notifiedAt: Math.floor(Date.now() / 1000) })
    .where(eq(sentimentAlerts.id, alertId))
    .run();
  return result.changes > 0;
}


// ============ Sentiment Cache ============

export function upsertFearGreed(data: FearGreedCacheData) {
  const db = getDb();
  const existing = db.select().from(fearGreedCache).where(eq(fearGreedCache.id, 1)).get();
  
  if (existing) {
    db.update(fearGreedCache)
      .set({
        score: data.score,
        zone: data.zone,
        source: data.source,
        timestamp: data.timestamp,
        nextUpdate: data.next_update,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(fearGreedCache.id, 1))
      .run();
  } else {
    db.insert(fearGreedCache)
      .values({
        id: 1,
        score: data.score,
        zone: data.zone,
        source: data.source,
        timestamp: data.timestamp,
        nextUpdate: data.next_update,
      })
      .run();
  }
}

export function getFearGreed(): FearGreedCacheData | null {
  const result = getDb()
    .select({
      score: fearGreedCache.score,
      zone: fearGreedCache.zone,
      source: fearGreedCache.source,
      timestamp: fearGreedCache.timestamp,
      next_update: fearGreedCache.nextUpdate,
    })
    .from(fearGreedCache)
    .where(eq(fearGreedCache.id, 1))
    .get();
  return result || null;
}

export function upsertTokenSentiment(data: TokenSentimentCacheData) {
  const db = getDb();
  const symbol = data.symbol.toUpperCase();
  const existing = db.select().from(tokenSentimentCache).where(eq(tokenSentimentCache.symbol, symbol)).get();
  
  if (existing) {
    db.update(tokenSentimentCache)
      .set({
        upPercent: data.up_percent,
        downPercent: data.down_percent,
        netScore: data.net_score,
        sampleSize: data.sample_size,
        source: data.source,
        timestamp: data.timestamp,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(tokenSentimentCache.symbol, symbol))
      .run();
  } else {
    db.insert(tokenSentimentCache)
      .values({
        symbol,
        upPercent: data.up_percent,
        downPercent: data.down_percent,
        netScore: data.net_score,
        sampleSize: data.sample_size,
        source: data.source,
        timestamp: data.timestamp,
      })
      .run();
  }
}

export function getTokenSentiment(symbol: string): TokenSentimentCacheData | null {
  const result = getDb()
    .select({
      symbol: tokenSentimentCache.symbol,
      up_percent: tokenSentimentCache.upPercent,
      down_percent: tokenSentimentCache.downPercent,
      net_score: tokenSentimentCache.netScore,
      sample_size: tokenSentimentCache.sampleSize,
      source: tokenSentimentCache.source,
      timestamp: tokenSentimentCache.timestamp,
    })
    .from(tokenSentimentCache)
    .where(eq(sql`UPPER(${tokenSentimentCache.symbol})`, symbol.toUpperCase()))
    .get();
  return result || null;
}

export function getAllTokenSentiments(): TokenSentimentCacheData[] {
  return getDb()
    .select({
      symbol: tokenSentimentCache.symbol,
      up_percent: tokenSentimentCache.upPercent,
      down_percent: tokenSentimentCache.downPercent,
      net_score: tokenSentimentCache.netScore,
      sample_size: tokenSentimentCache.sampleSize,
      source: tokenSentimentCache.source,
      timestamp: tokenSentimentCache.timestamp,
    })
    .from(tokenSentimentCache)
    .orderBy(tokenSentimentCache.symbol)
    .all();
}


// ============ News Cache ============

export function upsertNews(data: NewsCacheData) {
  const db = getDb();
  const existing = db.select().from(newsCache).where(eq(newsCache.newsId, data.news_id)).get();
  
  if (existing) {
    db.update(newsCache)
      .set({
        votesPos: data.votes_pos,
        votesNeg: data.votes_neg,
        votesImp: data.votes_imp,
      })
      .where(eq(newsCache.newsId, data.news_id))
      .run();
  } else {
    db.insert(newsCache)
      .values({
        newsId: data.news_id,
        symbol: data.symbol,
        title: data.title,
        url: data.url,
        source: data.source,
        sentiment: data.sentiment,
        impact: data.impact,
        votesPos: data.votes_pos,
        votesNeg: data.votes_neg,
        votesImp: data.votes_imp,
        timestamp: data.timestamp,
      })
      .run();
  }
}

export function getRecentNews(limit = 20): NewsCacheData[] {
  return getDb()
    .select({
      news_id: newsCache.newsId,
      symbol: newsCache.symbol,
      title: newsCache.title,
      url: newsCache.url,
      source: newsCache.source,
      sentiment: newsCache.sentiment,
      impact: newsCache.impact,
      votes_pos: newsCache.votesPos,
      votes_neg: newsCache.votesNeg,
      votes_imp: newsCache.votesImp,
      timestamp: newsCache.timestamp,
    })
    .from(newsCache)
    .orderBy(desc(newsCache.timestamp))
    .limit(limit)
    .all() as NewsCacheData[];
}

export function getNewsBySymbol(symbol: string, limit = 10): NewsCacheData[] {
  return getDb()
    .select({
      news_id: newsCache.newsId,
      symbol: newsCache.symbol,
      title: newsCache.title,
      url: newsCache.url,
      source: newsCache.source,
      sentiment: newsCache.sentiment,
      impact: newsCache.impact,
      votes_pos: newsCache.votesPos,
      votes_neg: newsCache.votesNeg,
      votes_imp: newsCache.votesImp,
      timestamp: newsCache.timestamp,
    })
    .from(newsCache)
    .where(eq(sql`UPPER(${newsCache.symbol})`, symbol.toUpperCase()))
    .orderBy(desc(newsCache.timestamp))
    .limit(limit)
    .all() as NewsCacheData[];
}

export function cleanOldNews(): number {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const result = getDb()
    .delete(newsCache)
    .where(sql`${newsCache.timestamp} < ${weekAgo}`)
    .run();
  return result.changes;
}

// ============ Migration Helper ============

export function runMigrations() {
  const sqlite = getSqlite();
  
  // Create tables if they don't exist (for fresh installs)
  // Drizzle will handle this via push/migrate commands
  console.log("[DB] Migrations handled by Drizzle");
}
