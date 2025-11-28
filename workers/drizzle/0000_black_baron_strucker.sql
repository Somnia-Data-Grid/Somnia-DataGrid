CREATE TABLE `fear_greed_cache` (
	`id` integer PRIMARY KEY NOT NULL,
	`score` integer NOT NULL,
	`zone` text NOT NULL,
	`source` text NOT NULL,
	`timestamp` integer NOT NULL,
	`next_update` integer,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `news_cache` (
	`news_id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`sentiment` text NOT NULL,
	`impact` text NOT NULL,
	`votes_pos` integer DEFAULT 0,
	`votes_neg` integer DEFAULT 0,
	`votes_imp` integer DEFAULT 0,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `idx_news_cache_symbol` ON `news_cache` (`symbol`);--> statement-breakpoint
CREATE INDEX `idx_news_cache_timestamp` ON `news_cache` (`timestamp`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`telegram_chat_id` text,
	`notification_type` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `idx_notification_log_alert` ON `notification_log` (`alert_id`);--> statement-breakpoint
CREATE TABLE `offchain_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`asset` text NOT NULL,
	`condition` text NOT NULL,
	`threshold_price` text NOT NULL,
	`status` text DEFAULT 'ACTIVE',
	`created_at` integer NOT NULL,
	`triggered_at` integer,
	`notified_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_offchain_alerts_wallet` ON `offchain_alerts` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_offchain_alerts_status` ON `offchain_alerts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_offchain_alerts_asset` ON `offchain_alerts` (`asset`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`price` text NOT NULL,
	`decimals` integer NOT NULL,
	`source` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `idx_price_history_symbol` ON `price_history` (`symbol`,`timestamp`);--> statement-breakpoint
CREATE TABLE `sentiment_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`coin_id` text NOT NULL,
	`symbol` text NOT NULL,
	`alert_type` text NOT NULL,
	`threshold` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE',
	`created_at` integer NOT NULL,
	`triggered_at` integer,
	`notified_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sentiment_alerts_wallet` ON `sentiment_alerts` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_sentiment_alerts_status` ON `sentiment_alerts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sentiment_alerts_coin` ON `sentiment_alerts` (`coin_id`);--> statement-breakpoint
CREATE TABLE `stream_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`coingecko_id` text,
	`dia_key` text,
	`is_active` integer DEFAULT 1,
	`requested_by` text,
	`added_at` integer NOT NULL,
	`last_update` integer
);
--> statement-breakpoint
CREATE INDEX `idx_stream_registry_type` ON `stream_registry` (`type`);--> statement-breakpoint
CREATE INDEX `idx_stream_registry_symbol` ON `stream_registry` (`symbol`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_type_symbol` ON `stream_registry` (`type`,`symbol`);--> statement-breakpoint
CREATE TABLE `telegram_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_address` text NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`telegram_username` text,
	`linked_at` integer NOT NULL,
	`verified` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_links_wallet_address_unique` ON `telegram_links` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_telegram_links_wallet` ON `telegram_links` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_telegram_links_chat` ON `telegram_links` (`telegram_chat_id`);--> statement-breakpoint
CREATE TABLE `token_sentiment_cache` (
	`symbol` text PRIMARY KEY NOT NULL,
	`up_percent` integer NOT NULL,
	`down_percent` integer NOT NULL,
	`net_score` integer NOT NULL,
	`sample_size` integer NOT NULL,
	`source` text NOT NULL,
	`timestamp` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `tracked_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coin_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`added_by` text NOT NULL,
	`added_at` integer NOT NULL,
	`is_active` integer DEFAULT 1,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `idx_tracked_tokens_symbol` ON `tracked_tokens` (`symbol`);--> statement-breakpoint
CREATE INDEX `idx_tracked_tokens_user` ON `tracked_tokens` (`added_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_coin_user` ON `tracked_tokens` (`coin_id`,`added_by`);