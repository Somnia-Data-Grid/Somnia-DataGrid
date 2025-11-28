import { NextResponse } from "next/server";

/**
 * This endpoint is deprecated.
 * Alert checking is now handled by the Workers service automatically
 * when prices are published.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Alert checking is now handled automatically by the Workers service",
      message: "This endpoint is deprecated. Alerts are checked automatically when prices are published.",
    },
    { status: 410 }, // Gone
  );
}
