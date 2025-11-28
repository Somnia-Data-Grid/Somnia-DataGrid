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

    let data: { success: boolean; alerts?: any[]; error?: string };
    
    try {
      const response = await fetch(url.toString(), {
        headers: {
          ...(WORKERS_API_SECRET && { Authorization: `Bearer ${WORKERS_API_SECRET}` }),
        },
        // Short timeout for polling endpoint
        signal: AbortSignal.timeout(5000),
      });

      data = await response.json();

      if (!response.ok || !data.success) {
        // Workers API error - return empty result instead of 500
        return NextResponse.json({ success: true, alerts: [] });
      }
    } catch {
      // Workers API unreachable - return empty result
      return NextResponse.json({ success: true, alerts: [] });
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
  } catch {
    // Return empty result on any error - this is a polling endpoint
    return NextResponse.json({ success: true, alerts: [] });
  }
}
