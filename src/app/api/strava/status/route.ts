import { NextResponse } from "next/server";
import { getTokenRecord, listUnmatched } from "@/lib/strava";

// Import ensureBootstrapped via the same module — inline to avoid circular deps
import { getValidAccessToken as _bootstrap } from "@/lib/strava";

export const dynamic = "force-dynamic";

export async function GET() {
  // Seed DynamoDB from STRAVA_REFRESH_TOKEN env var on first call (no-op if already stored)
  try {
    const existing = await getTokenRecord();
    if (!existing && process.env.STRAVA_REFRESH_TOKEN) {
      // Trigger bootstrap by attempting to get a token — this writes the record to DynamoDB
      await _bootstrap();
    }
  } catch {
    // Ignore — if refresh fails the status just shows connected:false
  }

  const [token, unmatched] = await Promise.all([getTokenRecord(), listUnmatched()]);

  const connected = !!token?.refresh_token;
  const lastSyncAt = token?.lastSyncEpoch
    ? new Date(token.lastSyncEpoch * 1000).toISOString()
    : null;

  return NextResponse.json({
    connected,
    lastSyncAt,
    unmatchedCount: unmatched.length,
  });
}
