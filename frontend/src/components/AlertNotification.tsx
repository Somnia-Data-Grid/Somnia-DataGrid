'use client';

import { useEffect, useState } from "react";
import type { AlertNotification as AlertNotificationType } from "@/lib/hooks/usePriceSubscription";
import { formatPrice } from "@/lib/schemas";

interface AlertNotificationProps {
  alerts: AlertNotificationType[];
  onDismiss?: (alertId: string) => void;
}

interface ToastAlert extends AlertNotificationType {
  visible: boolean;
}

export function AlertNotification({ alerts, onDismiss }: AlertNotificationProps) {
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  // Add new alerts as toasts
  useEffect(() => {
    if (!alerts.length) return;

    const latestAlert = alerts[0];
    const toastKey = `${latestAlert.alertId}-${latestAlert.triggeredAt}`;

    setToasts((prev) => {
      // Check if this alert is already shown
      if (prev.some((t) => `${t.alertId}-${t.triggeredAt}` === toastKey)) {
        return prev;
      }

      // Add new toast at the beginning
      const newToast: ToastAlert = { ...latestAlert, visible: true };
      return [newToast, ...prev].slice(0, 5);
    });
  }, [alerts]);

  // Auto-dismiss toasts after 8 seconds
  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast, index) => {
      if (!toast.visible) return null;

      return setTimeout(() => {
        setToasts((prev) =>
          prev.map((t, i) => (i === index ? { ...t, visible: false } : t))
        );

        // Remove from DOM after fade animation
        setTimeout(() => {
          setToasts((prev) => prev.filter((_, i) => i !== index));
        }, 300);
      }, 8000);
    });

    return () => {
      timers.forEach((timer) => timer && clearTimeout(timer));
    };
  }, [toasts.length]);

  const handleDismiss = (index: number) => {
    const toast = toasts[index];
    setToasts((prev) =>
      prev.map((t, i) => (i === index ? { ...t, visible: false } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((_, i) => i !== index));
    }, 300);
    onDismiss?.(toast.alertId);
  };

  // Format threshold price for display
  const formatThreshold = (raw: string, decimals = 8) => {
    try {
      return formatPrice(BigInt(raw), decimals, 2);
    } catch {
      return raw;
    }
  };

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3">
      {toasts.map((toast, index) => (
        <div
          key={`${toast.alertId}-${toast.triggeredAt}`}
          className={`pointer-events-auto w-full max-w-sm rounded-xl border border-emerald-500/30 bg-[#02020a]/90 p-4 shadow-lg shadow-emerald-900/20 backdrop-blur-md transition-all duration-300 ${toast.visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <p className="text-sm font-semibold text-emerald-400">
                  {toast.asset} Alert Triggered!
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Price went{" "}
                <span className="font-semibold text-white">
                  {toast.condition === "ABOVE" ? "above" : "below"}
                </span>{" "}
                <span className="font-mono font-semibold text-white">
                  ${formatThreshold(toast.thresholdPrice)}
                </span>
                {toast.currentPrice && (
                  <span className="text-slate-400">
                    {" "}→ ${formatThreshold(toast.currentPrice)}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {toast.triggeredAt > 0
                  ? new Date(toast.triggeredAt * 1000).toLocaleTimeString()
                  : "Just now"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(index)}
              className="ml-2 text-slate-500 transition hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

