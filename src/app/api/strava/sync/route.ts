import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "@/lib/db";
import { PLANS, planPk } from "@/lib/activePlan";
import { logActual } from "@/lib/planOps";
import {
  getTokenRecord,
  stravaFetch,
  updateLastSyncEpoch,
  STRAVA_PK,
} from "@/lib/strava";
import type { Session, ZoneSet } from "@/lib/types";
import {
  zoneWorkKey,
  isQualityCategory,
  classifyLaps,
  annotateLapCompletion,
  parseRepCount,
  buildWorkSummary,
  deriveSegments,
} from "@/lib/lapUtils";
import type { StravaLapRaw } from "@/lib/lapUtils";

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

// ── Zone set fetcher (cached per plan per sync run) ───────────────────────────

const zoneCache = new Map<string, ZoneSet | null>();

async function fetchZoneSet(pid: string): Promise<ZoneSet | null> {
  if (zoneCache.has(pid)) return zoneCache.get(pid)!;
  const pk = planPk(pid);
  const meta = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk: "META" } })
  );
  const version = (meta.Item?.currentZoneVersion as number) ?? 1;
  const zr = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk: `ZONES#${version}` } })
  );
  const result = zr.Item ? (zr.Item as ZoneSet) : null;
  zoneCache.set(pid, result);
  return result;
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

  // Never look further back than 90 days — guards against a stored epoch from ancient
  // activity history advancing the window into pre-plan activities on each sync.
  const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
  const lastSyncEpoch = Math.max(token.lastSyncEpoch ?? 0, ninetyDaysAgo);

  // Paginate through all activities after lastSyncEpoch (Strava max 200/page)
  const activities: StravaActivity[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await stravaFetch<StravaActivity[]>("/athlete/activities", {
      after: lastSyncEpoch,
      per_page: 200,
      page,
    });
    activities.push(...batch);
    if (batch.length < 200) break;
  }

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
      const base = {
        distanceKm: parseFloat((activity.distance / 1000).toFixed(2)),
        durationMin: parseFloat((activity.moving_time / 60).toFixed(1)),
        avgPacePerKm: broadType === "run" ? paceFromActivity(activity) : undefined,
        avgHr: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : undefined,
        avgPowerW: activity.average_watts != null ? Math.round(activity.average_watts) : undefined,
        stravaUrl: `https://www.strava.com/activities/${activity.id}`,
        stravaActivityId: activity.id,
      };

      // For quality sessions, fetch laps and classify them
      let lapEnrichment: {
        laps?: typeof base extends never ? never : import("@/lib/types").Lap[];
        workSummary?: import("@/lib/types").WorkSummary;
        segmentPace?: Partial<Record<import("@/lib/types").ZoneKey, string>>;
        segmentHr?: Partial<Record<import("@/lib/types").ZoneKey, number>>;
      } = {};

      if (broadType === "run" && isQualityCategory(session.category)) {
        try {
          const workZone = zoneWorkKey(session.category);
          const zones = workZone ? await fetchZoneSet(planId) : null;

          if (workZone && zones) {
            const rawLaps = await stravaFetch<StravaLapRaw[]>(
              `/activities/${activity.id}/laps`
            );

            if (rawLaps.length > 0) {
              const laps = annotateLapCompletion(
                classifyLaps(rawLaps, workZone, zones),
                session.structure,
              );
              const workCount = laps.filter((l) => l.label === "rep").length;
              const prescribed = parseRepCount(session.structure);

              if (prescribed !== null && workCount !== prescribed) {
                // Mismatch — queue for manual confirm rather than auto-committing
                const candidateInfo = [{
                  planId,
                  sk: session.sk,
                  date: session.date,
                  category: session.category,
                  title: session.title,
                }];
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
                      ...base,
                      candidateSessions: candidateInfo,
                      importedAt: now,
                      lapMismatch: true,
                      pendingLaps: laps,
                      prescribedRepCount: prescribed,
                    },
                  })
                );
                unmatched++;
                continue;
              }

              // Count matches — enrich
              const workSummary = workZone ? buildWorkSummary(laps, workZone) : null;
              const { segmentPace, segmentHr } = deriveSegments(laps);
              lapEnrichment = {
                laps,
                workSummary: workSummary ?? undefined,
                segmentPace: Object.keys(segmentPace).length > 0 ? segmentPace : undefined,
                segmentHr:   Object.keys(segmentHr).length   > 0 ? segmentHr   : undefined,
              };
            }
          }
        } catch (lapErr) {
          // Non-fatal — log and continue without lap data
          console.warn(`[strava/sync] lap fetch failed for ${activity.id}:`, lapErr);
        }
      }

      const actual = { ...base, ...lapEnrichment };
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
            distanceKm: parseFloat((activity.distance / 1000).toFixed(2)),
            durationMin: parseFloat((activity.moving_time / 60).toFixed(1)),
            avgHr: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
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
