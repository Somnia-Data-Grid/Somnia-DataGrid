import { NextRequest, NextResponse } from "next/server";
import { checkAlerts } from "@/lib/services/alertService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, price } = body as { symbol?: string; price?: string };

    if (!symbol || !price) {
      return NextResponse.json(
        {
          success: false,
          error: "symbol and price are required",
        },
        { status: 400 },
      );
    }

    const triggered = await checkAlerts(symbol, BigInt(price));

    return NextResponse.json({
      success: true,
      triggered,
    });
  } catch (error) {
    console.error("[API] alert check error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

