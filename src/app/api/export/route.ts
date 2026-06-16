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

  // Default: export all plans. Pass ?plan=amsterdam26 to export one.
  const planIds = planParam && planParam !== "all"
    ? [planParam]
    : ALL_PLAN_IDS;

  // ── Query all plan partitions + personal baseline in parallel ──
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

  // ── Build per-plan export objects ─────────────────────────
  const exportedPlans: Record<string, unknown> = {};

  const baseline = baselineResult.Item as Record<string, unknown> | undefined;

  for (const { planId, items } of planResults) {
    const built = buildPlanExport(planId, items, baseline);
    if (built) exportedPlans[planId] = built;
  }

  if (Object.keys(exportedPlans).length === 0) {
    return NextResponse.json({ error: "No plan data found" }, { status: 404 });
  }

  // ── Strip DynamoDB internal fields from baseline ──────────
  const baselineClean = baselineResult.Item
    ? (({ pk, sk, ...rest }) => rest)(baselineResult.Item as Record<string, unknown>)
    : null;

  const payload = {
    exportedAt: new Date().toISOString(),
    personalBaseline: baselineClean,
    // Single plan → flat shape (backward compat). Multiple → keyed by planId.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const EST_RPE: Record<string, number> = {
  easy: 3.5, steady: 5, mp: 6, threshold: 7, vo2: 8.5,
  long: 4.5, race: 8.5, bike: 3.5, brick: 7, rest: 0,
};

function sessionLoad(s: Record<string, unknown>, ftpW?: number): number {
  const a = s.actual as Record<string, unknown> | null;
  const cat = s.category as string;
  if ((cat === "bike" || cat === "brick") && a?.avgPowerW && ftpW) {
    const hrs = ((a.durationMin ?? s.targetDurationMin ?? 0) as number) / 60;
    return hrs * Math.pow((a.avgPowerW as number) / ftpW, 2) * 100 * 6;
  }
  const dur = ((a?.durationMin ?? s.targetDurationMin ?? 0) as number);
  const rpe = (a?.rpe as number | undefined) ?? EST_RPE[cat] ?? 5;
  return dur * rpe;
}

interface BaselineShape {
  hrv?: { mean?: number };
  rhr?: { mean?: number };
  sleepTargetHours?: number;
  ftpW?: number;
}

// Compute a 0–100 daily readiness score from one recovery reading vs baseline.
// Formula mirrors weeklyAnalysis recoveryIndex (HRV 60%, RHR 25%, sleep 15%)
// but maps the [-30, +30] deviation range to [0, 100]: score = 50 + dev*(50/30).
function computeDailyReadiness(r: Record<string, unknown>, bl: BaselineShape): number | null {
  const clamp = (v: number) => Math.max(-30, Math.min(30, v));
  let weightedSum = 0, totalWeight = 0;

  const hrvMean = bl.hrv?.mean;
  if (r.hrvMs != null && hrvMean) {
    const dev = clamp(((r.hrvMs as number) - hrvMean) / hrvMean * 100);
    weightedSum += dev * 0.60; totalWeight += 0.60;
  }
  const rhrMean = bl.rhr?.mean;
  if (r.rhrBpm != null && rhrMean) {
    const dev = clamp(-((r.rhrBpm as number) - rhrMean) / rhrMean * 100);
    weightedSum += dev * 0.25; totalWeight += 0.25;
  }
  const sleepTarget = bl.sleepTargetHours;
  if (r.sleepHours != null && sleepTarget) {
    const dev = clamp(((r.sleepHours as number) - sleepTarget) / sleepTarget * 100);
    weightedSum += dev * 0.15; totalWeight += 0.15;
  }

  if (totalWeight === 0) return null;
  const deviation = (weightedSum / totalWeight);
  return Math.round(Math.max(0, Math.min(100, 50 + deviation * (50 / 30))));
}

// ── Per-plan processor ────────────────────────────────────────────────────────

