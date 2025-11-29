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
    error,
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

  const [addingToken, setAddingToken] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  const handleSelect = async (token: TokenSearchResult) => {
    setAddingToken(token.id);
    const success = await trackToken(token, walletAddress);
    setAddingToken(null);

    if (success) {
      setAddedMessage(`✓ ${token.symbol.toUpperCase()} added to tracking`);
      setTimeout(() => setAddedMessage(null), 3000);
      setQuery('');
      setShowDropdown(false);
      onTokenSelect?.(token);
    } else {
      setAddedMessage(`Failed to add ${token.symbol}`);
      setTimeout(() => setAddedMessage(null), 3000);
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
          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-200">
            ⚠️ {error}
          </div>
        )}

        {/* Success message */}
        {addedMessage && (
          <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
            {addedMessage}
          </div>
        )}

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-[#0a0a12] border border-white/10 rounded-lg shadow-xl max-h-64 overflow-y-auto"
          >
            {searchResults.map((token) => (
              <button
                key={token.id}
                onClick={() => handleSelect(token)}
                disabled={isTracked(token.id)}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg text-left ${isTracked(token.id) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-purple-400 uppercase font-medium">
                    {token.symbol}
                  </span>
                  <span className="text-slate-300 text-sm truncate max-w-[200px]">
                    {token.name}
                  </span>
                </div>
                {addingToken === token.id ? (
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                ) : isTracked(token.id) ? (
                  <span className="text-xs text-emerald-400 font-medium">✓ Tracked</span>
                ) : (
                  <span className="text-xs text-slate-500">+ Add</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tracked Tokens */}
      {showTrackedTokens && trackedTokens.length > 0 && (
        <div>
          <h4 className="text-sm text-slate-400 mb-2">Tracked Tokens</h4>
          <div className="flex flex-wrap gap-2">
            {trackedTokens.map((token) => (
              <div
                key={token.coin_id}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full"
              >
                <span className="text-sm font-mono text-purple-300 font-medium">
                  {token.symbol}
                </span>
                <button
                  onClick={() => untrackToken(token.coin_id)}
                  className="text-purple-400 hover:text-rose-400 transition-colors text-lg leading-none"
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
