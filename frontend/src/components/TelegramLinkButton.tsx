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
      
      // Add cache buster to prevent stale responses
      const response = await fetch(`/api/telegram/link?wallet=${address}&_t=${Date.now()}`);
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
      }
    } catch (error) {
      console.error("[TelegramLink] Check status error:", error);
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
    return () => clearInterval(interval);
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
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        Checking Telegram...
      </div>
    );
  }

  if (status.linked) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
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
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <a
          href={status.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
        >
          {waitingForLink ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Waiting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.154.232.17.325.015.094.034.31.019.478z"/>
              </svg>
              Link Telegram
            </>
          )}
        </a>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>
      {waitingForLink && (
        <p className="text-xs text-slate-500">
          Open Telegram and click "Confirm Link" in the bot chat.
          {pollCount > 5 && " Still waiting... Make sure the bot received your message."}
          {pollCount > 15 && " Taking longer than expected. Try clicking Refresh."}
        </p>
      )}
    </div>
  );
}
