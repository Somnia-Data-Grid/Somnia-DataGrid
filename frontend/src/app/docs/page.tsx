'use client';

import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-[#02020a] text-slate-300 selection:bg-purple-500/30">
            {/* Navigation */}
            <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md fixed w-full z-50">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Logo className="h-10 w-10" />
                            <span className="text-xl font-bold text-white tracking-tight">Somnia <span className="text-purple-400">DataGrid</span></span>
                        </Link>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link
                            href="/dashboard"
                            className="rounded-full bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-slate-200 transition-colors"
                        >
                            Launch App
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-12">
                        <h1 className="text-4xl font-bold text-white mb-4">Documentation</h1>
                        <p className="text-xl text-slate-400">
                            Comprehensive guide to consuming Somnia Data Streams.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-4">
                            <a
                                href="https://datastreams.somnia.network/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                            >
                                Official Somnia Data Streams
                            </a>
                            <span className="text-slate-600">•</span>
                            <a
                                href="https://docs.somnia.network/somnia-data-streams/getting-started/quickstart"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                            >
                                Official Documentation
                            </a>
                        </div>
                    </div>

                    <div className="space-y-16">
                        {/* Section 1: Introduction */}
                        <section>
                            <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200">
                                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                    </span>
                                    Live on Somnia Testnet
                                </h3>
                                <p className="text-sm opacity-90">
                                    Somnia DataGrid streams are currently live on the Somnia Testnet. Mainnet launch is coming soon.
                                </p>
                            </div>
                        </section>

                        {/* Section 2: Publisher Info */}
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-6">Publisher Information</h2>
                            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                <table className="w-full text-left text-sm">
                                    <tbody className="divide-y divide-white/5">
                                        <tr className="hover:bg-white/5">
                                            <td className="p-4 font-medium text-slate-300">Publisher Address</td>
                                            <td className="p-4 font-mono text-purple-400">0xCdBc32445c71a5d0a525060e2760bE6982606F20</td>
                                        </tr>
                                        <tr className="hover:bg-white/5">
                                            <td className="p-4 font-medium text-slate-300">Network</td>
                                            <td className="p-4 text-slate-400">Somnia Testnet (Chain ID: 50312)</td>
                                        </tr>
                                        <tr className="hover:bg-white/5">
                                            <td className="p-4 font-medium text-slate-300">RPC URL</td>
                                            <td className="p-4 font-mono text-slate-400">https://dream-rpc.somnia.network</td>
                                        </tr>
                                        <tr className="hover:bg-white/5">
                                            <td className="p-4 font-medium text-slate-300">WebSocket URL</td>
                                            <td className="p-4 font-mono text-slate-400">wss://dream-rpc.somnia.network/ws</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Section 3: Available Streams */}
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-6">Available Data Streams</h2>
                            <div className="grid gap-6">
                                {/* Price Feed */}
                                <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white">💰 Price Feed Stream</h3>
                                        <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded">PriceUpdateV2</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">Real-time cryptocurrency prices from CoinGecko and DIA Oracle.</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-slate-500">Schema ID:</span>
                                            <code className="font-mono text-xs bg-black/40 p-2 rounded text-slate-300 break-all">
                                                0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd
                                            </code>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <span className="text-slate-500 block text-xs mb-1">Update Frequency</span>
                                                <span className="text-white">Every 30 seconds</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs mb-1">Supported Symbols</span>
                                                <span className="text-white">BTC, ETH, USDC, USDT, ARB, SOL, WETH, STT</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Fear & Greed */}
                                <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white">😱 Fear & Greed Index</h3>
                                        <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded">FearGreedUpdateV1</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">Market sentiment indicator (0-100 scale).</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-slate-500">Schema ID:</span>
                                            <code className="font-mono text-xs bg-black/40 p-2 rounded text-slate-300 break-all">
                                                0x2677cc5213165393c4dc709037e567c40b4c5651aa7236bed50b5c79615f690e
                                            </code>
                                        </div>
                                        <div className="mt-4">
                                            <span className="text-slate-500 block text-xs mb-1">Zones</span>
                                            <span className="text-white">EXTREME_FEAR, FEAR, NEUTRAL, GREED, EXTREME_GREED</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Token Sentiment */}
                                <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white">📊 Token Sentiment</h3>
                                        <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded">TokenSentimentUpdateV1</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">Crowd sentiment from CoinGecko votes.</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-slate-500">Schema ID:</span>
                                            <code className="font-mono text-xs bg-black/40 p-2 rounded text-slate-300 break-all">
                                                0xac6d6a398b120ea9d97cf671eb2d5565c63d1a42fdb4085f6e159bf48120a002
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                {/* News Event */}
                                <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white">📰 News Event Stream</h3>
                                        <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded">NewsEventV1</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">Individual crypto news articles with sentiment.</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-slate-500">Schema ID:</span>
                                            <code className="font-mono text-xs bg-black/40 p-2 rounded text-slate-300 break-all">
                                                0x563069d74bccf2f025244f9d6401505b503437075584ee94c9bb436afe2891cd
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                {/* Alert Triggered */}
                                <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white">🔔 Alert Triggered</h3>
                                        <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded">AlertTriggeredV2</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">Emitted when a price alert is triggered.</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-slate-500">Schema ID:</span>
                                            <code className="font-mono text-xs bg-black/40 p-2 rounded text-slate-300 break-all">
                                                0x23a742dfe97765a981a611d4e2a1d911bcc5f683ecfb8704f90cb146e0c29d45
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 4: Requesting New Tokens */}
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-6">Requesting New Tokens</h2>
                            <div className="space-y-6">
                                <p className="text-slate-400">
                                    You can request support for new tokens in the Price Feed and other streams.
                                    Requests are rate-limited to prevent spam.
                                </p>

                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* Via API */}
                                    <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                        <h3 className="text-lg font-semibold text-white mb-4">Via API</h3>
                                        <pre className="font-mono text-xs bg-black/40 p-4 rounded text-slate-300 overflow-x-auto">
                                            {`curl -X POST https://your-api.com/api/streams/request \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "PEPE",
    "name": "Pepe",
    "coingeckoId": "pepe",
    "type": "PRICE"
  }'`}
                                        </pre>
                                    </div>

                                    {/* Self-Hosting */}
                                    <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                                        <h3 className="text-lg font-semibold text-white mb-4">Self-Hosting Config</h3>
                                        <p className="text-sm text-slate-400 mb-4">
                                            If you are running your own DataGrid instance, add tokens to your <code>workers/.env</code> file:
                                        </p>
                                        <pre className="font-mono text-xs bg-black/40 p-4 rounded text-slate-300 overflow-x-auto">
                                            {`SYMBOLS=BTC,ETH,USDC,USDT,SOL,PEPE
SENTIMENT_SYMBOLS=BTC,ETH,SOL,PEPE`}
                                        </pre>
                                    </div>
                                </div>

                                {/* Supported Sources */}
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Supported Data Sources</h3>
                                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-white/5 text-slate-300">
                                                <tr>
                                                    <th className="p-4 font-medium">Source</th>
                                                    <th className="p-4 font-medium">Coverage</th>
                                                    <th className="p-4 font-medium">Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-slate-400">
                                                <tr className="hover:bg-white/5">
                                                    <td className="p-4 text-white">CoinGecko</td>
                                                    <td className="p-4">10,000+ Tokens</td>
                                                    <td className="p-4">Requires valid <code>coingeckoId</code></td>
                                                </tr>
                                                <tr className="hover:bg-white/5">
                                                    <td className="p-4 text-white">DIA Oracle</td>
                                                    <td className="p-4">Selected Assets</td>
                                                    <td className="p-4">On-chain oracle integration</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 5: Integration Guide */}
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-6">Integration Guide</h2>

                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3">1. Installation</h3>
                                    <div className="rounded-lg bg-[#0a0a12] border border-white/10 p-4 font-mono text-sm text-slate-300">
                                        npm install @somnia-chain/streams viem
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3">2. Basic Subscription (Polling)</h3>
                                    <div className="rounded-lg bg-[#0a0a12] border border-white/10 overflow-hidden">
                                        <div className="p-4 overflow-x-auto">
                                            <pre className="font-mono text-sm leading-relaxed">
                                                <code className="language-typescript">
                                                    {`import { SDK } from '@somnia-chain/streams';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

const sdk = new SDK({ public: client });

const PRICE_SCHEMA_ID = '0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd';
const PUBLISHER = '0xCdBc32445c71a5d0a525060e2760bE6982606F20';

// Fetch latest data
const latestData = await sdk.streams.getLastPublishedDataForSchema(
  PRICE_SCHEMA_ID, 
  PUBLISHER
);

console.log(latestData);`}
                                                </code>
                                            </pre>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3">3. Real-Time Subscription (WebSocket)</h3>
                                    <div className="rounded-lg bg-[#0a0a12] border border-white/10 overflow-hidden">
                                        <div className="p-4 overflow-x-auto">
                                            <pre className="font-mono text-sm leading-relaxed">
                                                <code className="language-typescript">
                                                    {`import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { createPublicClient, webSocket } from "viem";
import { somniaTestnet } from "viem/chains";

const client = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket("wss://dream-rpc.somnia.network/ws"),
});

const sdk = new SDK({ public: client });
const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
const encoder = new SchemaEncoder(PRICE_SCHEMA);

await sdk.streams.subscribe({
  somniaStreamsEventId: "PriceUpdateV2",
  onData: (data) => {
    const decoded = encoder.decodeData(data);
    const symbol = decoded[1].value;
    const price = Number(decoded[2].value) / 1e8;
    console.log(\`\${symbol}: $\${price.toFixed(2)}\`);
  },
});`}
                                                </code>
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
