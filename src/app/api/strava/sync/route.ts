import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "@/lib/db";
import { PLANS, planPk } from "@/lib/activePlan";
import { logActual } from "@/lib/planOps";
import {
  getTokenRecord,
  stravaFetch,
  updateLastSyncEpoch,
  STRAVA_PK,
} from "@/lib/strava";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

// ── Strava activity shape (fields we care about) ──────────────────────────────

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string; // "2026-06-15T07:30:00Z" in athlete local time
  distance: number; // metres
  moving_time: number; // seconds
  average_heartrate?: number;
  average_watts?: number;
  average_speed: number; // m/s
  start_date: string; // UTC ISO — used for lastSyncEpoch
}

// ── Category matching ─────────────────────────────────────────────────────────

const RUN_CATEGORIES = new Set(["easy", "steady", "mp", "threshold", "vo2", "long", "race"]);
const BIKE_CATEGORIES = new Set(["bike"]);

function stravaTypeToCategory(activity: StravaActivity): "run" | "bike" | null {
  const t = (activity.sport_type ?? activity.type ?? "").toLowerCase();
  if (t === "run" || t === "trailrun" || t === "virtualrun") return "run";
  if (t === "ride" || t === "virtualride" || t === "ebikeride" || t === "mountainbikeride") return "bike";
  return null;
}

// ── Pace formatter ────────────────────────────────────────────────────────────

function paceFromActivity(activity: StravaActivity): string | undefined {
  if (!activity.distance || !activity.moving_time) return undefined;
  const secPerKm = activity.moving_time / (activity.distance / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Query all plan sessions ───────────────────────────────────────────────────

async function fetchAllSessions(): Promise<Map<string, Session[]>> {
  const results = await Promise.all(
    PLANS.map(async (p) => {
      const r = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :pfx)",
          ExpressionAttributeValues: {
            ":pk": planPk(p.id),
            ":pfx": "WEEK#",
          },
        })
      );
      const sessions = (r.Items ?? []).filter((item) =>
        /^WEEK#\d+#SES#/.test(item.sk as string)
      ) as Session[];
      return { planId: p.id, sessions };
    })
  );

  const map = new Map<string, Session[]>();
  for (const { planId, sessions } of results) {
    map.set(planId, sessions);
  }
  return map;
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function runSync(): Promise<{
  matched: number;
  unmatched: number;
  skipped: number;
  total: number;
}> {
  const token = await getTokenRecord();
  if (!token) throw new Error("Strava not connected");

  const lastSyncEpoch = token.lastSyncEpoch ?? 0;

  // Fetch activities after lastSyncEpoch (newest first, one page)
  const activities = await stravaFetch<StravaActivity[]>("/athlete/activities", {
    after: lastSyncEpoch,
    per_page: 50,
  });

  if (!activities.length) {
    return { matched: 0, unmatched: 0, skipped: 0, total: 0 };
  }

  const sessionsByPlan = await fetchAllSessions();

  let matched = 0, unmatched = 0, skipped = 0;
  const now = new Date().toISOString();

  for (const activity of activities) {
    const localDate = activity.start_date_local.slice(0, 10);
    const broadType = stravaTypeToCategory(activity);
    if (!broadType) { skipped++; continue; }

    // Find candidate planned sessions across all plans
    const candidates: Array<{ planId: string; session: Session }> = [];
    for (const [planId, sessions] of sessionsByPlan) {
      for (const s of sessions) {
        if (s.date !== localDate) continue;
        if (s.status !== "planned") continue;
        const matchesCat =
          (broadType === "run" && RUN_CATEGORIES.has(s.category)) ||
          (broadType === "bike" && BIKE_CATEGORIES.has(s.category));
        if (!matchesCat) continue;
        // Dedup: skip if this activity is already logged on this session
        if ((s.actual as { stravaActivityId?: number } | null)?.stravaActivityId === activity.id) {
          skipped++;
          continue;
        }
        candidates.push({ planId, session: s });
      }
    }

    if (candidates.length === 1) {
      // Clean match — auto-apply
      const { planId, session } = candidates[0];
      const actual = {
        distanceKm: parseFloat((activity.distance / 1000).toFixed(3)),
        durationMin: parseFloat((activity.moving_time / 60).toFixed(1)),
        avgPacePerKm: broadType === "run" ? paceFromActivity(activity) : undefined,
        avgHr: activity.average_heartrate ?? undefined,
        avgPowerW: activity.average_watts ?? undefined,
        stravaUrl: `https://www.strava.com/activities/${activity.id}`,
        stravaActivityId: activity.id,
      };
      try {
        await logActual(planPk(planId), session.sk, actual);
        matched++;
      } catch (err) {
        console.error(`[strava/sync] logActual failed for activity ${activity.id}:`, err);
        skipped++;
      }
    } else {
      // Zero or multiple matches — queue for review
      const candidateInfo = candidates.map((c) => ({
        planId: c.planId,
        sk: c.session.sk,
        date: c.session.date,
        category: c.session.category,
        title: c.session.title,
      }));
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: STRAVA_PK,
            sk: `UNMATCHED#${activity.id}`,
            activityId: activity.id,
            activityName: activity.name,
            date: localDate,
            sportType: activity.sport_type ?? activity.type,
            distanceKm: parseFloat((activity.distance / 1000).toFixed(3)),
            durationMin: parseFloat((activity.moving_time / 60).toFixed(1)),
            avgHr: activity.average_heartrate ?? null,
            avgPacePerKm: broadType === "run" ? (paceFromActivity(activity) ?? null) : null,
            stravaUrl: `https://www.strava.com/activities/${activity.id}`,
            candidateSessions: candidateInfo,
            importedAt: now,
          },
        })
      );
      unmatched++;
    }
  }

  // Advance lastSyncEpoch to newest activity's start time
  const newestEpoch = Math.max(
    ...activities.map((a) => Math.floor(new Date(a.start_date).getTime() / 1000))
  );
  if (newestEpoch > lastSyncEpoch) {
    await updateLastSyncEpoch(newestEpoch);
  }

  return { matched, unmatched, skipped, total: activities.length };
}

// GET — called by Vercel cron (Authorization: Bearer CRON_SECRET)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — called by the manual "Sync Strava" button
export async function POST() {
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
