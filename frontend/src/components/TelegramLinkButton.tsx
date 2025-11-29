'use client';

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";

interface LinkStatus {
  linked: boolean;
  deepLink?: string;
  telegramUsername?: string;
}

export function TelegramLinkButton() {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingForLink, setWaitingForLink] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const checkStatus = useCallback(async () => {
    if (!address) return;

    try {
      // Poll Telegram for updates when waiting (handles both dev and production)
      // This is needed because webhooks may not be configured or reachable
      if (waitingForLink) {
        try {
          await fetch('/api/telegram/poll');
        } catch {
          // Ignore poll errors - webhook might be handling it
        }
      }

      // Add cache buster to prevent stale responses and timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`/api/telegram/link?wallet=${address}&_t=${Date.now()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (data.success) {
        const newStatus = {
          linked: data.linked,
          deepLink: data.deepLink,
          telegramUsername: data.telegramUsername,
        };
        setStatus(newStatus);

        // Stop fast polling once linked
        if (data.linked && waitingForLink) {
          setWaitingForLink(false);
          setPollCount(0);
        }

        // Increment poll count when waiting
        if (waitingForLink && !data.linked) {
          setPollCount(prev => prev + 1);
        }
      } else {
        // API returned but not successful - set default unlinked status
        setStatus({ linked: false, deepLink: data.deepLink });
      }
    } catch (error) {
      console.error("[TelegramLink] Check status error:", error);
      // On error, set default unlinked status so UI doesn't hang
      setStatus((prev) => prev ?? { linked: false });
    }
  }, [address, waitingForLink]);

  useEffect(() => {
    if (!address) {
      setStatus(null);
      return;
    }

    checkStatus();

    // Fast poll (2s) when waiting for link, slow poll (15s) otherwise
    const pollInterval = waitingForLink ? 2000 : 15000;
    const interval = setInterval(checkStatus, pollInterval);
    
    // Fallback: if status is still null after 8 seconds, set default
    const fallbackTimeout = setTimeout(() => {
      setStatus((prev) => prev ?? { linked: false });
    }, 8000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimeout);
    };
  }, [address, checkStatus, waitingForLink]);

  // Cancel waiting after 60 seconds (30 polls at 2s each)
  useEffect(() => {
    if (!waitingForLink) return;
    const timeout = setTimeout(() => {
      setWaitingForLink(false);
      setPollCount(0);
    }, 60000);
    return () => clearTimeout(timeout);
  }, [waitingForLink]);

  // Start fast polling when user clicks link button
  const handleLinkClick = () => {
    setWaitingForLink(true);
    setPollCount(0);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setLoading(true);
    await checkStatus();
    setLoading(false);
  };

  const handleUnlink = async () => {
    if (!address) return;

    setLoading(true);
    try {
      await fetch(`/api/telegram/link?wallet=${address}`, { method: "DELETE" });
      setStatus({ linked: false, deepLink: status?.deepLink });
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
        Checking Telegram...
      </div>
    );
  }

  if (status.linked) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-400">
          <span>📱</span>
          <span>Telegram linked</span>
          {status.telegramUsername && (
            <span className="font-medium">@{status.telegramUsername}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={loading}
          className="text-xs text-slate-400 underline hover:text-slate-300"
        >
          Unlink
        </button>
      </div>
    );
  }

  // Open Telegram bot in a popup window
  const openTelegramPopup = () => {
    // Fallback deepLink if not provided by API
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Somnia_defi_bot";
    const telegramUrl = status.deepLink || `https://t.me/${botUsername}?start=${address}`;
    
    console.log("[TelegramLink] Opening popup:", telegramUrl, "status:", status);
    
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      telegramUrl,
      'telegram-link',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    // Check if popup was blocked
    if (!popup || popup.closed) {
      console.log("[TelegramLink] Popup blocked, opening in new tab");
      // Fallback: open in new tab if popup blocked
      window.open(telegramUrl, '_blank');
    }
    
    handleLinkClick();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openTelegramPopup}
          className="flex items-center gap-1.5 rounded-md bg-[#0088cc] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0077b5] shadow-sm shadow-blue-500/20 cursor-pointer"
        >
          {waitingForLink ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Waiting...
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.154.232.17.325.015.094.034.31.019.478z" />
              </svg>
              Link Telegram
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>
      {waitingForLink && (
        <p className="text-xs text-slate-500">
          Click "Start" in the Telegram popup, then confirm the link.
          {pollCount > 5 && " Still waiting... Make sure you clicked Start in the bot."}
          {pollCount > 15 && " Taking longer than expected. Try clicking Refresh."}
        </p>
      )}
    </div>
  );
}
