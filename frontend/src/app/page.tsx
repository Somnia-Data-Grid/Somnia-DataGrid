'use client';

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function LandingPage() {


  return (
    <div className="min-h-screen bg-[#02020a] text-slate-300 selection:bg-purple-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md fixed w-full z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo className="h-10 w-10" />
            <span className="text-xl font-bold text-white tracking-tight">Somnia <span className="text-purple-400">DataGrid</span></span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="text-sm font-medium hover:text-white transition-colors">Documentation</Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#02020a] to-[#02020a]"></div>
        <div className="mx-auto max-w-7xl px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            Live on Somnia Testnet
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
            On-Chain Market Intelligence <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Powered by Somnia Data Streams</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            DataGrid publishes real-time price feeds, sentiment analysis, and alert events using Somnia's Data Streams protocol — ready for your smart contracts and dApps to consume.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="h-12 px-8 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(124,58,237,0.5)]"
            >
              Launch AlertGrid DApp
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/docs"
              className="h-12 px-8 rounded-full border border-white/10 hover:bg-white/5 text-white font-semibold flex items-center gap-2 transition-all"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Data Streams Showcase Section */}
      <section className="py-24 bg-black/40 border-y border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Live Data Streams</h2>
            <p className="text-slate-400">Subscribe to real-time events on the Somnia Testnet.</p>
            <div className="mt-4 inline-block px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono text-slate-300">
              Publisher: <span className="text-purple-400">0xCdBc32445c71a5d0a525060e2760bE6982606F20</span>
            </div>
          </div>

          <DataStreamsTabs />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Price Feeds</h3>
              <p className="text-slate-400">Real-time crypto prices from CoinGecko and DIA, published directly on-chain.</p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">On-Chain Alerts</h3>
              <p className="text-slate-400">Set price triggers and receive verifiable notifications via smart contract events.</p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Sentiment Analysis</h3>
              <p className="text-slate-400">Fear & Greed index and token sentiment streams to power smarter DeFi strategies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-black/40">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-bold text-white">Somnia DataGrid</span>
          </div>
          <p className="text-sm text-slate-500">
            Built for the Somnia Hackathon. Powered by Somnia Data Streams.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Data Streams: Store data on-chain + emit events (can read historical data)
// Event Streams: Only emit events (subscribe only, no historical data)
const STREAMS = [
  {
    id: 'price',
    label: 'Price Feed',
    icon: '💰',
    schemaId: '0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd',
    eventId: 'PriceUpdateV2',
    description: 'Real-time crypto prices (BTC, ETH, etc.)',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    type: 'data' // Data Stream - can read + subscribe
  },
  {
    id: 'sentiment',
    label: 'Token Sentiment',
    icon: '📊',
    schemaId: '0xac6d6a398b120ea9d97cf671eb2d5565c63d1a42fdb4085f6e159bf48120a002',
    eventId: 'TokenSentimentUpdateV1',
    description: 'Crowd sentiment per token',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    type: 'data'
  },
  {
    id: 'fear_greed',
    label: 'Fear & Greed',
    icon: '😱',
    schemaId: '0x2677cc5213165393c4dc709037e567c40b4c5651aa7236bed50b5c79615f690e',
    eventId: 'FearGreedUpdateV1',
    description: 'Market Fear & Greed Index (0-100)',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    type: 'data'
  },
  {
    id: 'alert',
    label: 'Alert Events',
    icon: '🔔',
    schemaId: '0x23a742dfe97765a981a611d4e2a1d911bcc5f683ecfb8704f90cb146e0c29d45',
    eventId: 'AlertTriggeredV2',
    description: 'Price alert trigger notifications (event-only)',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    type: 'event' // Event Stream - subscribe only
  },
  {
    id: 'news',
    label: 'News Feed',
    icon: '📰',
    schemaId: '0x563069d74bccf2f025244f9d6401505b503437075584ee94c9bb436afe2891cd',
    eventId: 'NewsEventV1',
    description: 'Individual news articles (Coming Soon)',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    type: 'data',
    comingSoon: true
  }
];

function DataStreamsTabs() {
  const [activeTab, setActiveTab] = useState('price');
  const [copied, setCopied] = useState(false);

  const activeStream = STREAMS.find(s => s.id === activeTab) || STREAMS[0];

  const copyCode = () => {
    // Different code for Data Streams vs Event Streams
    const isEventOnly = activeStream.type === 'event';
    
    const code = isEventOnly 
      ? `import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, webSocket } from 'viem';

// Use WebSocket for real-time subscriptions
const wsClient = createPublicClient({
  chain: { id: 50312, name: 'Somnia Testnet', ... },
  transport: webSocket('wss://dream-rpc.somnia.network/ws'),
});

const sdk = new SDK({ public: wsClient });

// Subscribe to ${activeStream.label} (Event Stream - subscribe only)
const subscription = await sdk.streams.subscribe({
  somniaStreamsEventId: '${activeStream.eventId}',
  ethCalls: [],
  onlyPushChanges: false,
  onData: (data) => {
    console.log('${activeStream.label}:', data);
  },
  onError: (err) => console.error(err),
});

// To unsubscribe: subscription.unsubscribe();`
      : `import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, http, webSocket } from 'viem';

const PUBLISHER = '0xCdBc32445c71a5d0a525060e2760bE6982606F20';
const SCHEMA_ID = '${activeStream.schemaId}';

// Option 1: Read historical data (HTTP)
const httpClient = createPublicClient({
  chain: { id: 50312, name: 'Somnia Testnet', ... },
  transport: http('https://dream-rpc.somnia.network'),
});
const sdk = new SDK({ public: httpClient });

const data = await sdk.streams.getAllPublisherDataForSchema(
  SCHEMA_ID,
  PUBLISHER
);
console.log('${activeStream.label} Data:', data);

// Option 2: Subscribe to real-time updates (WebSocket)
const wsClient = createPublicClient({
  chain: { id: 50312, name: 'Somnia Testnet', ... },
  transport: webSocket('wss://dream-rpc.somnia.network/ws'),
});
const wsSdk = new SDK({ public: wsClient });

const subscription = await wsSdk.streams.subscribe({
  somniaStreamsEventId: '${activeStream.eventId}',
  ethCalls: [],
  onlyPushChanges: false,
  onData: (data) => console.log('Update:', data),
});`;

    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Tabs List */}
      <div className="lg:w-1/3 flex flex-col gap-2">
        {STREAMS.map((stream) => (
          <button
            key={stream.id}
            onClick={() => setActiveTab(stream.id)}
            className={`text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${activeTab === stream.id
              ? `${stream.bg} ${stream.border} ${stream.color} shadow-lg`
              : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
          >
            <span className="text-xl">{stream.icon}</span>
            <div className="flex-1">
              <div className="font-semibold">{stream.label}</div>
              <div className="text-xs opacity-70">{stream.description}</div>
            </div>
            {stream.comingSoon ? (
              <span className="text-[10px] uppercase font-bold bg-yellow-500/20 px-2 py-0.5 rounded text-yellow-400">Soon</span>
            ) : stream.type === 'event' ? (
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-400">Event</span>
            ) : (
              <span className="text-[10px] uppercase font-bold bg-purple-500/20 px-2 py-0.5 rounded text-purple-400">Data</span>
            )}
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div className="lg:w-2/3">
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#0a0a12] shadow-2xl h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
              <span className="ml-2 text-xs text-slate-500 font-mono">example.ts</span>
            </div>
            <button
              onClick={copyCode}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              {copied ? (
                <span className="text-emerald-400">Copied!</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="p-6 overflow-x-auto flex-1 font-mono text-sm leading-relaxed">
            {activeStream.comingSoon ? (
              // Coming Soon
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 min-h-[200px]">
                <span className="text-4xl">🚧</span>
                <p className="text-center">
                  <span className="text-white font-semibold">{activeStream.label}</span> is coming soon!
                  <br />
                  <span className="text-sm">Schema ID and Event ID are ready for integration.</span>
                </p>
              </div>
            ) : activeStream.type === 'event' ? (
              // Event Stream - Subscribe only
              <pre>
                <code className="language-typescript">
                  <span className="text-purple-400">import</span>{" { SDK } "}<span>from</span>{" "}<span className="text-emerald-400">'@somnia-chain/streams'</span>;{"\n"}
                  <span className="text-purple-400">import</span>{" { createPublicClient, webSocket } "}<span>from</span>{" "}<span className="text-emerald-400">'viem'</span>;{"\n\n"}

                  <span className="text-slate-500">// Use WebSocket for real-time subscriptions</span>{"\n"}
                  <span className="text-purple-400">const</span>{" wsClient = "}<span className="text-blue-400">createPublicClient</span>({"{\n"}
                  {"  "}chain: {"{ "}id: 50312, name: <span className="text-emerald-400">'Somnia Testnet'</span>{" }"},{"\n"}
                  {"  "}transport: <span className="text-blue-400">webSocket</span>(<span className="text-emerald-400">'wss://dream-rpc.somnia.network/ws'</span>),{"\n"}
                  {"});\n\n"}

                  <span className="text-purple-400">const</span>{" sdk = "}<span className="text-purple-400">new</span>{" "}<span className="text-yellow-400">SDK</span>({"{ "}public: wsClient{" });\n\n"}

                  <span className="text-slate-500">// Subscribe to {activeStream.label} (Event Stream)</span>{"\n"}
                  <span className="text-purple-400">const</span>{" subscription = "}<span className="text-purple-400">await</span>{" sdk.streams."}<span className="text-blue-400">subscribe</span>({"{\n"}
                  {"  "}somniaStreamsEventId: <span className="text-emerald-400">'{activeStream.eventId}'</span>,{"\n"}
                  {"  "}ethCalls: [],{"\n"}
                  {"  "}onlyPushChanges: <span className="text-orange-400">false</span>,{"\n"}
                  {"  "}onData: (data) {"=> {\n"}
                  {"    "}console.<span className="text-blue-400">log</span>(<span className="text-emerald-400">'{activeStream.label}:'</span>, data);{"\n"}
                  {"  }"},{"\n"}
                  {"}"});
                </code>
              </pre>
            ) : (
              // Data Stream - Read + Subscribe
              <pre>
                <code className="language-typescript">
                  <span className="text-purple-400">import</span>{" { SDK } "}<span>from</span>{" "}<span className="text-emerald-400">'@somnia-chain/streams'</span>;{"\n"}
                  <span className="text-purple-400">import</span>{" { createPublicClient, http } "}<span>from</span>{" "}<span className="text-emerald-400">'viem'</span>;{"\n\n"}

                  <span className="text-purple-400">const</span>{" PUBLISHER = "}<span className="text-emerald-400">'0xCdBc32445c71a5d0a525060e2760bE6982606F20'</span>;{"\n"}
                  <span className="text-purple-400">const</span>{" SCHEMA_ID = "}<span className="text-emerald-400">'{activeStream.schemaId}'</span>;{"\n\n"}

                  <span className="text-purple-400">const</span>{" client = "}<span className="text-blue-400">createPublicClient</span>({"{\n"}
                  {"  "}chain: {"{ "}id: 50312, name: <span className="text-emerald-400">'Somnia Testnet'</span>{" }"},{"\n"}
                  {"  "}transport: <span className="text-blue-400">http</span>(<span className="text-emerald-400">'https://dream-rpc.somnia.network'</span>),{"\n"}
                  {"});\n\n"}

                  <span className="text-purple-400">const</span>{" sdk = "}<span className="text-purple-400">new</span>{" "}<span className="text-yellow-400">SDK</span>({"{ "}public: client{" });\n\n"}

                  <span className="text-slate-500">// Read {activeStream.label} data</span>{"\n"}
                  <span className="text-purple-400">const</span>{" data = "}<span className="text-purple-400">await</span>{" sdk.streams."}<span className="text-blue-400">getAllPublisherDataForSchema</span>({"(\n"}
                  {"  "}SCHEMA_ID,{"\n"}
                  {"  "}PUBLISHER{"\n"}
                  {");\n\n"}
                  console.<span className="text-blue-400">log</span>(<span className="text-emerald-400">'{activeStream.label}:'</span>, data);
                </code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
