/**
 * Generate Telegram Deep Link for Wallet Linking
 * 
 * Returns a t.me link that opens the bot with the wallet address as start parameter.
 * Checks both in-memory and Workers API (persistent) storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTelegramLink, deleteTelegramLink, createTelegramLink } from "@/lib/db/client";
import type { TelegramLink } from "@/lib/db/schema";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "SomniaDeFiBot";
const WORKERS_API_URL = process.env.WORKERS_API_URL;
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

// Fetch from Workers API (persistent storage)
async function fetchFromWorkers(walletAddress: string): Promise<TelegramLink | null> {
  if (!WORKERS_API_URL) {
    console.log("[Telegram/Link] WORKERS_API_URL not configured");
    return null;
  }
  
  try {
    const headers: Record<string, string> = {};
    if (WORKERS_API_SECRET) {
      headers["Authorization"] = `Bearer ${WORKERS_API_SECRET}`;
    }
    
    const url = `${WORKERS_API_URL}/api/telegram/get?wallet=${walletAddress}`;
    console.log(`[Telegram/Link] Fetching from workers: ${url}`);
    
    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });
    
    if (!response.ok) {
      console.log(`[Telegram/Link] Workers returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[Telegram/Link] Workers response:`, JSON.stringify(data));
    
    if (data.success && data.link) {
      // SQLite returns verified as 0/1, convert to boolean
      const verified = data.link.verified === 1 || data.link.verified === true;
      console.log(`[Telegram/Link] Link found, verified=${verified} (raw: ${data.link.verified})`);
      
      return {
        walletAddress: data.link.wallet_address,
        telegramChatId: data.link.telegram_chat_id,
        telegramUsername: data.link.telegram_username,
        linkedAt: data.link.linked_at,
        verified,
      };
    }
    return null;
  } catch (error) {
    console.error("[Telegram/Link] Failed to fetch from workers:", error);
    return null;
  }
}

// Sync deletion to Workers
async function syncDeleteToWorkers(walletAddress: string): Promise<boolean> {
  if (!WORKERS_API_URL) return false;
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (WORKERS_API_SECRET) {
      headers["Authorization"] = `Bearer ${WORKERS_API_SECRET}`;
    }
    
    const response = await fetch(`${WORKERS_API_URL}/api/telegram/delete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ walletAddress }),
    });
    
    return response.ok;
  } catch (error) {
    console.warn("[Telegram] Failed to sync delete to workers:", error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const walletAddress = params.get("wallet");

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: "Valid wallet address required" },
        { status: 400 }
      );
    }

    console.log(`[Telegram/Link] Checking status for ${walletAddress.slice(0, 10)}...`);

    // Check in-memory first
    let existingLink = getTelegramLink(walletAddress);
    console.log(`[Telegram/Link] Memory check: ${existingLink ? `found, verified=${existingLink.verified}` : "not found"}`);
    
    // If not in memory OR not verified, check Workers API (persistent)
    // This handles the case where webhook updated Workers but memory is stale
    if (!existingLink || !existingLink.verified) {
      const workersLink = await fetchFromWorkers(walletAddress);
      if (workersLink) {
        // Update memory cache with latest from workers
        createTelegramLink(workersLink);
        existingLink = workersLink;
        console.log(`[Telegram/Link] Updated from workers, verified=${existingLink.verified}`);
      }
    }
    
    if (existingLink?.verified) {
      console.log(`[Telegram/Link] Returning linked=true for ${walletAddress.slice(0, 10)}...`);
      return NextResponse.json({
        success: true,
        linked: true,
        telegramUsername: existingLink.telegramUsername,
      });
    }

    // Generate deep link
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${walletAddress}`;
    console.log(`[Telegram/Link] Returning linked=false for ${walletAddress.slice(0, 10)}...`);

    return NextResponse.json({
      success: true,
      linked: false,
      deepLink,
      botUsername: BOT_USERNAME,
    });
  } catch (error) {
    console.error("[API] Telegram link error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate link" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const walletAddress = params.get("wallet");

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address required" },
        { status: 400 }
      );
    }

    // Delete from memory
    const deleted = deleteTelegramLink(walletAddress);
    
    // Also delete from Workers (persistent)
    await syncDeleteToWorkers(walletAddress);

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[API] Telegram unlink error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to unlink" },
      { status: 500 }
    );
  }
}
