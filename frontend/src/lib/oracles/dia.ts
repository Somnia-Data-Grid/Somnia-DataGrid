import { parseAbi, type Address } from "viem";
import { getPublicHttpClient } from "../clients";

const DIA_ORACLE_V2_ABI = parseAbi([
  "function getValue(string key) external view returns (uint128 price, uint128 timestamp)",
]);

const DIA_ADAPTER_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const DIA_ORACLE_ADDRESS =
  "0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D" as const;

// DIA Adapter addresses on Somnia Testnet
// Source: https://docs.somnia.network/somnia-devnet/oracles/dia-price-feeds
export const DIA_ADAPTERS = {
  "BTC/USD": "0x4803db1ca3A1DA49c3DB991e1c390321c20e1f21",
  "USDT/USD": "0x67d2C2a87A17b7267a6DBb1A59575C0E9A1D1c3e",
  "USDC/USD": "0x235266D5ca6f19F134421C49834C108b32C2124e",
  "ARB/USD": "0x74952812B6a9e4f826b2969C6D189c4425CBc19B",
  "SOL/USD": "0xD5Ea6C434582F827303423dA21729bEa4F87D519",
  "WETH/USD": "0x786c7893F8c26b80d42088749562eDb50Ba9601E",
  "SOMI/USD": "0xaEAa92c38939775d3be39fFA832A92611f7D6aDe",
} as const;

export const DIA_ASSET_KEYS = {
  BTC: "BTC/USD",
  USDT: "USDT/USD",
  USDC: "USDC/USD",
  ARB: "ARB/USD",
  SOL: "SOL/USD",
  WETH: "WETH/USD",
  SOMI: "SOMI/USD",    // Somnia token (available on DIA)
  ETH: "WETH/USD",     // ETH uses WETH price feed
} as const;

const DIA_SYMBOL_ALIASES = {
  ETH: "WETH",
} as const;

type DiaBaseSymbol = keyof typeof DIA_ASSET_KEYS;
type DiaAliasMap = typeof DIA_SYMBOL_ALIASES;
type DiaAdapterKey = keyof typeof DIA_ADAPTERS;

function hasOwnProperty<T extends object>(obj: T, prop: PropertyKey): prop is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function normalizeDiaSymbol(symbol: string): DiaBaseSymbol | undefined {
  const upper = symbol.toUpperCase();
  const alias =
    hasOwnProperty(DIA_SYMBOL_ALIASES, upper) ? DIA_SYMBOL_ALIASES[upper as keyof DiaAliasMap] : upper;
  if (hasOwnProperty(DIA_ASSET_KEYS, alias)) {
    return alias as DiaBaseSymbol;
  }
  return undefined;
}

export function getDiaKeyForSymbol(symbol: string): string | undefined {
  const normalized = normalizeDiaSymbol(symbol);
  return normalized ? DIA_ASSET_KEYS[normalized] : undefined;
}

export function getDiaAdapterSymbol(symbol: string): DiaAdapterKey | undefined {
  const normalized = normalizeDiaSymbol(symbol);
  const candidate = normalized ? `${normalized}/USD` : `${symbol.toUpperCase()}/USD`;
  if (hasOwnProperty(DIA_ADAPTERS, candidate)) {
    return candidate as DiaAdapterKey;
  }
  return undefined;
}

export interface DIAPrice {
  symbol: string;
  price: bigint;
  decimals: number;
  timestamp: bigint;
  oracleAddress: Address;
}

export async function fetchDIAPrice(assetKey: string): Promise<DIAPrice> {
  const client = getPublicHttpClient();

  const [price, timestamp] = await client.readContract({
    address: DIA_ORACLE_ADDRESS,
    abi: DIA_ORACLE_V2_ABI,
    functionName: "getValue",
    args: [assetKey],
  });

  const symbol = assetKey.split("/")[0];

  return {
    symbol,
    price: BigInt(price),
    decimals: 8,
    timestamp: BigInt(timestamp),
    oracleAddress: DIA_ORACLE_ADDRESS,
  };
}

export async function fetchDIAPriceViaAdapter(
  symbol: keyof typeof DIA_ADAPTERS,
): Promise<DIAPrice> {
  const adapter = DIA_ADAPTERS[symbol];
  if (!adapter) {
    throw new Error(`No DIA adapter configured for ${symbol}`);
  }

  const client = getPublicHttpClient();
  const [roundData] = await Promise.all([
    client.readContract({
      address: adapter,
      abi: DIA_ADAPTER_ABI,
      functionName: "latestRoundData",
    }),
  ]);

  const [, answer, , updatedAt] = roundData;

  return {
    symbol: symbol.split("/")[0],
    price: answer < 0n ? -answer : answer,
    decimals: 8,
    timestamp: updatedAt,
    oracleAddress: adapter,
  };
}

export async function fetchAllDIAPrices(): Promise<DIAPrice[]> {
  const keys = Object.values(DIA_ASSET_KEYS);
  return Promise.all(keys.map(fetchDIAPrice));
}

export function isDIASupported(symbol: string) {
  return Boolean(getDiaKeyForSymbol(symbol) ?? getDiaAdapterSymbol(symbol));
}

