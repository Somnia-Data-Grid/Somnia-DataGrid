/**
 * Telegram Polling Endpoint (for local development)
 * 
 * Since Telegram webhooks can't reach localhost, this endpoint
 * polls Telegram for updates and processes them locally.
 * 
 * Usage: Call GET /api/telegram/poll periodically during development
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createTelegramLink,
  getTelegramLink,
  verifyTelegramLink,
} from "@/lib/db/client";
import { sendWelcomeMessage } from "@/lib/telegram/notify";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const WORKERS_API_URL = process.env.WORKERS_API_URL;
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

// Track last update ID to avoid processing duplicates
let lastUpdateId = 0;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

async function syncToWorkers(data: {
  walletAddress: string;
  telegramChatId: string;
  telegramUsername?: string;
  linkedAt: number;
  verified: boolean;
}): Promise<boolean> {
  if (!WORKERS_API_URL) return false;
  
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (WORKERS_API_SECRET) {
      headers["Authorization"] = `Bearer ${WORKERS_API_SECRET}`;
    }
    
    const response = await fetch(`${WORKERS_API_URL}/api/telegram/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

async function sendMessage(chatId: number, text: string, replyMarkup?: object) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function processUpdate(update: TelegramUpdate) {
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const { callback_query } = update;
    const chatId = callback_query.message?.chat.id;
    const data = callback_query.data;
    const username = callback_query.from.username;

    if (chatId && data?.startsWith("confirm_link:")) {
      const walletAddress = data.replace("confirm_link:", "");
      const linkedAt = Math.floor(Date.now() / 1000);
      
      // Create/update link
      let link = getTelegramLink(walletAddress);
      if (!link) {
        createTelegramLink({
          walletAddress,
          telegramChatId: String(chatId),
          telegramUsername: username,
          linkedAt,
          verified: false,
        });
      }
      
      // Verify
      verifyTelegramLink(walletAddress);
      
      // Sync to workers
      await syncToWorkers({
        walletAddress,
        telegramChatId: String(chatId),
        telegramUsername: username,
        linkedAt,
        verified: true,
      });
      
      await answerCallbackQuery(callback_query.id, "✅ Wallet linked!");
      await sendWelcomeMessage(String(chatId), walletAddress);
      
      console.log(`[Poll] Confirmed link for ${walletAddress.slice(0, 10)}...`);
      return { action: "confirmed", walletAddress };
    }
    
    if (data === "cancel_link") {
      await answerCallbackQuery(callback_query.id, "Cancelled");
      if (chatId) {
        await sendMessage(chatId, "❌ Linking cancelled.");
      }
      return { action: "cancelled" };
    }
  }

  // Handle /start command
  if (update.message?.text) {
    const { message } = update;
    const chatId = message.chat.id;
    const text = message.text!;
    const username = message.from.username;

    const parts = text.split(" ");
    const command = parts[0].split("@")[0].toLowerCase();
    const param = parts.slice(1).join(" ");

    if (command === "/start" && param.startsWith("0x") && param.length === 42) {
      const walletAddress = param;
      const linkedAt = Math.floor(Date.now() / 1000);
      
      // Create pending link
      createTelegramLink({
        walletAddress,
        telegramChatId: String(chatId),
        telegramUsername: username,
        linkedAt,
        verified: false,
      });
      
      // Sync to workers (unverified)
      await syncToWorkers({
        walletAddress,
        telegramChatId: String(chatId),
        telegramUsername: username,
        linkedAt,
        verified: false,
      });
      
      await sendMessage(
        chatId,
        `🔗 <b>Link Your Wallet</b>\n\nWallet: <code>${walletAddress}</code>\n\nClick the button below to confirm.`,
        {
          inline_keyboard: [
            [{ text: "✅ Confirm Link", callback_data: `confirm_link:${walletAddress}` }],
            [{ text: "❌ Cancel", callback_data: "cancel_link" }],
          ],
        }
      );
      
      console.log(`[Poll] Start link for ${walletAddress.slice(0, 10)}...`);
      return { action: "started", walletAddress };
    }
  }

  return { action: "ignored" };
}

export async function GET(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  try {
    // Get updates from Telegram
    const response = await fetch(
      `${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=0&allowed_updates=["message","callback_query"]`
    );
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: "Telegram API error", details: error }, { status: 500 });
    }

    const data = await response.json();
    const updates: TelegramUpdate[] = data.result || [];
    
    const results = [];
    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const result = await processUpdate(update);
      results.push({ update_id: update.update_id, ...result });
    }

    return NextResponse.json({
      success: true,
      processed: updates.length,
      lastUpdateId,
      results,
    });
  } catch (error) {
    console.error("[Poll] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
