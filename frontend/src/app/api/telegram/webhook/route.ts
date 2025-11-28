/**
 * Telegram Bot Webhook Handler
 * 
 * Receives updates from Telegram and processes bot commands.
 * Uses Workers API as primary storage (persistent SQLite).
 * Falls back to in-memory for quick access.
 * 
 * Setup:
 * 1. Create bot via @BotFather
 * 2. Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/telegram/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createTelegramLink,
  getTelegramLinkByChatId,
  deleteTelegramLink,
  verifyTelegramLink,
  getTelegramLink,
} from "@/lib/db/client";
import { sendWelcomeMessage, sendTestNotification } from "@/lib/telegram/notify";
import { formatPrice } from "@/lib/schemas";
import { getActiveAlerts } from "@/lib/services/alertService";
import type { TelegramLink } from "@/lib/db/schema";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Workers API for persistent storage
const WORKERS_API_URL = process.env.WORKERS_API_URL;
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

// Telegram Update types
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    message?: {
      chat: {
        id: number;
      };
    };
    data?: string;
  };
}


// Fetch Telegram link from Workers (persistent storage)
async function fetchFromWorkers(chatId: string): Promise<TelegramLink | null> {
  if (!WORKERS_API_URL) return null;
  
  try {
    const headers: Record<string, string> = {};
    if (WORKERS_API_SECRET) {
      headers["Authorization"] = `Bearer ${WORKERS_API_SECRET}`;
    }
    
    const response = await fetch(`${WORKERS_API_URL}/api/telegram/get-by-chat?chatId=${chatId}`, {
      headers,
      cache: "no-store",
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.link) {
      // Convert snake_case to camelCase
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

// Sync link to Workers (persistent storage)
async function syncToWorkers(
  action: "sync" | "delete",
  data: { walletAddress: string; telegramChatId?: string; telegramUsername?: string; linkedAt?: number; verified?: boolean }
): Promise<boolean> {
  if (!WORKERS_API_URL) return false;
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (WORKERS_API_SECRET) {
      headers["Authorization"] = `Bearer ${WORKERS_API_SECRET}`;
    }
    
    const endpoint = action === "delete" 
      ? `${WORKERS_API_URL}/api/telegram/delete`
      : `${WORKERS_API_URL}/api/telegram/sync`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    
    return response.ok;
  } catch (error) {
    console.warn(`[Telegram] Failed to ${action} to workers:`, error);
    return false;
  }
}

// Get link - try memory first, then workers (persistent)
async function getLink(chatId: string): Promise<TelegramLink | null> {
  // Try in-memory first (fast)
  let link = getTelegramLinkByChatId(chatId);
  if (link) return link;
  
  // Try workers (persistent storage)
  link = await fetchFromWorkers(chatId);
  if (link) {
    // Cache in memory for future requests
    createTelegramLink(link);
  }
  return link;
}


async function sendMessage(chatId: number | string, text: string, replyMarkup?: object) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[Telegram] Failed to send message:", error);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

async function handleStart(chatId: number, username: string | undefined, startParam?: string) {
  console.log(`[Telegram] /start from ${chatId}, param: ${startParam}`);
  
  // startParam contains the wallet address from deep link
  if (startParam && startParam.startsWith("0x") && startParam.length === 42) {
    const walletAddress = startParam;
    const linkedAt = Math.floor(Date.now() / 1000);
    
    // Create pending link in memory
    createTelegramLink({
      walletAddress,
      telegramChatId: String(chatId),
      telegramUsername: username,
      linkedAt,
      verified: false,
    });

    // Sync to workers (for persistent storage)
    await syncToWorkers("sync", {
      walletAddress,
      telegramChatId: String(chatId),
      telegramUsername: username,
      linkedAt,
      verified: false,
    });

    await sendMessage(
      chatId,
      `🔗 <b>Link Your Wallet</b>\n\nWallet: <code>${walletAddress}</code>\n\nClick the button below to confirm linking this Telegram to your wallet.`,
      {
        inline_keyboard: [
          [{ text: "✅ Confirm Link", callback_data: `confirm_link:${walletAddress}` }],
          [{ text: "❌ Cancel", callback_data: "cancel_link" }],
        ],
      }
    );
  } else {
    await sendMessage(
      chatId,
      `👋 <b>Welcome to Somnia DeFi Tracker Bot!</b>\n\nTo link your wallet and receive price alerts:\n\n1. Go to the dashboard\n2. Connect your wallet\n3. Click "Link Telegram"\n\nOr use /help for more commands.`
    );
  }
}

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    `📚 <b>Available Commands</b>\n\n/start - Start the bot\n/alerts - View your active alerts\n/test - Send a test notification\n/unlink - Unlink your wallet\n/help - Show this message\n\n<b>How it works:</b>\n1. Connect wallet on the dashboard\n2. Link your Telegram\n3. Create price alerts\n4. Get notified here when alerts trigger!`
  );
}


async function handleAlerts(chatId: number) {
  // Use getLink which checks both memory AND workers (persistent)
  const link = await getLink(String(chatId));
  
  if (!link) {
    await sendMessage(chatId, "❌ No wallet linked. Visit the dashboard to link your wallet first.");
    return;
  }

  if (!link.verified) {
    await sendMessage(chatId, "⚠️ Your wallet link is pending verification. Please confirm the link first.");
    return;
  }

  try {
    // Get alerts for this wallet
    const userAlerts = await getActiveAlerts(link.walletAddress);

    if (userAlerts.length === 0) {
      await sendMessage(chatId, `📭 You have no active alerts.\n\nWallet: <code>${link.walletAddress.slice(0, 10)}...</code>\n\nCreate alerts on the dashboard to get notified here!`);
      return;
    }

    const alertList = userAlerts
      .map((a, i) => {
        const threshold = formatPrice(BigInt(a.threshold_price), 8, 2);
        return `${i + 1}. <b>${a.asset}</b> ${a.condition} ${threshold}`;
      })
      .join("\n");

    await sendMessage(chatId, `📋 <b>Your Active Alerts</b>\n\nWallet: <code>${link.walletAddress.slice(0, 10)}...</code>\n\n${alertList}`);
  } catch (error) {
    console.error("[Telegram] Failed to fetch alerts:", error);
    await sendMessage(chatId, "❌ Failed to fetch alerts. Please try again later.");
  }
}

async function handleTest(chatId: number) {
  const link = await getLink(String(chatId));
  
  if (!link || !link.verified) {
    await sendMessage(chatId, "❌ Please link and verify your wallet first.");
    return;
  }

  await sendTestNotification(String(chatId));
}

async function handleUnlink(chatId: number) {
  const link = await getLink(String(chatId));
  
  if (!link) {
    await sendMessage(chatId, "❌ No wallet is linked to this Telegram.");
    return;
  }

  deleteTelegramLink(link.walletAddress);
  
  // Sync deletion to workers
  await syncToWorkers("delete", { walletAddress: link.walletAddress });
  
  await sendMessage(chatId, "✅ Your wallet has been unlinked. You will no longer receive alerts here.");
}


async function handleCallbackQuery(callbackQuery: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  const username = callbackQuery.from.username;

  console.log(`[Telegram] Callback query: ${data} from chat ${chatId}`);

  if (!chatId || !data) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("confirm_link:")) {
    const walletAddress = data.replace("confirm_link:", "");
    
    // Check if link exists (might have been created in /start)
    let link = getTelegramLink(walletAddress);
    
    if (!link) {
      // Create it now if it doesn't exist
      const linkedAt = Math.floor(Date.now() / 1000);
      createTelegramLink({
        walletAddress,
        telegramChatId: String(chatId),
        telegramUsername: username,
        linkedAt,
        verified: false,
      });
    }
    
    // Verify the link in memory
    const verified = verifyTelegramLink(walletAddress);
    console.log(`[Telegram] Verify result for ${walletAddress}: ${verified}`);
    
    // Always sync to workers with verified=true
    await syncToWorkers("sync", {
      walletAddress,
      telegramChatId: String(chatId),
      telegramUsername: username,
      linkedAt: Math.floor(Date.now() / 1000),
      verified: true,
    });
    
    await answerCallbackQuery(callbackQuery.id, "✅ Wallet linked!");
    await sendWelcomeMessage(String(chatId), walletAddress);
    
  } else if (data === "cancel_link") {
    await answerCallbackQuery(callbackQuery.id, "Cancelled");
    await sendMessage(chatId, "❌ Linking cancelled. You can try again from the dashboard.");
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      console.warn("[Telegram] Invalid webhook secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();
    console.log("[Telegram] Received update:", JSON.stringify(update, null, 2));

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Handle messages
    const message = update.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text;
    const username = message.from.username;

    // Parse command - handle both "/start param" and "/start@botname param"
    const parts = text.split(" ");
    const commandPart = parts[0].split("@")[0]; // Remove @botname if present
    const startParam = parts.slice(1).join(" ");

    console.log(`[Telegram] Command: ${commandPart}, param: ${startParam}`);

    switch (commandPart.toLowerCase()) {
      case "/start":
        await handleStart(chatId, username, startParam);
        break;
      case "/help":
        await handleHelp(chatId);
        break;
      case "/alerts":
        await handleAlerts(chatId);
        break;
      case "/test":
        await handleTest(chatId);
        break;
      case "/unlink":
        await handleUnlink(chatId);
        break;
      default:
        // Ignore unknown commands
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram] Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ 
    status: "Telegram webhook endpoint active",
    botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
    workersApiConfigured: Boolean(WORKERS_API_URL),
  });
}
