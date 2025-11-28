/**
 * Sentiment Alert Checker Service
 *
 * Checks sentiment alerts against current sentiment data and triggers notifications.
 * Supports:
 * - SENTIMENT_UP: Alert when bullish sentiment exceeds threshold
 * - SENTIMENT_DOWN: Alert when bearish sentiment exceeds threshold  
 * - FEAR_GREED: Alert when Fear & Greed index crosses threshold
 */

import {
  getActiveSentimentAlerts,
  triggerSentimentAlert,
  markSentimentAlertNotified,
  getFearGreed,
  getTokenSentiment,
  logNotification,
  type SentimentAlert,
} from "../db/client.js";
import { sendSentimentAlertNotification } from "./telegram.js";

// Track triggered alerts to avoid duplicates in session
const triggeredSentimentAlertIds = new Set<string>();

/**
 * Check all active sentiment alerts and trigger if conditions met
 */
export async function checkSentimentAlerts(): Promise<string[]> {
  const alerts = getActiveSentimentAlerts();
  const triggered: string[] = [];

  for (const alert of alerts) {
    if (triggeredSentimentAlertIds.has(alert.id)) continue;

    const shouldTrigger = await evaluateAlert(alert);
    
    if (shouldTrigger.trigger) {
      console.log(`[SentimentChecker] 🔔 Alert triggered: ${alert.symbol} ${alert.alert_type} (threshold: ${alert.threshold}, current: ${shouldTrigger.currentValue})`);

      triggeredSentimentAlertIds.add(alert.id);
      triggered.push(alert.id);

      // Update status in DB
      const updated = triggerSentimentAlert(alert.id);
      if (!updated) {
        console.error(`[SentimentChecker] Failed to update alert status`);
        continue;
      }

      // Send Telegram notification
      sendSentimentAlertNotification({
        alertId: alert.id,
        walletAddress: alert.wallet_address,
        symbol: alert.symbol,
        alertType: alert.alert_type,
        threshold: alert.threshold,
        currentValue: shouldTrigger.currentValue,
      }).then(sent => {
        if (sent) {
          markSentimentAlertNotified(alert.id);
          console.log(`[SentimentChecker] ✅ Notification sent for ${alert.id.slice(0, 10)}...`);
        }
      }).catch(error => {
        console.error(`[SentimentChecker] Failed to send notification:`, error);
        logNotification(
          alert.id,
          alert.wallet_address,
          null,
          "sentiment_alert",
          "failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      });
    }
  }

  return triggered;
}

interface EvaluationResult {
  trigger: boolean;
  currentValue: number;
}

async function evaluateAlert(alert: SentimentAlert): Promise<EvaluationResult> {
  switch (alert.alert_type) {
    case "FEAR_GREED": {
      const fg = getFearGreed();
      if (!fg) return { trigger: false, currentValue: 0 };
      
      // For Fear & Greed, threshold can be "above X" or "below X"
      // We'll use: threshold > 50 means alert when score >= threshold (greed)
      //            threshold <= 50 means alert when score <= threshold (fear)
      const trigger = alert.threshold > 50 
        ? fg.score >= alert.threshold
        : fg.score <= alert.threshold;
      
      return { trigger, currentValue: fg.score };
    }

    case "SENTIMENT_UP": {
      const sentiment = getTokenSentiment(alert.symbol);
      if (!sentiment) return { trigger: false, currentValue: 0 };
      
      // Alert when bullish (up) sentiment exceeds threshold
      return { 
        trigger: sentiment.up_percent >= alert.threshold,
        currentValue: sentiment.up_percent 
      };
    }

    case "SENTIMENT_DOWN": {
      const sentiment = getTokenSentiment(alert.symbol);
      if (!sentiment) return { trigger: false, currentValue: 0 };
      
      // Alert when bearish (down) sentiment exceeds threshold
      return { 
        trigger: sentiment.down_percent >= alert.threshold,
        currentValue: sentiment.down_percent 
      };
    }

    default:
      return { trigger: false, currentValue: 0 };
  }
}

/**
 * Get count of active sentiment alerts
 */
export function getActiveSentimentAlertCount(): number {
  return getActiveSentimentAlerts().length;
}
