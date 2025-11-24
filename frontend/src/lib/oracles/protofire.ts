import { parseAbi, type Address } from "viem";
import { getPublicHttpClient } from "../clients";

const AGGREGATOR_V3_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
]);

export const PROTOFIRE_ORACLES = {
  "BTC/USD": "0x3dF17dbaa3BA861D03772b501ADB343B4326C676",
  "ETH/USD": "0x604CF5063eC760A78d1C089AA55dFf29B90937f9",
  "USDC/USD": "0xA4a08Eb26f85A53d40E3f908B406b2a69B1A2441",
} as const;

export interface ProtofirePrice {
  symbol: string;
  price: bigint;
  decimals: number;
  timestamp: bigint;
  roundId: bigint;
  oracleAddress: Address;
}

export async function fetchProtofirePrice(
  symbol: keyof typeof PROTOFIRE_ORACLES,
): Promise<ProtofirePrice> {
  const oracleAddress = PROTOFIRE_ORACLES[symbol];

  if (!oracleAddress) {
    throw new Error(`No Protofire oracle configured for ${symbol}`);
  }

  const client = getPublicHttpClient();

  const [roundData, decimals] = await Promise.all([
    client.readContract({
      address: oracleAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: "latestRoundData",
    }),
    client.readContract({
      address: oracleAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: "decimals",
    }),
  ]);

  const [roundId, answer, , updatedAt] = roundData;
  const price = answer < 0n ? -answer : answer;

  return {
    symbol: symbol.split("/")[0],
    price,
    decimals: Number(decimals),
    timestamp: updatedAt,
    roundId,
    oracleAddress,
  };
}

export async function fetchAllProtofirePrices(): Promise<ProtofirePrice[]> {
  const symbols = Object.keys(PROTOFIRE_ORACLES) as Array<
    keyof typeof PROTOFIRE_ORACLES
  >;
  return Promise.all(symbols.map(fetchProtofirePrice));
}

export function isProtofireSupported(symbol: string): symbol is keyof typeof PROTOFIRE_ORACLES {
  return Object.prototype.hasOwnProperty.call(PROTOFIRE_ORACLES, symbol);
}

