import { NextRequest, NextResponse } from "next/server";
import { SDK } from "@somnia-chain/streams";
import { getPublicHttpClient, getPublisherAddress } from "@/lib/clients";
import { ALERT_SCHEMA } from "@/lib/schemas";
import { extractFieldValue } from "@/lib/utils/streams";

interface TriggeredAlert {
  alertId: string;
  asset: string;
  condition: string;
  thresholdPrice: string;
  triggeredAt: number;
}

function initReadOnlySdk() {
  return new SDK({
    public: getPublicHttpClient(),
  });
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const sinceParam = params.get("since");
    const since = sinceParam ? parseInt(sinceParam, 10) : 0;
    const sinceTimestamp = Math.floor(since / 1000); // Convert ms to seconds

    const sdk = initReadOnlySdk();
    const schemaIdResult = await sdk.streams.computeSchemaId(ALERT_SCHEMA);
    if (schemaIdResult instanceof Error) {
      throw schemaIdResult;
    }
    const schemaId = schemaIdResult as `0x${string}`;
    const publisher = getPublisherAddress() as `0x${string}`;
    
    const rawData = await sdk.streams.getAllPublisherDataForSchema(
      schemaId,
      publisher,
    );

    if (rawData instanceof Error || !rawData?.length) {
      return NextResponse.json({ success: true, alerts: [] });
    }

    const triggeredAlerts: TriggeredAlert[] = [];

    for (const record of rawData) {
      if (!Array.isArray(record) || record.length < 8) continue;

      try {
        const status = String(extractFieldValue(record[5]));
        if (status !== "TRIGGERED") continue;

        const triggeredAt = Number(extractFieldValue(record[7]));
        
        // Only return alerts triggered after the 'since' timestamp
        if (sinceTimestamp > 0 && triggeredAt <= sinceTimestamp) continue;

        const thresholdRaw = BigInt(extractFieldValue(record[4]) as string | number | bigint);
        
        triggeredAlerts.push({
          alertId: String(extractFieldValue(record[0])),
          asset: String(extractFieldValue(record[2])),
          condition: String(extractFieldValue(record[3])),
          thresholdPrice: thresholdRaw.toString(),
          triggeredAt,
        });
      } catch (e) {
        console.warn("[API] Failed to decode alert record:", e);
      }
    }

    // Sort by triggeredAt descending (most recent first)
    triggeredAlerts.sort((a, b) => b.triggeredAt - a.triggeredAt);

    return NextResponse.json({
      success: true,
      alerts: triggeredAlerts.slice(0, 10), // Limit to 10 most recent
    });
  } catch (error) {
    console.error("[API] triggered alerts error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
