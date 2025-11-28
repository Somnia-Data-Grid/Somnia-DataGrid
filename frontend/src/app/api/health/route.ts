import { NextResponse } from "next/server";

const WORKERS_API_URL = process.env.WORKERS_API_URL || "http://localhost:3001";

export async function GET() {
  const frontendStatus = {
    status: "ok",
    timestamp: Date.now(),
    service: "frontend",
    version: "1.0.0",
  };

  // Try to get workers health
  let workersStatus = null;
  try {
    const response = await fetch(`${WORKERS_API_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      workersStatus = await response.json();
    }
  } catch {
    workersStatus = { status: "unreachable" };
  }

  return NextResponse.json({
    ...frontendStatus,
    workers: workersStatus,
    environment: {
      workersUrl: WORKERS_API_URL,
      hasWorkersSecret: !!process.env.WORKERS_API_SECRET,
    },
  });
}
