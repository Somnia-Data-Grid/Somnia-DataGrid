'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSentimentAlerts, useTokenTracking, type SentimentAlert } from '@/lib/hooks/useTokenTracking';

const ALERT_TYPE_LABELS: Record<SentimentAlert['alert_type'], string> = {
  SENTIMENT_UP: '📈 Bullish Sentiment',
  SENTIMENT_DOWN: '📉 Bearish Sentiment',
  FEAR_GREED: '😱 Fear & Greed',
};

export function SentimentAlertManager() {
  const { address, isConnected } = useAccount();
  const { alerts, isLoading, fetchAlerts, createAlert, deleteAlert } = useSentimentAlerts(address);
  const { trackedTokens, fetchTrackedTokens } = useTokenTracking();

  const [showForm, setShowForm] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState('');
  const [alertType, setAlertType] = useState<SentimentAlert['alert_type']>('SENTIMENT_UP');
  const [threshold, setThreshold] = useState(70);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchAlerts();
      fetchTrackedTokens();
    }
  }, [isConnected, address, fetchAlerts, fetchTrackedTokens]);

  const handleCreate = async () => {
    if (!selectedCoin) return;

    const token = trackedTokens.find(t => t.coin_id === selectedCoin);
    if (!token) return;

    setIsCreating(true);
    const success = await createAlert(token.coin_id, token.symbol, alertType, threshold);
    setIsCreating(false);

    if (success) {
      setShowForm(false);
      setSelectedCoin('');
      setThreshold(70);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-white mb-4">Sentiment Alerts</h3>
        <p className="text-slate-400 text-sm">Connect your wallet to manage sentiment alerts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Sentiment Alerts</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
        >
          {showForm ? 'Cancel' : '+ New Alert'}
        </button>
      </div>

      {/* Create Alert Form */}
      {showForm && (
        <div className="mb-6 p-4 bg-black/20 border border-white/10 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Token</label>
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a token...</option>
              {trackedTokens.map((token) => (
                <option key={token.coin_id} value={token.coin_id}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
            {trackedTokens.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">
                No tokens tracked yet. Go to the Tokens tab to add some first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Alert Type</label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as SentimentAlert['alert_type'])}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="SENTIMENT_UP">📈 When bullish sentiment exceeds threshold</option>
              <option value="SENTIMENT_DOWN">📉 When bearish sentiment exceeds threshold</option>
              <option value="FEAR_GREED">😱 When Fear & Greed index crosses threshold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Threshold: {threshold}%
            </label>
            <input
              type="range"
              min="10"
              max="90"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>10%</span>
              <span>50%</span>
              <span>90%</span>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!selectedCoin || isCreating}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-600/20"
          >
            {isCreating ? 'Creating...' : 'Create Alert'}
          </button>
        </div>
      )}

      {/* Alerts List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">
          No sentiment alerts yet. Create one to get notified!
        </p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${alert.status === 'ACTIVE'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white/5 border-white/5 opacity-60'
                }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-primary font-medium">{alert.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alert.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-500/20 text-slate-400'
                      }`}>
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {ALERT_TYPE_LABELS[alert.alert_type]} &gt; {alert.threshold}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Created {formatDate(alert.created_at)}
                  </p>
                </div>
                {alert.status === 'ACTIVE' && (
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    title="Delete alert"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
