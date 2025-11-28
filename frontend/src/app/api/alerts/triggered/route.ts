import { NextRequest, NextResponse } from "next/server";

const WORKERS_API_URL = process.env.WORKERS_API_URL || "http://localhost:3001";
const WORKERS_API_SECRET = process.env.WORKERS_API_SECRET;

interface TriggeredAlert {
  alertId: string;
  asset: string;
  condition: string;
  thresholdPrice: string;
  currentPrice: string;
  triggeredAt: number;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const wallet = params.get("wallet");
    const sinceParam = params.get("since");
    const since = sinceParam ? parseInt(sinceParam, 10) : 0;
    const sinceTimestamp = Math.floor(since / 1000); // Convert ms to seconds

    // Fetch alerts from Workers API
    const url = new URL(`${WORKERS_API_URL}/api/alerts`);
    if (wallet) {
      url.searchParams.set("wallet", wallet);
    }

    const response = await fetch(url.toString(), {
      headers: {
        ...(WORKERS_API_SECRET && { Authorization: `Bearer ${WORKERS_API_SECRET}` }),
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch alerts");
    }

    // Filter to only triggered alerts
    const triggeredAlerts: TriggeredAlert[] = (data.alerts || [])
      .filter((alert: any) => alert.status === "TRIGGERED")
      .filter((alert: any) => {
        // Only return alerts triggered after the 'since' timestamp
        if (sinceTimestamp > 0 && alert.triggered_at <= sinceTimestamp) {
          return false;
        }
        return true;
      })
      .map((alert: any) => ({
        alertId: alert.id,
        asset: alert.asset,
        condition: alert.condition,
        thresholdPrice: alert.threshold_price,
        currentPrice: alert.threshold_price, // Fallback - actual price not stored in DB
        triggeredAt: alert.triggered_at,
      }))
      .sort((a: TriggeredAlert, b: TriggeredAlert) => b.triggeredAt - a.triggeredAt)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      alerts: triggeredAlerts,
    });
  } catch (error) {
    console.error("[API] triggered alerts error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
