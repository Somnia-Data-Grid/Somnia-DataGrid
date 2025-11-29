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
              Integrate Somnia DataGrid streams into your dApp.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a
                href="https://docs.somnia.network/somnia-data-streams/getting-started/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
              >
                Official Somnia Data Streams Docs
              </a>
              <span className="text-slate-600">•</span>
              <a
                href="https://www.npmjs.com/package/@somnia-chain/streams"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
              >
                Official Somnia SDK on NPM
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
                  DataGrid streams are live on Somnia Testnet. All data is published on-chain and can be consumed by any dApp.
                </p>
              </div>
            </section>

            {/* Section 2: Key Concepts */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Key Concepts</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-5 rounded-xl border border-white/10 bg-white/5">
                  <h3 className="font-semibold text-white mb-2">📦 Data Streams</h3>
                  <p className="text-sm text-slate-400">
                    Store data on-chain and emit events. You can <strong>read historical data</strong> via <code className="text-purple-400">getAllPublisherDataForSchema()</code> and <strong>subscribe</strong> to real-time updates.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-white/10 bg-white/5">
                  <h3 className="font-semibold text-white mb-2">⚡ Event Streams</h3>
                  <p className="text-sm text-slate-400">
                    Emit events only (no data storage). You can only <strong>subscribe</strong> to events via WebSocket. No historical data available.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-white/10 bg-white/5">
                  <h3 className="font-semibold text-white mb-2">🔑 Schema ID</h3>
                  <p className="text-sm text-slate-400">
                    A deterministic hash of the schema string. Identifies <strong>what type</strong> of data you're querying.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-white/10 bg-white/5">
                  <h3 className="font-semibold text-white mb-2">👤 Publisher Address</h3>
                  <p className="text-sm text-slate-400">
                    The wallet address that published the data. Identifies <strong>who</strong> published it.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: Publisher Info */}
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
                      <td className="p-4 font-medium text-slate-300">RPC URL (HTTP)</td>
                      <td className="p-4 font-mono text-slate-400">https://dream-rpc.somnia.network</td>
                    </tr>
                    <tr className="hover:bg-white/5">
                      <td className="p-4 font-medium text-slate-300">RPC URL (WebSocket)</td>
                      <td className="p-4 font-mono text-slate-400">wss://dream-rpc.somnia.network/ws</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 4: Available Streams */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Available Streams</h2>
              <div className="grid gap-6">
                {/* Price Feed - Data Stream */}
                <StreamCard
                  icon="💰"
                  title="Price Feed"
                  eventId="PriceUpdateV2"
                  schemaId="0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd"
                  schema="uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress"
                  description="Real-time cryptocurrency prices from CoinGecko and DIA Oracle."
                  type="data"
                  details={[
                    { label: "Update Frequency", value: "Every 30 seconds" },
                    { label: "Supported Symbols", value: "BTC, ETH, USDC, USDT, ARB, SOL, WETH, STT" },
                    { label: "Price Decimals", value: "8 (divide by 10^8 for USD)" },
                  ]}
                />

                {/* Fear & Greed - Data Stream */}
                <StreamCard
                  icon="😱"
                  title="Fear & Greed Index"
                  eventId="FearGreedUpdateV1"
                  schemaId="0x2677cc5213165393c4dc709037e567c40b4c5651aa7236bed50b5c79615f690e"
                  schema="uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate"
                  description="Market sentiment indicator (0-100 scale)."
                  type="data"
                  details={[
                    { label: "Update Frequency", value: "Every 60 minutes" },
                    { label: "Zones", value: "EXTREME_FEAR, FEAR, NEUTRAL, GREED, EXTREME_GREED" },
                  ]}
                />

                {/* Token Sentiment - Data Stream */}
                <StreamCard
                  icon="📊"
                  title="Token Sentiment"
                  eventId="TokenSentimentUpdateV1"
                  schemaId="0xac6d6a398b120ea9d97cf671eb2d5565c63d1a42fdb4085f6e159bf48120a002"
                  schema="uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source"
                  description="Crowd sentiment from CoinGecko votes."
                  type="data"
                  details={[
                    { label: "Update Frequency", value: "Every 2 hours" },
                    { label: "Symbols", value: "BTC, ETH, SOL" },
                    { label: "Note", value: "Percentages in basis points (7500 = 75%)" },
                  ]}
                />

                {/* Alert Triggered - Event Stream */}
                <StreamCard
                  icon="🔔"
                  title="Alert Triggered"
                  eventId="AlertTriggeredV2"
                  schemaId="0x23a742dfe97765a981a611d4e2a1d911bcc5f683ecfb8704f90cb146e0c29d45"
                  schema="bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt"
                  description="Emitted when a price alert is triggered. Subscribe to get notified."
                  type="event"
                  details={[
                    { label: "Type", value: "Event-only (no historical data)" },
                    { label: "Use Case", value: "Real-time alert notifications" },
                  ]}
                />

                {/* News Event - Data Stream (Coming Soon) */}
                <StreamCard
                  icon="📰"
                  title="News Events"
                  eventId="NewsEventV1"
                  schemaId="0x563069d74bccf2f025244f9d6401505b503437075584ee94c9bb436afe2891cd"
                  schema="bytes32 newsId, uint64 timestamp, string symbol, string title, string url, string source, string sentiment, string impact, uint16 votesPos, uint16 votesNeg, uint16 votesImp"
                  description="Individual crypto news articles with sentiment analysis."
                  type="data"
                  comingSoon
                />

                {/* News Aggregate - Data Stream (Coming Soon) */}
                <StreamCard
                  icon="📈"
                  title="News Aggregate"
                  eventId="NewsAggregateV1"
                  schemaId="0xcd70abe18f00ff9fbde632bd8d885314af623f6020e4d73d5f0acd1cfeef8de8"
                  schema="uint64 timestamp, string symbol, int16 sentimentScore, uint16 newsCount, uint16 importantCount, uint64 windowStart, uint64 windowEnd"
                  description="Aggregated news sentiment per symbol over time windows."
                  type="data"
                  comingSoon
                />
              </div>
            </section>

            {/* Section 5: Integration Guide */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Integration Guide</h2>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">1. Installation</h3>
                  <CodeBlock code="npm install @somnia-chain/streams viem" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">2. Read Data (HTTP)</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Use HTTP transport to read historical data from Data Streams.
                  </p>
                  <CodeBlock code={`const { SDK } = require("@somnia-chain/streams");
const { createPublicClient, http, defineChain } = require("viem");

const dreamChain = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";
const PRICE_SCHEMA_ID = "0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd";

async function main() {
  const client = createPublicClient({ chain: dreamChain, transport: http() });
  const sdk = new SDK({ public: client });

  // Get all price data from publisher
  const allData = await sdk.streams.getAllPublisherDataForSchema(
    PRICE_SCHEMA_ID,
    PUBLISHER
  );

  // Decode each record
  for (const dataItem of allData) {
    const fields = dataItem.data ?? dataItem;
    for (const field of fields) {
      const val = field.value?.value ?? field.value;
      console.log(\`\${field.name}: \${val}\`);
    }
  }
}

main();`} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">3. Subscribe to Events (WebSocket)</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Use WebSocket transport for real-time event subscriptions.
                  </p>
                  <CodeBlock code={`const { SDK, SchemaEncoder } = require("@somnia-chain/streams");
const { createPublicClient, webSocket, defineChain } = require("viem");

const dreamChain = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";

async function main() {
  const wsClient = createPublicClient({
    chain: dreamChain,
    transport: webSocket("wss://dream-rpc.somnia.network/ws"),
  });

  const sdk = new SDK({ public: wsClient });
  const encoder = new SchemaEncoder(PRICE_SCHEMA);

  console.log("Subscribing to PriceUpdateV2 events...");

  const subscription = await sdk.streams.subscribe({
    somniaStreamsEventId: "PriceUpdateV2",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data) => {
      try {
        const decoded = encoder.decodeData(data.result.data);
        for (const field of decoded) {
          const val = field.value?.value ?? field.value;
          if (field.name === "symbol") console.log("Symbol:", val);
          if (field.name === "price") {
            const priceUSD = Number(val) / 1e8;
            console.log("Price: $" + priceUSD.toFixed(2));
          }
        }
      } catch (err) {
        console.error("Decode error:", err);
      }
    },
    onError: (err) => console.error("Subscription error:", err),
  });

  // To unsubscribe later: subscription.unsubscribe();
}

main();`} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">4. Polling Pattern</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Simple polling approach if WebSocket is not available.
                  </p>
                  <CodeBlock code={`const seen = new Set();

setInterval(async () => {
  const allData = await sdk.streams.getAllPublisherDataForSchema(
    PRICE_SCHEMA_ID,
    PUBLISHER
  );

  for (const dataItem of allData) {
    const fields = dataItem.data ?? dataItem;
    let timestamp, symbol, price;
    
    for (const field of fields) {
      const val = field.value?.value ?? field.value;
      if (field.name === "timestamp") timestamp = val;
      if (field.name === "symbol") symbol = val;
      if (field.name === "price") price = val;
    }

    const id = \`\${symbol}-\${timestamp}\`;
    if (!seen.has(id)) {
      seen.add(id);
      console.log(\`New: \${symbol} = $\${Number(price) / 1e8}\`);
    }
  }
}, 5000); // Poll every 5 seconds`} />
                </div>
              </div>
            </section>

            {/* Section 6: Schema Reference */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Schema Reference</h2>
              <CodeBlock code={`// Publisher Address
const PUBLISHER = "0xCdBc32445c71a5d0a525060e2760bE6982606F20";

// ============ Data Streams (can read + subscribe) ============

// Price Feed
const PRICE_SCHEMA = "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
const PRICE_SCHEMA_ID = "0x9a5b29643a7b8d2e97b8ae29362f1763ef91ce451ab7f635274bfc5d6ec296dd";
const PRICE_EVENT_ID = "PriceUpdateV2";

// Fear & Greed
const FEAR_GREED_SCHEMA = "uint64 timestamp, uint8 score, string zone, string source, uint64 nextUpdate";
const FEAR_GREED_SCHEMA_ID = "0x2677cc5213165393c4dc709037e567c40b4c5651aa7236bed50b5c79615f690e";
const FEAR_GREED_EVENT_ID = "FearGreedUpdateV1";

// Token Sentiment
const SENTIMENT_SCHEMA = "uint64 timestamp, string symbol, uint16 upPercent, uint16 downPercent, int16 netScore, uint32 sampleSize, string source";
const SENTIMENT_SCHEMA_ID = "0xac6d6a398b120ea9d97cf671eb2d5565c63d1a42fdb4085f6e159bf48120a002";
const SENTIMENT_EVENT_ID = "TokenSentimentUpdateV1";

// News Event (Coming Soon)
const NEWS_SCHEMA_ID = "0x563069d74bccf2f025244f9d6401505b503437075584ee94c9bb436afe2891cd";
const NEWS_EVENT_ID = "NewsEventV1";

// News Aggregate (Coming Soon)
const NEWS_AGG_SCHEMA_ID = "0xcd70abe18f00ff9fbde632bd8d885314af623f6020e4d73d5f0acd1cfeef8de8";
const NEWS_AGG_EVENT_ID = "NewsAggregateV1";

// ============ Event Streams (subscribe only) ============

// Alert Triggered
const ALERT_SCHEMA = "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, uint256 currentPrice, uint64 triggeredAt";
const ALERT_SCHEMA_ID = "0x23a742dfe97765a981a611d4e2a1d911bcc5f683ecfb8704f90cb146e0c29d45";
const ALERT_EVENT_ID = "AlertTriggeredV2";`} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stream Card Component
function StreamCard({
  icon,
  title,
  eventId,
  schemaId,
  schema,
  description,
  type,
  details,
  comingSoon,
}: {
  icon: string;
  title: string;
  eventId: string;
  schemaId: string;
  schema: string;
  description: string;
  type: 'data' | 'event';
  details?: { label: string; value: string }[];
  comingSoon?: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl border bg-white/5 ${comingSoon ? 'border-white/5 opacity-60' : 'border-white/10'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>{icon}</span> {title}
          {comingSoon && (
            <span className="text-[10px] uppercase font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded ml-2">Coming Soon</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${type === 'data' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {type === 'data' ? 'Data Stream' : 'Event Stream'}
          </span>
          <span className="text-xs font-mono bg-white/10 text-slate-300 px-2 py-1 rounded">{eventId}</span>
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-4">{description}</p>
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-slate-500 block text-xs mb-1">Schema ID</span>
          <code className="font-mono text-xs bg-black/40 p-2 rounded text-purple-300 break-all block">
            {schemaId}
          </code>
        </div>
        <div>
          <span className="text-slate-500 block text-xs mb-1">Schema</span>
          <code className="font-mono text-xs bg-black/40 p-2 rounded text-slate-300 break-all block">
            {schema}
          </code>
        </div>
        {details && details.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
            {details.map((detail, i) => (
              <div key={i}>
                <span className="text-slate-500 block text-xs mb-1">{detail.label}</span>
                <span className="text-white text-sm">{detail.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Code Block Component
function CodeBlock({ code }: { code: string }) {
  return (
    <div className="rounded-lg bg-[#0a0a12] border border-white/10 overflow-hidden">
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-sm leading-relaxed text-slate-300">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
