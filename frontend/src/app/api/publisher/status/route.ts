import { NextResponse } from "next/server";
import { getAutoPublisherStatus, initAutoPublisher, stopAutoPublisher } from "@/lib/services/autoPublisher";

export async function GET() {
  const status = getAutoPublisherStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: "start" | "stop" };

    if (action === "start") {
      await initAutoPublisher();
      return NextResponse.json({ success: true, message: "Auto publisher started" });
    } else if (action === "stop") {
      stopAutoPublisher();
      return NextResponse.json({ success: true, message: "Auto publisher stopped" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'start' or 'stop'" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

