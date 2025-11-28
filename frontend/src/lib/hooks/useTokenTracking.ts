'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_WORKERS_API_URL || 'http://localhost:3001';

export interface TokenSearchResult {
  id: string;
  symbol: string;
  name: string;
}

export interface TrackedToken {
  id?: number;
  coin_id: string;
  symbol: string;
  name: string;
  added_by: string;
  added_at: number;
  is_active: number;
}

export interface SentimentAlert {
  id: string;
  wallet_address: string;
  coin_id: string;
  symbol: string;
  alert_type: 'SENTIMENT_UP' | 'SENTIMENT_DOWN' | 'FEAR_GREED';
  threshold: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'DISABLED';
  created_at: number;
  triggered_at?: number;
}

export function useTokenTracking() {
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [trackedTokens, setTrackedTokens] = useState<TrackedToken[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTokens = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tokens/search?q=${encodeURIComponent(query)}&limit=15`);
      const data = await res.json();
      
      if (data.success) {
        setSearchResults(data.tokens);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      // Workers API not available - show error
      console.error('Token search failed - is workers API running?', err);
      setError('Workers API unavailable. Start workers with: cd workers && npm run dev');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchTrackedTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tokens/tracked`);
      const data = await res.json();
      
      if (data.success) {
        setTrackedTokens(data.tokens);
      }
    } catch (err) {
      console.error('Failed to fetch tracked tokens:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const trackToken = useCallback(async (token: TokenSearchResult, walletAddress?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tokens/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: token.id,
          symbol: token.symbol,
          name: token.name,
          walletAddress,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchTrackedTokens();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to track token:', err);
      return false;
    }
  }, [fetchTrackedTokens]);

  const untrackToken = useCallback(async (coinId: string, walletAddress?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tokens/untrack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinId, wallet: walletAddress }),
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchTrackedTokens();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to untrack token:', err);
      return false;
    }
  }, [fetchTrackedTokens]);

  return {
    searchResults,
    trackedTokens,
    isSearching,
    isLoading,
    error,
    searchTokens,
    fetchTrackedTokens,
    trackToken,
    untrackToken,
    clearSearch: () => setSearchResults([]),
  };
}

export function useSentimentAlerts(walletAddress?: string) {
  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sentiment-alerts?wallet=${walletAddress}`);
      const data = await res.json();
      
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to fetch sentiment alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const createAlert = useCallback(async (
    coinId: string,
    symbol: string,
    alertType: SentimentAlert['alert_type'],
    threshold: number
  ) => {
    if (!walletAddress) return false;

    try {
      const res = await fetch(`${API_BASE}/api/sentiment-alerts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          coinId,
          symbol,
          alertType,
          threshold,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchAlerts();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to create sentiment alert:', err);
      return false;
    }
  }, [walletAddress, fetchAlerts]);

  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/sentiment-alerts/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchAlerts();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete sentiment alert:', err);
      return false;
    }
  }, [fetchAlerts]);

  return {
    alerts,
    isLoading,
    fetchAlerts,
    createAlert,
    deleteAlert,
  };
}
