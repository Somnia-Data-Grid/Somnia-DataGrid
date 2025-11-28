'use client';

import { useState, useEffect, useRef } from 'react';
import { useTokenTracking, type TokenSearchResult } from '@/lib/hooks/useTokenTracking';

interface TokenSearchProps {
  onTokenSelect?: (token: TokenSearchResult) => void;
  walletAddress?: string;
  showTrackedTokens?: boolean;
}

export function TokenSearch({ onTokenSelect, walletAddress, showTrackedTokens = true }: TokenSearchProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    searchResults,
    trackedTokens,
    isSearching,
    searchTokens,
    fetchTrackedTokens,
    trackToken,
    untrackToken,
    clearSearch,
  } = useTokenTracking();

  // Fetch tracked tokens on mount
  useEffect(() => {
    if (showTrackedTokens) {
      fetchTrackedTokens();
    }
  }, [showTrackedTokens, fetchTrackedTokens]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchTokens(query);
        setShowDropdown(true);
      } else {
        clearSearch();
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchTokens, clearSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (token: TokenSearchResult) => {
    const success = await trackToken(token, walletAddress);
    if (success) {
      setQuery('');
      setShowDropdown(false);
      onTokenSelect?.(token);
    }
  };

  const isTracked = (coinId: string) => trackedTokens.some(t => t.coin_id === coinId);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder="Search tokens (e.g., BTC, Ethereum)..."
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          >
            {searchResults.map((token) => (
              <button
                key={token.id}
                onClick={() => handleSelect(token)}
                disabled={isTracked(token.id)}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg text-left ${
                  isTracked(token.id) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-blue-600 uppercase font-medium">
                    {token.symbol}
                  </span>
                  <span className="text-slate-600 text-sm truncate max-w-[200px]">
                    {token.name}
                  </span>
                </div>
                {isTracked(token.id) ? (
                  <span className="text-xs text-emerald-600 font-medium">Tracked</span>
                ) : (
                  <span className="text-xs text-slate-400">+ Add</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tracked Tokens */}
      {showTrackedTokens && trackedTokens.length > 0 && (
        <div>
          <h4 className="text-sm text-slate-500 mb-2">Tracked Tokens</h4>
          <div className="flex flex-wrap gap-2">
            {trackedTokens.map((token) => (
              <div
                key={token.coin_id}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full"
              >
                <span className="text-sm font-mono text-blue-700 font-medium">
                  {token.symbol}
                </span>
                <button
                  onClick={() => untrackToken(token.coin_id)}
                  className="text-blue-400 hover:text-red-500 transition-colors text-lg leading-none"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
