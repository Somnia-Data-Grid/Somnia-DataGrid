import { SDK } from "@somnia-chain/streams";
import { getPublicHttpClient, getPublisherAddress } from "../clients";
import { PRICE_FEED_SCHEMA, type PriceFeedData } from "../schemas";
import { extractFieldValue } from "../utils/streams";

function initReadOnlySdk() {
  return new SDK({
    public: getPublicHttpClient(),
  });
}

function decodePrice(record: unknown[]): PriceFeedData {
  if (record.length < 6) {
    throw new Error("Malformed price record");
  }

  const extractBigInt = (val: unknown): bigint => BigInt(val as string | number | bigint);

  return {
    timestamp: extractBigInt(extractFieldValue(record[0])),
    symbol: String(extractFieldValue(record[1])),
    price: extractBigInt(extractFieldValue(record[2])),
    decimals: Number(extractFieldValue(record[3]) as string | number),
    source: String(extractFieldValue(record[4])) as PriceFeedData["source"],
    sourceAddress: extractFieldValue(record[5]) as `0x${string}`,
  };
}

export async function getLatestPrice(symbol: string): Promise<PriceFeedData | null> {
  try {
    const sdk = initReadOnlySdk();
    const schemaIdResult = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);
    if (schemaIdResult instanceof Error) {
      throw schemaIdResult;
    }
    const schemaId = schemaIdResult as `0x${string}`;
    const publisher = getPublisherAddress() as `0x${string}`;
    const rawData = await sdk.streams.getLastPublishedDataForSchema(
      schemaId,
      publisher,
    );

    if (rawData instanceof Error || !rawData?.length) {
      return null;
    }

    const first = rawData[0];
    if (!Array.isArray(first)) {
      return null;
    }

    const latest = decodePrice(first as unknown[]);
    return latest.symbol === symbol ? latest : null;
  } catch (error) {
    console.error(`[Reader] Failed to get latest ${symbol} price`, error);
    return null;
  }
}

export async function getAllPrices(): Promise<PriceFeedData[]> {
  try {
    const sdk = initReadOnlySdk();
    const schemaIdResult = await sdk.streams.computeSchemaId(PRICE_FEED_SCHEMA);
    if (schemaIdResult instanceof Error) {
      throw schemaIdResult;
    }
    const schemaId = schemaIdResult as `0x${string}`;
    const publisher = getPublisherAddress() as `0x${string}`;
    const rawData = await sdk.streams.getAllPublisherDataForSchema(
      schemaId,
      publisher,
    );

    if (rawData instanceof Error || !rawData?.length) {
      return [];
    }

    const decoded: PriceFeedData[] = [];
    for (const record of rawData) {
      if (Array.isArray(record)) {
        try {
          decoded.push(decodePrice(record as unknown[]));
        } catch {
          // Skip malformed records
        }
      }
    }
    decoded.sort((a, b) => Number(b.timestamp - a.timestamp));
    return decoded;
  } catch (error) {
    console.error("[Reader] Failed to load prices", error);
    return [];
  }
}

export async function getLatestPriceForEachAsset() {
  const all = await getAllPrices();
  const latest = new Map<string, PriceFeedData>();

  for (const price of all) {
    if (!latest.has(price.symbol)) {
      latest.set(price.symbol, price);
    }
  }

  return latest;
}

export async function getPriceHistory(symbol: string, limit = 100) {
  const all = await getAllPrices();
  return all.filter((price) => price.symbol === symbol).slice(0, limit);
}

