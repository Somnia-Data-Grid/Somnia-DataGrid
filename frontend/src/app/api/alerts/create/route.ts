import { NextRequest, NextResponse } from "next/server";
import { createAlert, registerAlertSchema } from "@/lib/services/alertService";

function getDefaultUserAddress(): `0x${string}` | null {
  const address = process.env.ALERT_DEFAULT_USER ?? process.env.PUBLISHER_ADDRESS;
  
  // Validate it's actually an address (starts with 0x and is 42 chars)
  if (address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    return address as `0x${string}`;
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await registerAlertSchema();
    const body = await request.json();
    const { asset, condition, thresholdPrice, userAddress } = body as {
      asset?: string;
      condition?: "ABOVE" | "BELOW";
      thresholdPrice?: string;
      userAddress?: `0x${string}`;
    };

    if (!asset || !condition || !thresholdPrice) {
      return NextResponse.json(
        {
          success: false,
          error: "asset, condition and thresholdPrice are required",
        },
        { status: 400 },
      );
    }

    const address = userAddress ?? getDefaultUserAddress();
    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "No user address provided. Connect wallet or configure ALERT_DEFAULT_USER.",
        },
        { status: 400 },
      );
    }

    const threshold = BigInt(thresholdPrice);

    const { alertId, txHash } = await createAlert({
      userAddress: address,
      asset,
      condition,
      thresholdPrice: threshold,
    });

    return NextResponse.json({
      success: true,
      alertId,
      txHash,
    });
  } catch (error) {
    console.error("[API] alert create error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

