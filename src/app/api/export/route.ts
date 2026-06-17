import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "@/lib/db";

const EXPORT_KEY = process.env.EXPORT_KEY;
const ALL_PLAN_IDS = ["amsterdam26", "bridge-2026"];

export async function GET(req: NextRequest) {
  if (EXPORT_KEY && req.headers.get("x-export-key") !== EXPORT_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pretty = req.nextUrl.searchParams.get("pretty") === "1";
  const planParam = req.nextUrl.searchParams.get("plan");

  const planIds = planParam && planParam !== "all" ? [planParam] : ALL_PLAN_IDS;

  const [planResults, baselineResult] = await Promise.all([
    Promise.all(
      planIds.map((id) =>
        docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": `PLAN#${id}` },
        })).then((r) => ({ planId: id, items: r.Items ?? [] }))
      )
    ),
    docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: "USER#default", sk: "RECOVERY_BASELINE" },
    })),
  ]);

  const exportedPlans: Record<string, unknown> = {};
  const baseline = baselineResult.Item as Record<string, unknown> | undefined;

  for (const { planId, items } of planResults) {
    const built = buildPlanExport(planId, items, baseline);
    if (built) exportedPlans[planId] = built;
  }

  if (Object.keys(exportedPlans).length === 0) {
    return NextResponse.json({ error: "No plan data found" }, { status: 404 });
  }

  const baselineClean = baseline ? strip(baseline) : null;

  const payload = {
    exportedAt: new Date().toISOString(),
    personalBaseline: baselineClean,
    ...(planIds.length === 1
      ? exportedPlans[planIds[0]] as object
      : { plans: exportedPlans }),
  };

  const body = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Root serialization helper ────────────────────────────────────────────────
// Strip DynamoDB pk/sk housekeeping keys only — every other field passes through
// untouched. This is intentional: new fields flow to the export automatically
// without requiring any changes here.

function strip(item: Record<string, unknown>): Record<string, unknown> {
  const { pk: _pk, sk: _sk, ...rest } = item;
  return rest;
}

// ── Load estimation (used for weekly derived stats) ──────────────────────────

const EST_RPE: Record<string, number> = {
  easy: 3.5, steady: 5, mp: 6, threshold: 7, vo2: 8.5,
  long: 4.5, race: 8.5, bike: 3.5, brick: 7, strength: 5, rest: 0,
};

function sessionLoad(s: Record<string, unknown>, ftpW?: number): number {
  const a = s.actual as Record<string, unknown> | null;
  const cat = s.category as string;
  if (cat === "strength") {
    const base  = (s.loadContribution as number | undefined) ?? 110;
    const rpe   = a?.rpe as number | undefined;
    const scale = rpe != null ? Math.min(1.3, Math.max(0.5, rpe / 7)) : 1;
    return base * scale;
  }
  if ((cat === "bike" || cat === "brick") && a?.avgPowerW && ftpW) {
    const hrs = ((a.durationMin ?? s.targetDurationMin ?? 0) as number) / 60;
    return hrs * Math.pow((a.avgPowerW as number) / ftpW, 2) * 100 * 6;
  }
  const dur = ((a?.durationMin ?? s.targetDurationMin ?? 0) as number);
  const rpe = (a?.rpe as number | undefined) ?? EST_RPE[cat] ?? 5;
  return dur * rpe;
}

// ── Daily readiness (computed, not stored) ───────────────────────────────────

interface BaselineShape {
  hrv?: { mean?: number };
  rhr?: { mean?: number };
  sleepTargetHours?: number;
  ftpW?: number;
}

function computeDailyReadiness(r: Record<string, unknown>, bl: BaselineShape): number | null {
  const clamp = (v: number) => Math.max(-30, Math.min(30, v));
  let weightedSum = 0, totalWeight = 0;

  if (r.hrvMs != null && bl.hrv?.mean) {
    const dev = clamp(((r.hrvMs as number) - bl.hrv.mean) / bl.hrv.mean * 100);
    weightedSum += dev * 0.60; totalWeight += 0.60;
  }
  if (r.rhrBpm != null && bl.rhr?.mean) {
    const dev = clamp(-((r.rhrBpm as number) - bl.rhr.mean) / bl.rhr.mean * 100);
    weightedSum += dev * 0.25; totalWeight += 0.25;
  }
  if (r.sleepHours != null && bl.sleepTargetHours) {
    const dev = clamp(((r.sleepHours as number) - bl.sleepTargetHours) / bl.sleepTargetHours * 100);
    weightedSum += dev * 0.15; totalWeight += 0.15;
  }

  if (totalWeight === 0) return null;
  return Math.round(Math.max(0, Math.min(100, 50 + (weightedSum / totalWeight) * (50 / 30))));
}

// ── Per-plan export ──────────────────────────────────────────────────────────

