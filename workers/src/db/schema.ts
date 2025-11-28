/**
 * Drizzle ORM Schema
 * 
 * Type-safe database schema for all tables.
 * Run `npm run db:generate` after changes to create migrations.
 */

import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============ Telegram Links ============
export const telegramLinks = sqliteTable("telegram_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletAddress: text("wallet_address").notNull().unique(),
  telegramChatId: text("telegram_chat_id").notNull(),
  telegramUsername: text("telegram_username"),
  linkedAt: integer("linked_at").notNull(),
  verified: integer("verified").default(0),
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at").default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("idx_telegram_links_wallet").on(table.walletAddress),
  index("idx_telegram_links_chat").on(table.telegramChatId),
]);

// ============ Off-chain Alerts ============
export const offchainAlerts = sqliteTable("offchain_alerts", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  asset: text("asset").notNull(),
  condition: text("condition", { enum: ["ABOVE", "BELOW"] }).notNull(),
  thresholdPrice: text("threshold_price").notNull(),
  status: text("status", { enum: ["ACTIVE", "TRIGGERED", "DISABLED"] }).default("ACTIVE"),
  createdAt: integer("created_at").notNull(),
  triggeredAt: integer("triggered_at"),
  notifiedAt: integer("notified_at"),
}, (table) => [
  index("idx_offchain_alerts_wallet").on(table.walletAddress),
  index("idx_offchain_alerts_status").on(table.status),
  index("idx_offchain_alerts_asset").on(table.asset),
]);

// ============ Price History ============
export const priceHistory = sqliteTable("price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  price: text("price").notNull(),
  decimals: integer("decimals").notNull(),
  source: text("source").notNull(),
  timestamp: integer("timestamp").notNull(),
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("idx_price_history_symbol").on(table.symbol, table.timestamp),
]);


// ============ Notification Log ============
export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull(),
  walletAddress: text("wallet_address").notNull(),
  telegramChatId: text("telegram_chat_id"),
  notificationType: text("notification_type").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("idx_notification_log_alert").on(table.alertId),
]);

// ============ Tracked Tokens ============
export const trackedTokens = sqliteTable("tracked_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  coinId: text("coin_id").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  addedBy: text("added_by").notNull(),
  addedAt: integer("added_at").notNull(),
  isActive: integer("is_active").default(1),
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  unique("unique_coin_user").on(table.coinId, table.addedBy),
  index("idx_tracked_tokens_symbol").on(table.symbol),
  index("idx_tracked_tokens_user").on(table.addedBy),
]);

// ============ Sentiment Alerts ============
export const sentimentAlerts = sqliteTable("sentiment_alerts", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  coinId: text("coin_id").notNull(),
  symbol: text("symbol").notNull(),
  alertType: text("alert_type", { enum: ["SENTIMENT_UP", "SENTIMENT_DOWN", "FEAR_GREED"] }).notNull(),
  threshold: integer("threshold").notNull(),
  status: text("status", { enum: ["ACTIVE", "TRIGGERED", "DISABLED"] }).default("ACTIVE"),
  createdAt: integer("created_at").notNull(),
  triggeredAt: integer("triggered_at"),
  notifiedAt: integer("notified_at"),
}, (table) => [
  index("idx_sentiment_alerts_wallet").on(table.walletAddress),
  index("idx_sentiment_alerts_status").on(table.status),
  index("idx_sentiment_alerts_coin").on(table.coinId),
]);

// ============ Fear & Greed Cache ============
export const fearGreedCache = sqliteTable("fear_greed_cache", {
  id: integer("id").primaryKey(),
  score: integer("score").notNull(),
  zone: text("zone").notNull(),
  source: text("source").notNull(),
  timestamp: integer("timestamp").notNull(),
  nextUpdate: integer("next_update"),
  updatedAt: integer("updated_at").default(sql`(strftime('%s', 'now'))`),
});

// ============ Token Sentiment Cache ============
export const tokenSentimentCache = sqliteTable("token_sentiment_cache", {
  symbol: text("symbol").primaryKey(),
  upPercent: integer("up_percent").notNull(),
  downPercent: integer("down_percent").notNull(),
  netScore: integer("net_score").notNull(),
  sampleSize: integer("sample_size").notNull(),
  source: text("source").notNull(),
  timestamp: integer("timestamp").notNull(),
  updatedAt: integer("updated_at").default(sql`(strftime('%s', 'now'))`),
});

// ============ News Cache ============
export const newsCache = sqliteTable("news_cache", {
  newsId: text("news_id").primaryKey(),
  symbol: text("symbol").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  source: text("source").notNull(),
  sentiment: text("sentiment").notNull(),
  impact: text("impact").notNull(),
  votesPos: integer("votes_pos").default(0),
  votesNeg: integer("votes_neg").default(0),
  votesImp: integer("votes_imp").default(0),
  timestamp: integer("timestamp").notNull(),
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("idx_news_cache_symbol").on(table.symbol),
  index("idx_news_cache_timestamp").on(table.timestamp),
]);

// ============ Type Exports ============
export type TelegramLink = typeof telegramLinks.$inferSelect;
export type NewTelegramLink = typeof telegramLinks.$inferInsert;

export type OffchainAlert = typeof offchainAlerts.$inferSelect;
export type NewOffchainAlert = typeof offchainAlerts.$inferInsert;

export type PriceRecord = typeof priceHistory.$inferSelect;
export type NewPriceRecord = typeof priceHistory.$inferInsert;

export type TrackedToken = typeof trackedTokens.$inferSelect;
export type NewTrackedToken = typeof trackedTokens.$inferInsert;

export type SentimentAlert = typeof sentimentAlerts.$inferSelect;
export type NewSentimentAlert = typeof sentimentAlerts.$inferInsert;

export type FearGreedCache = typeof fearGreedCache.$inferSelect;
export type TokenSentimentCache = typeof tokenSentimentCache.$inferSelect;
export type NewsCache = typeof newsCache.$inferSelect;


// ============ Stream Registry (for DataGrid API) ============
export const streamRegistry = sqliteTable("stream_registry", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  coingeckoId: text("coingecko_id"),
  diaKey: text("dia_key"),
  isActive: integer("is_active").default(1),
  requestedBy: text("requested_by"),
  addedAt: integer("added_at").notNull(),
  lastUpdate: integer("last_update"),
}, (table) => [
  unique("unique_type_symbol").on(table.type, table.symbol),
  index("idx_stream_registry_type").on(table.type),
  index("idx_stream_registry_symbol").on(table.symbol),
]);

export type StreamRegistry = typeof streamRegistry.$inferSelect;
