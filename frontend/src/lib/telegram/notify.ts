/**
 * Telegram Notification Service
 * 
 * Sends alert notifications to users who have linked their Telegram.
 * Checks both in-memory and Workers API (persistent) storage.
 */

import { getTelegramLink, createTelegramLink } from "../db/client";
import { formatPrice } from "../schemas";
import type { TelegramLink } from "../db/schema";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = "https://api.telegram.org/bot";
const WORKERS_API_URL = process.env.WORKERS_API_URL;
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

interface AlertNotificationParams {
  walletAddress: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: bigint;
  currentPrice: bigint;
  decimals: number;
}

// Fetch from Workers API (persistent storage)
async function fetchFromWorkers(walletAddress: string): Promise<TelegramLink | null> {
  if (!WORKERS_API_URL) return null;
  
  try {
    const headers: Record<string, string> = {};
    if (WORKERS_API_SECRET) {
      headers["Authorization"] = `Bearer ${WORKERS_API_SECRET}`;
    }
    
    const response = await fetch(`${WORKERS_API_URL}/api/telegram/get?wallet=${walletAddress}`, {
      headers,
      cache: "no-store",
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.link) {
      return {
        walletAddress: data.link.wallet_address,
        telegramChatId: data.link.telegram_chat_id,
        telegramUsername: data.link.telegram_username,
        linkedAt: data.link.linked_at,
        verified: Boolean(data.link.verified),
      };
    }
    return null;
  } catch (error) {
    console.warn("[Telegram] Failed to fetch from workers:", error);
    return null;
  }
}

// Get link - try memory first, then workers (persistent)
async function getVerifiedLink(walletAddress: string): Promise<TelegramLink | null> {
  // Try in-memory first (fast)
  let link = getTelegramLink(walletAddress);
  if (link?.verified) return link;
  
  // Try workers (persistent storage)
  link = await fetchFromWorkers(walletAddress);
  if (link?.verified) {
    // Cache in memory for future requests
    createTelegramLink(link);
    return link;
  }
  
  return null;
}

/**
 * Send a Telegram message to a chat
 */
async function sendTelegramMessage(chatId: string, text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] Bot token not configured, skipping notification");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Telegram] Failed to send message:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Telegram] Error sending message:", error);
    return false;
  }
}

/**
 * Send an alert notification to a user's linked Telegram
 */
export async function sendAlertNotification(params: AlertNotificationParams): Promise<boolean> {
  const { walletAddress, asset, condition, thresholdPrice, currentPrice, decimals } = params;

  // Find the user's verified Telegram link (checks memory + workers)
  const link = await getVerifiedLink(walletAddress);
  if (!link) {
    console.log(`[Telegram] No verified Telegram link for ${walletAddress}`);
    return false;
  }

  const thresholdFormatted = formatPrice(thresholdPrice, decimals, 2);
  const currentFormatted = formatPrice(currentPrice, decimals, 2);
  const conditionText = condition === "ABOVE" ? "above" : "below";

  const message = `
🔔 <b>Price Alert Triggered!</b>

<b>Asset:</b> ${asset}
<b>Condition:</b> Price went ${conditionText} ${thresholdFormatted}
<b>Current Price:</b> ${currentFormatted}
<b>Time:</b> ${new Date().toUTCString()}

<i>Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</i>
`.trim();

  return sendTelegramMessage(link.telegramChatId, message);
}

/**
 * Send a welcome message when user links their Telegram
 */
export async function sendWelcomeMessage(chatId: string, walletAddress: string): Promise<boolean> {
  const message = `
🎉 <b>Welcome to Somnia DeFi Tracker!</b>

Your Telegram is now linked to wallet:
<code>${walletAddress}</code>

You'll receive notifications here when your price alerts are triggered.

<b>Commands:</b>
/alerts - View your active alerts
/unlink - Unlink this Telegram from your wallet
/help - Show help message
`.trim();

  return sendTelegramMessage(chatId, message);
}

/**
 * Send a test notification
 */
export async function sendTestNotification(chatId: string): Promise<boolean> {
  const message = `
🧪 <b>Test Notification</b>

This is a test notification from Somnia DeFi Tracker.
If you see this, your Telegram notifications are working!
`.trim();

  return sendTelegramMessage(chatId, message);
}
