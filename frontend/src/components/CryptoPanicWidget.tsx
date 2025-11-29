'use client';

import { useEffect, useRef } from 'react';

interface CryptoPanicWidgetProps {
  currencies?: string;
  bgColor?: string;
  textColor?: string;
  linkColor?: string;
  headerBgColor?: string;
  headerTextColor?: string;
}

export function CryptoPanicWidget({
  currencies = "BTC,ETH,SOL",
  bgColor = "#FFFFFF",
  textColor = "#333333",
  linkColor = "#0091C2",
  headerBgColor = "#1e293b",
  headerTextColor = "#FFFFFF",
}: CryptoPanicWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Load the CryptoPanic widget script once
    if (!scriptLoaded.current) {
      const existingScript = document.querySelector('script[src*="cryptopanic.com/static/js/widgets"]');

      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://static.cryptopanic.com/static/js/widgets.min.js';
        script.async = true;
        document.body.appendChild(script);
      }

      scriptLoaded.current = true;
    }

    // Re-initialize widget when component mounts
    const timer = setTimeout(() => {
      // @ts-expect-error - CryptoPanic widget global
      if (typeof window !== 'undefined' && window.CryptoPanicWidgets) {
        // @ts-expect-error - CryptoPanic widget global
        window.CryptoPanicWidgets.init();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={containerRef} className="rounded-xl border border-white/10 bg-[#070E1B] shadow-sm overflow-hidden">
      <div className="p-4 pb-2 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white mb-3">📰 Live Crypto News</h3>
      </div>
      <div className="px-2 pb-2">
        <a
          href="https://cryptopanic.com/"
          target="_blank"
          rel="noopener noreferrer"
          data-news_feed="recent"
          data-bg_color="#070E1B"
          data-text_color="#ffffff"
          data-link_color="#0091C2"
          data-header_bg_color="#070E1B"
          data-header_text_color="#ffffff"
          data-currencies={currencies}
          className="CryptoPanicWidget"
        >
          Latest News
        </a>
      </div>
      <div className="px-4 pb-3 pt-1">
        <p className="text-xs text-slate-400">
          Powered by <a href="https://cryptopanic.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">CryptoPanic</a>
        </p>
      </div>
    </div>
  );
}
