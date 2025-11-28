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
    const sinceParam = params.get("since");
    const since = sinceParam ? Math.floor(parseInt(sinceParam, 10) / 1000) : 0; // Convert ms to seconds

    // Fetch recently triggered alerts from Workers API
    const url = new URL(`${WORKERS_API_URL}/api/alerts/triggered`);
    url.searchParams.set("since", String(since));

    let data: { success: boolean; alerts?: any[]; error?: string };
    
    try {
      const response = await fetch(url.toString(), {
        headers: {
          ...(WORKERS_API_SECRET && { Authorization: `Bearer ${WORKERS_API_SECRET}` }),
        },
        signal: AbortSignal.timeout(5000),
      });

      data = await response.json();

      if (!response.ok || !data.success) {
        return NextResponse.json({ success: true, alerts: [] });
      }
    } catch {
      return NextResponse.json({ success: true, alerts: [] });
    }

    // Map to frontend format
    const triggeredAlerts: TriggeredAlert[] = (data.alerts || [])
      .map((alert: any) => ({
        alertId: alert.id,
        asset: alert.asset,
        condition: alert.condition,
        thresholdPrice: alert.threshold_price,
        currentPrice: alert.threshold_price,
        triggeredAt: alert.triggered_at,
      }))
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      alerts: triggeredAlerts,
    });
  } catch {
    return NextResponse.json({ success: true, alerts: [] });
  }
}
