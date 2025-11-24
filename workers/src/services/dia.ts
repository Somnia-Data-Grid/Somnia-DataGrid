/**
 * DIA Oracle Client for Workers
 * 
 * Fetches prices from DIA Oracle on Somnia Testnet.
 * Used for assets not available on CoinGecko (like STT/SOMI).
 */

import { createPublicClient, http, parseAbi } from "viem";

// Somnia Testnet Chain
const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
} as const;

// DIA Oracle V2 ABI
const DIA_ORACLE_V2_ABI = parseAbi([
  "function getValue(string key) external view returns (uint128 price, uint128 timestamp)",
]);

// DIA Oracle address on Somnia Testnet
export const DIA_ORACLE_ADDRESS = "0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D" as const;

// DIA asset keys mapping
// Based on official Somnia DIA Oracle documentation
export const DIA_ASSET_KEYS: Record<string, string> = {
  // Officially supported on Somnia Testnet DIA Oracle
  BTC: "BTC/USD",
  WETH: "WETH/USD",
  USDT: "USDT/USD",
  USDC: "USDC/USD",
  ARB: "ARB/USD",
  SOL: "SOL/USD",
  SOMI: "SOMI/USD",    // Somnia token (testnet & mainnet)
  
  // Aliases
  ETH: "WETH/USD",     // ETH uses WETH price feed
};

// DIA Adapter addresses on Somnia Testnet (for reference)
export const DIA_ADAPTERS_TESTNET: Record<string, string> = {
  "BTC/USD": "0x4803db1ca3A1DA49c3DB991e1c390321c20e1f21",
  "USDT/USD": "0x67d2C2a87A17b7267a6DBb1A59575C0E9A1D1c3e",
  "USDC/USD": "0x235266D5ca6f19F134421C49834C108b32C2124e",
  "ARB/USD": "0x74952812B6a9e4f826b2969C6D189c4425CBc19B",
  "SOL/USD": "0xD5Ea6C434582F827303423dA21729bEa4F87D519",
  "WETH/USD": "0x786c7893F8c26b80d42088749562eDb50Ba9601E",
  "SOMI/USD": "0xaEAa92c38939775d3be39fFA832A92611f7D6aDe",
};

// Assets that should ONLY use DIA (not available on CoinGecko)
// Note: SOMI is the Somnia token available on DIA
// STT (testnet native token) is NOT in DIA oracle - it's the gas token, not a price feed
export const DIA_ONLY_ASSETS = ["SOMI"];

interface DIAPrice {
  symbol: string;
  price: bigint;
  timestamp: bigint;
  decimals: number;
  source: "DIA";
}

class DIAClient {
  private client;
  private enabled: boolean;

  constructor() {
    const rpcUrl = process.env.RPC_URL || "https://dream-rpc.somnia.network";
    this.client = createPublicClient({
      chain: somniaTestnet,
      transport: http(rpcUrl),
    });
    
    // Check if DIA is enabled
    this.enabled = process.env.ENABLE_DIA !== "false";
    
    if (this.enabled) {
      console.log("[DIA] Oracle client initialized");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async fetchPrice(symbol: string): Promise<DIAPrice | null> {
    if (!this.enabled) return null;
    
    const assetKey = DIA_ASSET_KEYS[symbol.toUpperCase()];
    if (!assetKey) {
      console.warn(`[DIA] No asset key for ${symbol}`);
      return null;
    }

    try {
      const [price, timestamp] = await this.client.readContract({
        address: DIA_ORACLE_ADDRESS,
        abi: DIA_ORACLE_V2_ABI,
        functionName: "getValue",
        args: [assetKey],
      });

      // DIA returns 0 for unsupported assets
      if (price === 0n) {
        console.warn(`[DIA] No price data for ${symbol}`);
        return null;
      }

      return {
        symbol: symbol.toUpperCase(),
        price: BigInt(price),
        timestamp: BigInt(timestamp),
        decimals: 8, // DIA uses 8 decimals
        source: "DIA",
      };
    } catch (error) {
      console.error(`[DIA] Failed to fetch ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  async fetchPrices(symbols: string[]): Promise<Map<string, { price: bigint; timestamp: bigint }>> {
    const results = new Map<string, { price: bigint; timestamp: bigint }>();
    
    if (!this.enabled) return results;

    // Filter to only DIA-supported symbols
    const diaSymbols = symbols.filter(s => DIA_ASSET_KEYS[s.toUpperCase()]);
    
    if (diaSymbols.length === 0) return results;

    console.log(`[DIA] Fetching prices for ${diaSymbols.join(", ")}...`);

    // Fetch prices in parallel
    const promises = diaSymbols.map(async (symbol) => {
      const price = await this.fetchPrice(symbol);
      if (price) {
        results.set(symbol.toUpperCase(), {
          price: price.price,
          timestamp: price.timestamp,
        });
      }
    });

    await Promise.all(promises);
    
    console.log(`[DIA] Fetched ${results.size}/${diaSymbols.length} prices`);
    return results;
  }

  // Test connectivity
  async ping(): Promise<boolean> {
    if (!this.enabled) return false;
    
    try {
      // Try to fetch BTC price as a test
      const [price] = await this.client.readContract({
        address: DIA_ORACLE_ADDRESS,
        abi: DIA_ORACLE_V2_ABI,
        functionName: "getValue",
        args: ["BTC/USD"],
      });
      return price > 0n;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const diaClient = new DIAClient();
