import { NextRequest, NextResponse } from "next/server";
import {
  getAllPrices,
  getLatestPrice,
  getLatestPriceForEachAsset,
} from "@/lib/services/priceReader";
import { formatPrice } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const symbol = params.get("symbol");
    const all = params.get("all") === "true";

    if (symbol) {
      const price = await getLatestPrice(symbol);
      if (!price) {
        return NextResponse.json(
          {
            success: false,
            error: `No price found for ${symbol}`,
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        price: {
          symbol: price.symbol,
          price: formatPrice(price.price, price.decimals),
          priceRaw: price.price.toString(),
          decimals: price.decimals,
          source: price.source,
          timestamp: Number(price.timestamp),
          sourceAddress: price.sourceAddress,
        },
      });
    }

    if (all) {
      const prices = await getAllPrices();
      return NextResponse.json({
        success: true,
        count: prices.length,
        prices: prices.map((p) => ({
          symbol: p.symbol,
          price: formatPrice(p.price, p.decimals),
          priceRaw: p.price.toString(),
          decimals: p.decimals,
          source: p.source,
          timestamp: Number(p.timestamp),
          sourceAddress: p.sourceAddress,
        })),
      });
    }

    const latest = await getLatestPriceForEachAsset();
    return NextResponse.json({
      success: true,
      prices: Array.from(latest.values()).map((p) => ({
        symbol: p.symbol,
        price: formatPrice(p.price, p.decimals),
        priceRaw: p.price.toString(),
        decimals: p.decimals,
        source: p.source,
        timestamp: Number(p.timestamp),
        sourceAddress: p.sourceAddress,
      })),
    });
  } catch (error) {
    console.error("[API] prices error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