function buildPlanExport(planId: string, items: Record<string, unknown>[], baseline?: Record<string, unknown>) {
  let meta: Record<string, unknown> | null = null;
  const zones: Record<string, unknown>[] = [];
  const weekItems: Record<string, unknown>[] = [];
  const sessionItems: Record<string, unknown>[] = [];
  const recoveryItems: Record<string, unknown>[] = [];

  for (const item of items) {
    const sk = item.sk as string;
    if (sk === "META")                   meta = item;
    else if (sk.startsWith("ZONES#"))   zones.push(item);
    else if (/^WEEK#\d+#SES#/.test(sk)) sessionItems.push(item);
    else if (/^WEEK#\d+$/.test(sk))     weekItems.push(item);
    else if (sk.startsWith("RECOVERY#")) recoveryItems.push(item);
  }

  if (!meta) return null;

  zones.sort((a, b) => (a.version as number) - (b.version as number));
  weekItems.sort((a, b) => (a.weekNo as number) - (b.weekNo as number));
  sessionItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  recoveryItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const bl = (baseline ?? {}) as BaselineShape;
  const ftpW = bl.ftpW;

  // Per-week derived stats
  const sessionsByWeek = new Map<number, typeof sessionItems>();
  for (const s of sessionItems) {
    const wn = s.weekNo as number;
    if (!sessionsByWeek.has(wn)) sessionsByWeek.set(wn, []);
    sessionsByWeek.get(wn)!.push(s);
  }

  const recoveryByWeek = new Map<string, typeof recoveryItems[]>();
  // map date → week for quick lookup
  const dateToWeek = new Map<string, number>();
  for (const w of weekItems) {
    const start = w.dateStart as string;
    const end   = w.dateEnd as string;
    const wn    = w.weekNo as number;
    // Iterate dates in range
    const cur = new Date(start + "T12:00:00");
    const last = new Date(end + "T12:00:00");
    while (cur <= last) {
      dateToWeek.set(cur.toISOString().slice(0, 10), wn);
      cur.setDate(cur.getDate() + 1);
    }
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
    plan: {
      name: meta.name ?? null,
      raceDate: meta.raceDate ?? null,
      halfDate: meta.halfDate ?? null,
      startDate: meta.startDate ?? null,
      goalTime: meta.goalTime ?? null,
      goalPace: meta.goalPace ?? null,
      currentZoneVersion: meta.currentZoneVersion ?? null,
    },

    zones: zones.map((z) => ({
      version: z.version ?? null,
      effectiveWeek: z.effectiveWeek ?? null,
      source: z.source ?? null,
      zones: z.zones ?? null,
    })),

    weeks: weekItems.map((w) => {
      const wn = w.weekNo as number;
      const wSessions = sessionsByWeek.get(wn) ?? [];
      const wReadings = recoveryByWeekNo.get(wn) ?? [];

      // Run km only (bike excluded from volume target)
      const actualKm = wSessions
        .filter((s) => s.category !== "bike" && (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const actualBikeKm = wSessions
        .filter((s) => s.category === "bike" && (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const done    = wSessions.filter((s) => s.status === "done").length;
      const skipped = wSessions.filter((s) => s.status === "skipped").length;

      // Load
      let actualLoad = 0, plannedLoad = 0;
      for (const s of wSessions) {
        if (s.status === "skipped") continue;
        plannedLoad += (s.targetDurationMin as number ?? 0) * (EST_RPE[s.category as string] ?? 5);
        if (s.status === "done" && s.actual) actualLoad += sessionLoad(s, ftpW);
      }
      const lifeScores = wReadings.filter((r) => r.lifeStress != null).map((r) => r.lifeStress as number);
      const avgLife = lifeScores.length ? lifeScores.reduce((a, b) => a + b, 0) / lifeScores.length : null;
      const lifeStressLoad = avgLife != null ? Math.round(avgLife * 30 * 7) : 0;
      const totalLoad = Math.round(actualLoad + lifeStressLoad);

      // Recovery index (HRV 60% / RHR 25% / sleep 15%, deviation from baseline, -30→+30)
      const daysWithData = wReadings.filter((r) => r.hrvMs != null || r.rhrBpm != null);
      let recoveryIndex: number | null = null;
      if (daysWithData.length > 0 && (bl.hrv?.mean || bl.rhr?.mean)) {
        const clamp = (v: number) => Math.max(-30, Math.min(30, v));
        const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const hrvDevs = wReadings.filter(r => r.hrvMs != null && bl.hrv?.mean)
          .map(r => clamp(((r.hrvMs as number) - bl.hrv!.mean!) / bl.hrv!.mean! * 100));
        const rhrDevs = wReadings.filter(r => r.rhrBpm != null && bl.rhr?.mean)
          .map(r => clamp(-((r.rhrBpm as number) - bl.rhr!.mean!) / bl.rhr!.mean! * 100));
        const sleepDevs = wReadings.filter(r => r.sleepHours != null && bl.sleepTargetHours)
          .map(r => clamp(((r.sleepHours as number) - bl.sleepTargetHours!) / bl.sleepTargetHours! * 100));
        const h = avg(hrvDevs), r2 = avg(rhrDevs), s2 = avg(sleepDevs);
        let ws = 0, tw = 0;
        if (h != null)  { ws += h  * 0.60; tw += 0.60; }
        if (r2 != null) { ws += r2 * 0.25; tw += 0.25; }
        if (s2 != null) { ws += s2 * 0.15; tw += 0.15; }
        if (tw > 0) recoveryIndex = Math.round((ws / tw) * 10) / 10;
      }

      return {
        weekNo:              w.weekNo ?? null,
        phase:               w.phase ?? null,
        dateStart:           w.dateStart ?? null,
        dateEnd:             w.dateEnd ?? null,
        isDownWeek:          w.isDownWeek ?? false,
        volumeTargetKm:      w.volumeTargetKm ?? null,
        volumeActualRunKm:   actualKm > 0 ? parseFloat(actualKm.toFixed(2)) : null,
        volumeActualBikeKm:  actualBikeKm > 0 ? parseFloat(actualBikeKm.toFixed(2)) : null,
        sessionsPlanned:     wSessions.length,
        sessionsDone:        done,
        sessionsSkipped:     skipped,
        plannedLoad:         Math.round(plannedLoad),
        actualLoad:          Math.round(actualLoad),
        lifeStressLoad,
        totalLoad,
        recoveryIndex,
        notes:               w.notes ?? null,
      };
    }),

    sessions: sessionItems.map((s) => {
      const actual = s.actual as Record<string, unknown> | null;
      const decoupling = actual?.decoupling as Record<string, unknown> | undefined;

      return {
        weekNo:    s.weekNo ?? null,
        date:      s.date ?? null,
        dayOfWeek: s.dayOfWeek ?? null,
        type:      s.type ?? null,
        category:  s.category ?? null,
        title:     s.title ?? null,
        status:    s.status ?? null,
        target: {
          durationMin:  s.targetDurationMin ?? null,
          distanceKm:   s.targetDistanceKm ?? null,
          zoneRefs:     s.zoneRefs ?? [],
          structure:    s.structure ?? null,
        },
        actual: actual ? {
          distanceKm:   actual.distanceKm ?? null,
          durationMin:  actual.durationMin ?? null,
          avgPacePerKm: actual.avgPacePerKm ?? null,
          avgHr:        actual.avgHr ?? null,
          avgPowerW:    actual.avgPowerW ?? null,
          segmentHr:    actual.segmentHr ?? null,
          segmentPace:  actual.segmentPace ?? null,
          rpe:          actual.rpe ?? null,
          tempC:        actual.tempC ?? null,
          wind:         actual.wind ?? null,
          restTaken:    actual.restTaken ?? null,
          notes:        actual.notes ?? null,
          stravaUrl:    actual.stravaUrl ?? null,
          stravaActivityId: actual.stravaActivityId ?? null,
          targetSnapshot: actual.targetSnapshot ?? null,
          decoupling: decoupling ? {
            firstHalfHr:  decoupling.firstHalfHr ?? null,
            secondHalfHr: decoupling.secondHalfHr ?? null,
            paceHeldKm:   decoupling.paceHeldKm ?? null,
          } : null,
        } : null,
      };
    }),

    // All recovery readings — readiness is computed (HRV/RHR/sleep vs baseline)
    recovery: recoveryItems.map((r) => ({
      date:         r.date ?? null,
      hrvMs:        r.hrvMs ?? null,
      rhrBpm:       r.rhrBpm ?? null,
      sleepHours:   r.sleepHours ?? null,
      sleepScore:   r.sleepScore ?? null,
      readiness:    computeDailyReadiness(r, bl),
      lifeStress:   r.lifeStress ?? null,
      legFatigue:   r.legFatigue ?? null,
      source:       r.source ?? null,
      note:         r.note ?? null,
    })),
  };
}
