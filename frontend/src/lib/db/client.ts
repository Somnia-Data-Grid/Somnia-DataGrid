/**
 * In-Memory Database Client for Next.js
 * 
 * Simple in-memory storage for:
 * - Telegram wallet links (temporary, for webhook handling)
 * - Off-chain alerts cache
 * 
 * This is intentionally lightweight - all heavy lifting is done by Workers service.
 * Perfect for serverless (Vercel) and VPS deployments.
 */

import type { TelegramLink, OffchainAlert } from "./schema";

// In-memory store
const memoryStore = {
  telegramLinks: new Map<string, TelegramLink>(),
  offchainAlerts: new Map<string, OffchainAlert>(),
};

// ============ Telegram Links ============

export function getTelegramLink(walletAddress: string): TelegramLink | null {
  return memoryStore.telegramLinks.get(walletAddress.toLowerCase()) ?? null;
}

export function getTelegramLinkByChatId(chatId: string): TelegramLink | null {
  for (const link of memoryStore.telegramLinks.values()) {
    if (link.telegramChatId === chatId) return link;
  }
  return null;
}

export function createTelegramLink(link: TelegramLink): TelegramLink {
  memoryStore.telegramLinks.set(link.walletAddress.toLowerCase(), link);
  return link;
}

export function verifyTelegramLink(walletAddress: string): boolean {
  const link = memoryStore.telegramLinks.get(walletAddress.toLowerCase());
  if (link) {
    link.verified = true;
    return true;
  }
  return false;
}

export function deleteTelegramLink(walletAddress: string): boolean {
  return memoryStore.telegramLinks.delete(walletAddress.toLowerCase());
}

// ============ Off-chain Alerts ============

export function getOffchainAlerts(walletAddress?: string): OffchainAlert[] {
  const alerts = Array.from(memoryStore.offchainAlerts.values());
  if (walletAddress) {
    return alerts.filter(
      (a) => a.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  }
  return alerts;
}

export function getActiveOffchainAlerts(): OffchainAlert[] {
  return Array.from(memoryStore.offchainAlerts.values()).filter(
    (a) => a.status === "ACTIVE"
  );
}

export function createOffchainAlert(alert: OffchainAlert): OffchainAlert {
  memoryStore.offchainAlerts.set(alert.id, alert);
  return alert;
}

export function triggerOffchainAlert(alertId: string): OffchainAlert | null {
  const alert = memoryStore.offchainAlerts.get(alertId);
  if (alert) {
    alert.status = "TRIGGERED";
    alert.triggeredAt = Math.floor(Date.now() / 1000);
    return alert;
  }
  return null;
}

export function deleteOffchainAlert(alertId: string): boolean {
  return memoryStore.offchainAlerts.delete(alertId);
}
