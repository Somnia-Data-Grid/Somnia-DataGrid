import { NextRequest, NextResponse } from "next/server";

const WORKERS_API_URL = process.env.WORKERS_API_URL || "http://localhost:3001";
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

/**
 * GET /api/alerts?wallet=0x...
 * Returns all alerts for a wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const wallet = params.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet query param required" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${WORKERS_API_URL}/api/alerts?wallet=${encodeURIComponent(wallet)}`,
      {
        headers: {
          ...(WORKERS_API_SECRET && { Authorization: `Bearer ${WORKERS_API_SECRET}` }),
        },
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch alerts");
    }

    return NextResponse.json({
      success: true,
      alerts: data.alerts || [],
    });
  } catch (error) {
    console.error("[API] alerts list error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/alerts
 * Body: { alertId: string }
 * Deletes an alert
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body as { alertId?: string };

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: "alertId required" },
        { status: 400 },
      );
    }

    const response = await fetch(`${WORKERS_API_URL}/api/alerts/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WORKERS_API_SECRET && { Authorization: `Bearer ${WORKERS_API_SECRET}` }),
      },
      body: JSON.stringify({ alertId }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to delete alert");
    }

    return NextResponse.json({
      success: true,
      deleted: data.deleted,
    });
  } catch (error) {
    console.error("[API] alert delete error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
