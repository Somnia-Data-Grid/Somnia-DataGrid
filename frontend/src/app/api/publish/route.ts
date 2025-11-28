import { NextRequest, NextResponse } from "next/server";
import {
  publishAllPrices,
  publishPrice,
  registerPriceFeedSchema,
} from "@/lib/services/pricePublisher";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Somnia publisher is ready",
  });
}

export async function POST(request: NextRequest) {
  try {
    await registerPriceFeedSchema();

    const body = await request.json().catch(() => ({}));
    const { symbol } = body as { symbol?: string };

    const txHashes = symbol
      ? [await publishPrice(symbol)]
      : await publishAllPrices();

    return NextResponse.json({
      success: true,
      txHashes,
      message: `Published ${txHashes.length} price${txHashes.length === 1 ? "" : "s"}`,
    });
  } catch (error) {
    console.error("[API] publish error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

