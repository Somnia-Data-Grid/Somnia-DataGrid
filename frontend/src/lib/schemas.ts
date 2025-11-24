import { zeroBytes32 } from "@somnia-chain/streams";

export const PRICE_FEED_SCHEMA =
  "uint64 timestamp, string symbol, uint256 price, uint8 decimals, string source, address sourceAddress";
export const PRICE_FEED_SCHEMA_ID = "defi_price_feed";
export const PRICE_FEED_PARENT = zeroBytes32;
export const PRICE_UPDATE_EVENT_ID = "PriceUpdateV2";

export const ALERT_SCHEMA =
  "bytes32 alertId, address userAddress, string asset, string condition, uint256 thresholdPrice, string status, uint64 createdAt, uint64 triggeredAt";
export const ALERT_SCHEMA_ID = "price_alert";
export const ALERT_PARENT = zeroBytes32;
export const ALERT_TRIGGERED_EVENT_ID = "AlertTriggeredV2";

export type OracleSource = "PROTOFIRE" | "DIA" | "COINGECKO" | "OFFCHAIN";

export interface PriceFeedData {
  timestamp: bigint;
  symbol: string;
  price: bigint;
  decimals: number;
  source: OracleSource;
  sourceAddress: `0x${string}`;
}

export interface AlertData {
  alertId: `0x${string}`;
  userAddress: `0x${string}`;
  asset: string;
  condition: "ABOVE" | "BELOW";
  thresholdPrice: bigint;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  createdAt: bigint;
  triggeredAt: bigint;
}

export function formatPrice(price: bigint, decimals: number, fractionDigits = 2) {
  const divisor = BigInt(10 ** decimals);
  const wholePart = price / divisor;
  const fractionalPart = price % divisor;
  const formattedFraction = fractionalPart
    .toString()
    .padStart(decimals, "0")
    .slice(0, Math.max(fractionDigits, 0));

  return `${wholePart}${fractionDigits ? `.${formattedFraction}` : ""}`;
}

export function parsePrice(priceStr: string, decimals: number): bigint {
  const [whole, fraction = ""] = priceStr.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`);
}

