/**
 * Database Schema for Telegram Integration
 * 
 * Uses a simple JSON file for persistence (no external DB needed)
 * In production, consider SQLite or a proper database
 */

export interface TelegramLink {
  walletAddress: string;
  telegramChatId: string;
  telegramUsername?: string;
  linkedAt: number;
  verified: boolean;
}

export interface OffchainAlert {
  id: string;
  walletAddress: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: string;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  createdAt: number;
  triggeredAt?: number;
}

export interface Database {
  telegramLinks: TelegramLink[];
  offchainAlerts: OffchainAlert[];
}

export const DEFAULT_DB: Database = {
  telegramLinks: [],
  offchainAlerts: [],
};
