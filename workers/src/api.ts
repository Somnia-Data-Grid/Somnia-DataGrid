/**
 * Simple HTTP API for Workers
 * 
 * Provides endpoints for:
 * - Syncing Telegram links from frontend
 * - Alert CRUD (off-chain storage)
 * - Health checks
 * 
 * Run alongside the price publisher.
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { keccak256, stringToBytes } from "viem";
import { 
  upsertTelegramLink, 
  verifyTelegramLink, 
  deleteTelegramLink,
  getTelegramLink,
  getTelegramLinkByChatId,
  createOffchainAlert,
  getAlertsByWallet,
  getActiveAlerts,
  deleteAlert,
  type TelegramLink,
  type OffchainAlert,
} from "./db/client.js";

const API_PORT = parseInt(process.env.PORT || process.env.WORKERS_API_PORT || "3001", 10);
const API_SECRET = process.env.WORKERS_API_SECRET;

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function verifyAuth(req: IncomingMessage): boolean {
  if (!API_SECRET) return true; // No auth if secret not set
  const auth = req.headers.authorization;
  return auth === `Bearer ${API_SECRET}`;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${API_PORT}`);
  const path = url.pathname;
  const method = req.method || "GET";

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (path === "/health" && method === "GET") {
    return sendJson(res, 200, { status: "ok", timestamp: Date.now() });
  }

  // Auth required for other endpoints
  if (!verifyAuth(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  try {
    // Sync Telegram link
    if (path === "/api/telegram/sync" && method === "POST") {
      const body = await parseBody(req);
      const { walletAddress, telegramChatId, telegramUsername, linkedAt, verified } = body;

      if (!walletAddress || !telegramChatId) {
        return sendJson(res, 400, { error: "walletAddress and telegramChatId required" });
      }

      const link = upsertTelegramLink({
        wallet_address: walletAddress,
        telegram_chat_id: telegramChatId,
        telegram_username: telegramUsername,
        linked_at: linkedAt || Math.floor(Date.now() / 1000),
        verified: verified ? 1 : 0,
      });

      console.log(`[API] Synced Telegram link for ${walletAddress.slice(0, 10)}...`);
      return sendJson(res, 200, { success: true, link });
    }

    // Verify Telegram link
    if (path === "/api/telegram/verify" && method === "POST") {
      const body = await parseBody(req);
      const { walletAddress } = body;

      if (!walletAddress) {
        return sendJson(res, 400, { error: "walletAddress required" });
      }

      const verified = verifyTelegramLink(walletAddress);
      console.log(`[API] Verified Telegram link for ${walletAddress.slice(0, 10)}...: ${verified}`);
      return sendJson(res, 200, { success: true, verified });
    }

    // Delete Telegram link
    if (path === "/api/telegram/delete" && method === "POST") {
      const body = await parseBody(req);
      const { walletAddress } = body;

      if (!walletAddress) {
        return sendJson(res, 400, { error: "walletAddress required" });
      }

      const deleted = deleteTelegramLink(walletAddress);
      console.log(`[API] Deleted Telegram link for ${walletAddress.slice(0, 10)}...: ${deleted}`);
      return sendJson(res, 200, { success: true, deleted });
    }

    // Get Telegram link by wallet
    if (path === "/api/telegram/get" && method === "GET") {
      const walletAddress = url.searchParams.get("wallet");

      if (!walletAddress) {
        return sendJson(res, 400, { error: "wallet query param required" });
      }

      const link = getTelegramLink(walletAddress);
      return sendJson(res, 200, { success: true, link });
    }

    // Get Telegram link by chat ID (for bot commands)
    if (path === "/api/telegram/get-by-chat" && method === "GET") {
      const chatId = url.searchParams.get("chatId");

      if (!chatId) {
        return sendJson(res, 400, { error: "chatId query param required" });
      }

      const link = getTelegramLinkByChatId(chatId);
      return sendJson(res, 200, { success: true, link });
    }

    // ============ Alert Endpoints ============

    // Create alert (off-chain)
    if (path === "/api/alerts/create" && method === "POST") {
      const body = await parseBody(req);
      const { walletAddress, asset, condition, thresholdPrice } = body;

      if (!walletAddress || !asset || !condition || !thresholdPrice) {
        return sendJson(res, 400, { 
          error: "walletAddress, asset, condition, and thresholdPrice required" 
        });
      }

      if (!["ABOVE", "BELOW"].includes(condition)) {
        return sendJson(res, 400, { error: "condition must be ABOVE or BELOW" });
      }

      // Generate unique alert ID
      const alertKey = `${walletAddress}-${asset}-${Date.now()}`;
      const alertId = keccak256(stringToBytes(alertKey));

      const alert = createOffchainAlert({
        id: alertId,
        wallet_address: walletAddress,
        asset: asset.toUpperCase(),
        condition,
        threshold_price: thresholdPrice,
        status: "ACTIVE",
        created_at: Math.floor(Date.now() / 1000),
      });

      console.log(`[API] Created alert ${alertId.slice(0, 10)}... for ${walletAddress.slice(0, 10)}...`);
      return sendJson(res, 200, { success: true, alert });
    }

    // Get alerts by wallet
    if (path === "/api/alerts" && method === "GET") {
      const walletAddress = url.searchParams.get("wallet");

      if (!walletAddress) {
        return sendJson(res, 400, { error: "wallet query param required" });
      }

      const alerts = getAlertsByWallet(walletAddress);
      return sendJson(res, 200, { success: true, alerts });
    }

    // Get all active alerts (for internal use)
    if (path === "/api/alerts/active" && method === "GET") {
      const alerts = getActiveAlerts();
      return sendJson(res, 200, { success: true, alerts, count: alerts.length });
    }

    // Delete alert
    if (path === "/api/alerts/delete" && method === "POST") {
      const body = await parseBody(req);
      const { alertId } = body;

      if (!alertId) {
        return sendJson(res, 400, { error: "alertId required" });
      }

      const deleted = deleteAlert(alertId);
      console.log(`[API] Deleted alert ${alertId.slice(0, 10)}...: ${deleted}`);
      return sendJson(res, 200, { success: true, deleted });
    }

    // 404
    return sendJson(res, 404, { error: "Not found" });

  } catch (error) {
    console.error("[API] Error:", error);
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Internal error" });
  }
}

export function startApi() {
  const server = createServer(handleRequest);
  
  server.listen(API_PORT, () => {
    console.log(`[API] Workers API listening on port ${API_PORT}`);
  });

  return server;
}
