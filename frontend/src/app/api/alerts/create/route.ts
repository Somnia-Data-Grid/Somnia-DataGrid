import { NextRequest, NextResponse } from "next/server";

const WORKERS_API_URL = process.env.WORKERS_API_URL || "http://localhost:3001";
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { asset, condition, thresholdPrice, userAddress } = body as {
      asset?: string;
      condition?: "ABOVE" | "BELOW";
      thresholdPrice?: string;
      userAddress?: string;
    };

    if (!asset || !condition || !thresholdPrice) {
      return NextResponse.json(
        { success: false, error: "asset, condition and thresholdPrice are required" },
        { status: 400 },
      );
    }

    // Use provided address or fall back to env default
    const walletAddress = userAddress || process.env.ALERT_DEFAULT_USER || process.env.PUBLISHER_ADDRESS;
    
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "No user address provided. Connect wallet or configure ALERT_DEFAULT_USER." },
        { status: 400 },
      );
    }

    // Forward to Workers API (off-chain storage)
    const response = await fetch(`${WORKERS_API_URL}/api/alerts/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WORKERS_API_SECRET && { Authorization: `Bearer ${WORKERS_API_SECRET}` }),
      },
      body: JSON.stringify({
        walletAddress,
        asset,
        condition,
        thresholdPrice,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to create alert");
    }

    return NextResponse.json({
      success: true,
      alertId: data.alert.id,
      alert: data.alert,
    });
  } catch (error) {
    console.error("[API] alert create error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
