/**
 * Telegram Notification Service
 * 
 * Sends alert notifications to users who have linked their Telegram.
 */

import { getTelegramLink, logNotification } from "../db/client.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = "https://api.telegram.org/bot";

interface AlertNotificationParams {
  alertId: string;
  walletAddress: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: string;
  currentPrice: string;
  decimals: number;
}

function formatPrice(priceStr: string, decimals: number): string {
  const price = BigInt(priceStr);
  const divisor = BigInt(10 ** decimals);
  const whole = price / divisor;
  const fraction = (price % divisor).toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${fraction}`;
}

/**
 * Send a Telegram message to a chat
 */
async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<boolean> {
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
  const { alertId, walletAddress, asset, condition, thresholdPrice, currentPrice, decimals } = params;

  // Find the user's Telegram link
  const link = getTelegramLink(walletAddress);
  if (!link || !link.verified) {
    console.log(`[Telegram] No verified Telegram link for ${walletAddress.slice(0, 10)}...`);
    logNotification(alertId, walletAddress, null, "alert", "failed", "No verified Telegram link");
    return false;
  }

  const thresholdFormatted = formatPrice(thresholdPrice, decimals);
  const currentFormatted = formatPrice(currentPrice, decimals);
  const conditionText = condition === "ABOVE" ? "above" : "below";

  const message = `
🔔 <b>Price Alert Triggered!</b>

<b>Asset:</b> ${asset}
<b>Condition:</b> Price went ${conditionText} $${thresholdFormatted}
<b>Current Price:</b> $${currentFormatted}
<b>Time:</b> ${new Date().toUTCString()}

<i>Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</i>
`.trim();

  const success = await sendTelegramMessage(link.telegramChatId, message);
  
  logNotification(
    alertId,
    walletAddress,
    link.telegramChatId,
    "alert",
    success ? "success" : "failed",
    success ? undefined : "Failed to send message"
  );

  if (success) {
    console.log(`[Telegram] ✅ Alert notification sent for ${asset} to ${link.telegramUsername || link.telegramChatId}`);
  }

  return success;
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

// ============ Sentiment Alert Notifications ============

interface SentimentAlertParams {
  alertId: string;
  walletAddress: string;
  symbol: string;
  alertType: "SENTIMENT_UP" | "SENTIMENT_DOWN" | "FEAR_GREED";
  threshold: number;
  currentValue: number;
}

/**
 * Send a sentiment alert notification to a user's linked Telegram
 */
export async function sendSentimentAlertNotification(params: SentimentAlertParams): Promise<boolean> {
  const { alertId, walletAddress, symbol, alertType, threshold, currentValue } = params;

  const link = getTelegramLink(walletAddress);
  if (!link || !link.verified) {
    console.log(`[Telegram] No verified Telegram link for ${walletAddress.slice(0, 10)}...`);
    logNotification(alertId, walletAddress, null, "sentiment_alert", "failed", "No verified Telegram link");
    return false;
  }

  let emoji: string;
  let title: string;
  let description: string;

  switch (alertType) {
    case "SENTIMENT_UP":
      emoji = "📈";
      title = "Bullish Sentiment Alert!";
      description = `${symbol} sentiment has risen above ${threshold}%`;
      break;
    case "SENTIMENT_DOWN":
      emoji = "📉";
      title = "Bearish Sentiment Alert!";
      description = `${symbol} sentiment has dropped below ${threshold}%`;
      break;
    case "FEAR_GREED":
      emoji = currentValue >= 50 ? "🟢" : "🔴";
      title = "Fear & Greed Alert!";
      description = currentValue >= threshold 
        ? `Market sentiment has risen to ${currentValue} (Greed zone)`
        : `Market sentiment has dropped to ${currentValue} (Fear zone)`;
      break;
    default:
      emoji = "📊";
      title = "Sentiment Alert!";
      description = `${symbol} sentiment threshold reached`;
  }

  const message = `
${emoji} <b>${title}</b>

<b>Asset:</b> ${symbol}
<b>Alert Type:</b> ${alertType.replace("_", " ")}
<b>Threshold:</b> ${threshold}${alertType === "FEAR_GREED" ? "" : "%"}
<b>Current Value:</b> ${currentValue}${alertType === "FEAR_GREED" ? "" : "%"}
<b>Time:</b> ${new Date().toUTCString()}

<i>${description}</i>

<i>Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</i>
`.trim();

  const success = await sendTelegramMessage(link.telegramChatId, message);
  
  logNotification(
    alertId,
    walletAddress,
    link.telegramChatId,
    "sentiment_alert",
    success ? "success" : "failed",
    success ? undefined : "Failed to send message"
  );

  if (success) {
    console.log(`[Telegram] ✅ Sentiment alert sent for ${symbol} to ${link.telegramUsername || link.telegramChatId}`);
  }

  return success;
}
