/**
 * Alert Service (Frontend)
 * 
 * Alerts are now stored off-chain in Workers SQLite for fast CRUD.
 * This service provides helper functions for the frontend.
 * 
 * Alert triggers still emit events on-chain via Workers for WebSocket notifications.
 */

import type { AlertData } from "../schemas";

export interface OffchainAlert {
  id: string;
  wallet_address: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  threshold_price: string;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  created_at: number;
  triggered_at?: number;
  notified_at?: number;
}

/**
 * Create a new alert (via Workers API)
 */
export async function createAlert({
  userAddress,
  asset,
  condition,
  thresholdPrice,
}: {
  userAddress: string;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: bigint | string;
}): Promise<{ alertId: string; alert: OffchainAlert }> {
  const response = await fetch("/api/alerts/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userAddress,
      asset,
      condition,
      thresholdPrice: thresholdPrice.toString(),
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to create alert");
  }

  return {
    alertId: data.alertId,
    alert: data.alert,
  };
}

/**
 * Get all alerts for a wallet address
 */
export async function getAlertsByWallet(walletAddress: string): Promise<OffchainAlert[]> {
  const response = await fetch(`/api/alerts?wallet=${encodeURIComponent(walletAddress)}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch alerts");
  }

  return data.alerts || [];
}

/**
 * Get active alerts for a wallet
 */
export async function getActiveAlerts(walletAddress: string): Promise<OffchainAlert[]> {
  const alerts = await getAlertsByWallet(walletAddress);
  return alerts.filter((a) => a.status === "ACTIVE");
}

/**
 * Delete an alert
 */
export async function deleteAlert(alertId: string): Promise<boolean> {
  const response = await fetch("/api/alerts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to delete alert");
  }

  return data.deleted;
}

/**
 * Convert OffchainAlert to AlertData format (for compatibility)
 */
export function toAlertData(alert: OffchainAlert): AlertData {
  return {
    alertId: alert.id as `0x${string}`,
    userAddress: alert.wallet_address as `0x${string}`,
    asset: alert.asset,
    condition: alert.condition,
    thresholdPrice: BigInt(alert.threshold_price),
    status: alert.status,
    createdAt: BigInt(alert.created_at),
    triggeredAt: BigInt(alert.triggered_at || 0),
  };
}
