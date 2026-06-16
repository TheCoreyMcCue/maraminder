import { NextRequest, NextResponse } from "next/server";
import { listUnmatched, deleteUnmatched, STRAVA_PK } from "@/lib/strava";
import { logActual } from "@/lib/planOps";
import { planPk } from "@/lib/activePlan";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "@/lib/db";
import type { StravaUnmatched } from "@/lib/strava";

export const dynamic = "force-dynamic";

// GET — list all unmatched imports
export async function GET() {
  const items = await listUnmatched();
  return NextResponse.json(items);
}

// POST — apply or dismiss an unmatched import
// Body: { action: "match", activityId: number, planId: string, sessionSk: string }
//       { action: "dismiss", activityId: number }
export async function POST(req: NextRequest) {
  let body: { action: string; activityId: number; planId?: string; sessionSk?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, activityId } = body;
  if (!action || !activityId) {
    return NextResponse.json({ error: "action and activityId required" }, { status: 400 });
  }

  if (action === "dismiss") {
    await deleteUnmatched(activityId);
    return NextResponse.json({ ok: true });
  }

  if (action === "match") {
    const { planId, sessionSk } = body;
    if (!planId || !sessionSk) {
      return NextResponse.json({ error: "planId and sessionSk required for match" }, { status: 400 });
    }

    // Load the unmatched record to get activity data
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: STRAVA_PK, sk: `UNMATCHED#${activityId}` },
      })
    );
    if (!result.Item) {
      return NextResponse.json({ error: "Unmatched import not found" }, { status: 404 });
    }
    const item = result.Item as StravaUnmatched;

    const actual = {
      distanceKm: item.distanceKm,
      durationMin: item.durationMin,
      avgPacePerKm: item.avgPacePerKm ?? undefined,
      avgHr: item.avgHr ?? undefined,
      stravaUrl: item.stravaUrl,
      stravaActivityId: item.activityId,
    };

    await logActual(planPk(planId), sessionSk, actual);

    // Remove from unmatched queue
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: STRAVA_PK, sk: `UNMATCHED#${activityId}` },
      })
    );

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