function buildPlanExport(
  planId: string,
  items: Record<string, unknown>[],
  baseline?: Record<string, unknown>
) {
  let meta: Record<string, unknown> | null = null;
  const zones: Record<string, unknown>[] = [];
  const weekItems: Record<string, unknown>[] = [];
  const sessionItems: Record<string, unknown>[] = [];
  const recoveryItems: Record<string, unknown>[] = [];

  for (const item of items) {
    const sk = item.sk as string;
    if (sk === "META")                    meta = item;
    else if (sk.startsWith("ZONES#"))    zones.push(item);
    else if (/^WEEK#\d+#SES#/.test(sk))  sessionItems.push(item);
    else if (/^WEEK#\d+$/.test(sk))      weekItems.push(item);
    else if (sk.startsWith("RECOVERY#")) recoveryItems.push(item);
  }

  if (!meta) return null;

  zones.sort((a, b) => (a.version as number) - (b.version as number));
  weekItems.sort((a, b) => (a.weekNo as number) - (b.weekNo as number));
  sessionItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  recoveryItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const bl = (baseline ?? {}) as BaselineShape;
  const ftpW = bl.ftpW;

  // Build date → weekNo lookup for recovery grouping
  const dateToWeek = new Map<string, number>();
  for (const w of weekItems) {
    const cur  = new Date((w.dateStart as string) + "T12:00:00");
    const last = new Date((w.dateEnd   as string) + "T12:00:00");
    while (cur <= last) {
      dateToWeek.set(cur.toISOString().slice(0, 10), w.weekNo as number);
      cur.setDate(cur.getDate() + 1);
    }
  }

  const sessionsByWeek = new Map<number, typeof sessionItems>();
  for (const s of sessionItems) {
    const wn = s.weekNo as number;
    if (!sessionsByWeek.has(wn)) sessionsByWeek.set(wn, []);
    sessionsByWeek.get(wn)!.push(s);
  }

  const recoveryByWeekNo = new Map<number, typeof recoveryItems>();
  for (const r of recoveryItems) {
    const wn = dateToWeek.get(r.date as string);
    if (wn == null) continue;
    if (!recoveryByWeekNo.has(wn)) recoveryByWeekNo.set(wn, []);
    recoveryByWeekNo.get(wn)!.push(r);
  }

  return {
    planId,

    // Full plan meta — new fields flow automatically
    plan: strip(meta),

    // Full zone sets — new fields flow automatically
    zones: zones.map(strip),

    weeks: weekItems.map((w) => {
      const wn       = w.weekNo as number;
      const wSess    = sessionsByWeek.get(wn) ?? [];
      const wRecov   = recoveryByWeekNo.get(wn) ?? [];

      const actualKm = wSess
        .filter((s) => s.category !== "bike" && (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const actualBikeKm = wSess
        .filter((s) => s.category === "bike" && (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const done    = wSess.filter((s) => s.status === "done").length;
      const skipped = wSess.filter((s) => s.status === "skipped").length;

      let actualLoad = 0, plannedLoad = 0;
      for (const s of wSess) {
        if (s.status === "skipped") continue;
        if ((s.category as string) === "strength") {
          plannedLoad += (s.loadContribution as number | undefined) ?? 110;
        } else {
          plannedLoad += ((s.targetDurationMin as number) ?? 0) * (EST_RPE[s.category as string] ?? 5);
        }
        if (s.status === "done" && s.actual) actualLoad += sessionLoad(s, ftpW);
      }

      const lifeScores = wRecov.filter((r) => r.lifeStress != null).map((r) => r.lifeStress as number);
      const avgLife = lifeScores.length ? lifeScores.reduce((a, b) => a + b, 0) / lifeScores.length : null;
      const lifeStressLoad = avgLife != null ? Math.round(avgLife * 30 * 7) : 0;
      const totalLoad = Math.round(actualLoad + lifeStressLoad);

      // Recovery index
      const daysWithData = wRecov.filter((r) => r.hrvMs != null || r.rhrBpm != null);
      let recoveryIndex: number | null = null;
      if (daysWithData.length > 0 && (bl.hrv?.mean || bl.rhr?.mean)) {
        const clamp = (v: number) => Math.max(-30, Math.min(30, v));
        const avg   = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const hrvDevs  = wRecov.filter(r => r.hrvMs != null && bl.hrv?.mean)
          .map(r => clamp(((r.hrvMs as number) - bl.hrv!.mean!) / bl.hrv!.mean! * 100));
        const rhrDevs  = wRecov.filter(r => r.rhrBpm != null && bl.rhr?.mean)
          .map(r => clamp(-((r.rhrBpm as number) - bl.rhr!.mean!) / bl.rhr!.mean! * 100));
        const sleepDevs = wRecov.filter(r => r.sleepHours != null && bl.sleepTargetHours)
          .map(r => clamp(((r.sleepHours as number) - bl.sleepTargetHours!) / bl.sleepTargetHours! * 100));
        const h = avg(hrvDevs), r2 = avg(rhrDevs), s2 = avg(sleepDevs);
        let ws = 0, tw = 0;
        if (h  != null) { ws += h  * 0.60; tw += 0.60; }
        if (r2 != null) { ws += r2 * 0.25; tw += 0.25; }
        if (s2 != null) { ws += s2 * 0.15; tw += 0.15; }
        if (tw > 0) recoveryIndex = Math.round((ws / tw) * 10) / 10;
      }

      // Full week object — new week fields flow automatically
      return {
        ...strip(w),
        // Computed analytics (derived from sessions + recovery, not stored in DB)
        volumeActualRunKm:  actualKm     > 0 ? parseFloat(actualKm.toFixed(2))     : null,
        volumeActualBikeKm: actualBikeKm > 0 ? parseFloat(actualBikeKm.toFixed(2)) : null,
        sessionsPlanned:  wSess.length,
        sessionsDone:     done,
        sessionsSkipped:  skipped,
        plannedLoad:      Math.round(plannedLoad),
        actualLoad:       Math.round(actualLoad),
        lifeStressLoad,
        totalLoad,
        recoveryIndex,
      };
    }),

    // Full session objects — targetDetail, purpose, laps, workSummary, decoupling,
    // strength category, and any future fields all flow through automatically.
    sessions: sessionItems.map(strip),

    // Full recovery readings + computed readiness
    recovery: recoveryItems.map((r) => ({
      ...strip(r),
      readiness: computeDailyReadiness(r, bl),
    })),
  };
}
