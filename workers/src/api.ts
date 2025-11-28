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
  getSqlite,
  upsertTelegramLink, 
  verifyTelegramLink, 
  deleteTelegramLink,
  getTelegramLink,
  getTelegramLinkByChatId,
  createOffchainAlert,
  getAlertsByWallet,
  getActiveAlerts,
  deleteAlert,
  addTrackedToken,
  removeTrackedToken,
  getTrackedTokens,
  createSentimentAlert,
  getSentimentAlertsByWallet,
  getActiveSentimentAlerts,
  deleteSentimentAlert,
  getFearGreed,
  getAllTokenSentiments,
  getRecentNews,
} from "./db/client.js";
import { searchTokens, getCoinGeckoId, fetchCoinList } from "./services/token-registry.js";
import { 
  initStreamRegistry,
  getActiveStreams,
  getActiveSymbols,
  isTokenSupported,
  requestToken,
  getStreamDocumentation,
  type StreamType,
} from "./services/stream-registry.js";

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
  
  // Accept both Authorization header and x-api-secret header
  const authHeader = req.headers.authorization;
  const apiSecretHeader = req.headers["x-api-secret"];
  
  if (authHeader === `Bearer ${API_SECRET}`) return true;
  if (apiSecretHeader === API_SECRET) return true;
  
  return false;
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

  // Health check - basic
  if (path === "/health" && method === "GET") {
    return sendJson(res, 200, { status: "ok", timestamp: Date.now() });
  }

  // Health check - detailed status
  if (path === "/api/health" && method === "GET") {
    try {
      const sqlite = getSqlite();
      
      // Check database
      const dbCheck = sqlite.prepare("SELECT 1").get();
      
      // Get counts
      const alertCount = (sqlite.prepare("SELECT COUNT(*) as count FROM offchain_alerts WHERE status = 'ACTIVE'").get() as any)?.count || 0;
      const sentimentAlertCount = (sqlite.prepare("SELECT COUNT(*) as count FROM sentiment_alerts WHERE status = 'ACTIVE'").get() as any)?.count || 0;
      const telegramLinks = (sqlite.prepare("SELECT COUNT(*) as count FROM telegram_links WHERE verified = 1").get() as any)?.count || 0;
      
      // Get latest data timestamps
      const latestPrice = (sqlite.prepare("SELECT MAX(timestamp) as ts FROM price_history").get() as any)?.ts;
      const latestFearGreed = getFearGreed();
      const latestSentiments = getAllTokenSentiments();
      const latestNews = getRecentNews(1);

      // Stream registry stats
      let streamCount = 0;
      try {
        streamCount = (sqlite.prepare("SELECT COUNT(*) as count FROM stream_registry WHERE is_active = 1").get() as any)?.count || 0;
      } catch {
        // Registry might not be initialized
      }

      const now = Math.floor(Date.now() / 1000);
      
      return sendJson(res, 200, {
        status: "ok",
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: "1.0.0",
        database: {
          connected: !!dbCheck,
          activeAlerts: alertCount,
          activeSentimentAlerts: sentimentAlertCount,
          verifiedTelegramLinks: telegramLinks,
          activeStreams: streamCount,
        },
        dataFreshness: {
          prices: latestPrice ? {
            lastUpdate: latestPrice,
            ageSeconds: now - latestPrice,
            stale: (now - latestPrice) > 120, // >2 min is stale
          } : null,
          fearGreed: latestFearGreed ? {
            lastUpdate: latestFearGreed.timestamp,
            ageSeconds: now - latestFearGreed.timestamp,
            score: latestFearGreed.score,
          } : null,
          sentiment: {
            tokenCount: latestSentiments.length,
            lastUpdate: latestSentiments[0]?.timestamp || null,
          },
          news: {
            latestTimestamp: latestNews[0]?.timestamp || null,
          },
        },
        services: {
          telegram: !!process.env.TELEGRAM_BOT_TOKEN,
          coingecko: !!(process.env.COINGECKO_API_KEY_1 || process.env.COINGECKO_API_KEY),
          cryptopanic: !!process.env.CRYPTOPANIC_API_KEY,
        },
      });
    } catch (error) {
      return sendJson(res, 500, {
        status: "error",
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Public endpoints (no auth required)
  const publicPaths = [
    "/api/health",
    "/api/sentiment",
    "/api/sentiment/fear-greed",
    "/api/sentiment/tokens", 
    "/api/sentiment/news",
    "/api/tokens/search",
    "/api/tokens/tracked",
    "/api/tokens/track",
    "/api/tokens/untrack",
    "/api/streams",
    "/api/streams/docs",
    "/api/streams/request",
    "/api/streams/check",
    "/api/streams/symbols",
  ];
  const isPublicEndpoint = publicPaths.some(p => path.startsWith(p));

  // Auth required for non-public endpoints
  if (!isPublicEndpoint && !verifyAuth(req)) {
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

    // ============ Token Search & Tracking ============

    // Search tokens (CoinGecko)
    if (path === "/api/tokens/search" && method === "GET") {
      const query = url.searchParams.get("q");
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);

      if (!query || query.length < 2) {
        return sendJson(res, 400, { error: "Query must be at least 2 characters" });
      }

      const results = await searchTokens(query, limit);
      return sendJson(res, 200, { success: true, tokens: results });
    }

    // Get tracked tokens
    if (path === "/api/tokens/tracked" && method === "GET") {
      const tokens = getTrackedTokens();
      return sendJson(res, 200, { success: true, tokens });
    }

    // Add tracked token
    if (path === "/api/tokens/track" && method === "POST") {
      const body = await parseBody(req);
      const { coinId, symbol, name, walletAddress } = body;

      if (!coinId || !symbol || !name) {
        return sendJson(res, 400, { error: "coinId, symbol, and name required" });
      }

      const token = addTrackedToken(coinId, symbol, name, walletAddress || "user");
      console.log(`[API] Added tracked token: ${symbol} (${coinId})`);
      return sendJson(res, 200, { success: true, token });
    }

    // Remove tracked token
    if (path === "/api/tokens/untrack" && method === "POST") {
      const body = await parseBody(req);
      const { coinId, wallet } = body;

      if (!coinId || !wallet) {
        return sendJson(res, 400, { error: "coinId and wallet required" });
      }

      const removed = removeTrackedToken(coinId, wallet);
      console.log(`[API] Removed tracked token: ${coinId} for ${wallet}: ${removed}`);
      return sendJson(res, 200, { success: true, removed });
    }

    // ============ Sentiment Alerts ============

    // Create sentiment alert
    if (path === "/api/sentiment-alerts/create" && method === "POST") {
      const body = await parseBody(req);
      const { walletAddress, coinId, symbol, alertType, threshold } = body;

      if (!walletAddress || !coinId || !symbol || !alertType || threshold === undefined) {
        return sendJson(res, 400, { 
          error: "walletAddress, coinId, symbol, alertType, and threshold required" 
        });
      }

      if (!["SENTIMENT_UP", "SENTIMENT_DOWN", "FEAR_GREED"].includes(alertType)) {
        return sendJson(res, 400, { error: "alertType must be SENTIMENT_UP, SENTIMENT_DOWN, or FEAR_GREED" });
      }

      const alertKey = `${walletAddress}-${coinId}-${alertType}-${Date.now()}`;
      const alertId = keccak256(stringToBytes(alertKey));

      const alert = createSentimentAlert({
        id: alertId,
        wallet_address: walletAddress,
        coin_id: coinId,
        symbol: symbol.toUpperCase(),
        alert_type: alertType,
        threshold,
        status: "ACTIVE",
        created_at: Math.floor(Date.now() / 1000),
      });

      console.log(`[API] Created sentiment alert ${alertId.slice(0, 10)}... for ${symbol}`);
      return sendJson(res, 200, { success: true, alert });
    }

    // Get sentiment alerts by wallet
    if (path === "/api/sentiment-alerts" && method === "GET") {
      const walletAddress = url.searchParams.get("wallet");

      if (!walletAddress) {
        return sendJson(res, 400, { error: "wallet query param required" });
      }

      const alerts = getSentimentAlertsByWallet(walletAddress);
      return sendJson(res, 200, { success: true, alerts });
    }

    // Get all active sentiment alerts
    if (path === "/api/sentiment-alerts/active" && method === "GET") {
      const alerts = getActiveSentimentAlerts();
      return sendJson(res, 200, { success: true, alerts, count: alerts.length });
    }

    // Delete sentiment alert
    if (path === "/api/sentiment-alerts/delete" && method === "POST") {
      const body = await parseBody(req);
      const { alertId } = body;

      if (!alertId) {
        return sendJson(res, 400, { error: "alertId required" });
      }

      const deleted = deleteSentimentAlert(alertId);
      console.log(`[API] Deleted sentiment alert ${alertId.slice(0, 10)}...: ${deleted}`);
      return sendJson(res, 200, { success: true, deleted });
    }

    // ============ Sentiment Data (cached) ============

    // Get cached Fear & Greed
    if (path === "/api/sentiment/fear-greed" && method === "GET") {
      const data = getFearGreed();
      return sendJson(res, 200, { success: true, data });
    }

    // Get all cached token sentiments
    if (path === "/api/sentiment/tokens" && method === "GET") {
      const data = getAllTokenSentiments();
      return sendJson(res, 200, { success: true, data });
    }

    // Get cached news
    if (path === "/api/sentiment/news" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const data = getRecentNews(Math.min(limit, 100));
      return sendJson(res, 200, { success: true, data });
    }

    // Get all sentiment data in one call (for initial load)
    if (path === "/api/sentiment" && method === "GET") {
      const fearGreed = getFearGreed();
      const sentiments = getAllTokenSentiments();
      const news = getRecentNews(20);
      return sendJson(res, 200, { 
        success: true, 
        fearGreed,
        sentiments,
        news,
      });
    }

    // ============ Stream Registry (DataGrid API) ============

    // Get all active streams
    if (path === "/api/streams" && method === "GET") {
      const type = url.searchParams.get("type") as StreamType | null;
      const streams = getActiveStreams(type || undefined);
      return sendJson(res, 200, { 
        success: true, 
        streams,
        count: streams.length,
      });
    }

    // Get stream documentation for developers
    if (path === "/api/streams/docs" && method === "GET") {
      const docs = getStreamDocumentation();
      return sendJson(res, 200, docs);
    }

    // Request a new token stream
    if (path === "/api/streams/request" && method === "POST") {
      const body = await parseBody(req);
      const { symbol, name, coingeckoId, diaKey, type = "PRICE" } = body;

      if (!symbol || !name) {
        return sendJson(res, 400, { error: "symbol and name required" });
      }

      // Validate type
      if (!["PRICE", "SENTIMENT"].includes(type)) {
        return sendJson(res, 400, { error: "type must be PRICE or SENTIMENT" });
      }

      const result = requestToken({
        symbol,
        name,
        coingeckoId,
        diaKey,
      }, type as StreamType);

      return sendJson(res, result.success ? 200 : 400, result);
    }

    // Check if a token is supported
    if (path === "/api/streams/check" && method === "GET") {
      const symbol = url.searchParams.get("symbol");
      const type = (url.searchParams.get("type") || "PRICE") as StreamType;

      if (!symbol) {
        return sendJson(res, 400, { error: "symbol required" });
      }

      const supported = isTokenSupported(symbol, type);
      return sendJson(res, 200, { 
        success: true, 
        symbol: symbol.toUpperCase(),
        type,
        supported,
      });
    }

    // Get active symbols for a stream type
    if (path === "/api/streams/symbols" && method === "GET") {
      const type = (url.searchParams.get("type") || "PRICE") as StreamType;
      const symbols = getActiveSymbols(type);
      return sendJson(res, 200, { 
        success: true, 
        type,
        symbols,
        count: symbols.length,
      });
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
