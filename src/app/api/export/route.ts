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

  for (const { planId, items } of planResults) {
    const built = buildPlanExport(planId, items);
    if (built) exportedPlans[planId] = built;
  }

  if (Object.keys(exportedPlans).length === 0) {
    return NextResponse.json({ error: "No plan data found" }, { status: 404 });
  }

  // ── Strip DynamoDB internal fields from baseline ──────────
  const baseline = baselineResult.Item
    ? (({ pk, sk, ...rest }) => rest)(baselineResult.Item as Record<string, unknown>)
    : null;

  const payload = {
    exportedAt: new Date().toISOString(),
    personalBaseline: baseline,
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

// ── Per-plan processor ────────────────────────────────────────────────────────

function buildPlanExport(planId: string, items: Record<string, unknown>[]) {
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

  // Per-week derived stats
  const sessionsByWeek = new Map<number, typeof sessionItems>();
  for (const s of sessionItems) {
    const wn = s.weekNo as number;
    if (!sessionsByWeek.has(wn)) sessionsByWeek.set(wn, []);
    sessionsByWeek.get(wn)!.push(s);
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
      const wSessions = sessionsByWeek.get(w.weekNo as number) ?? [];
      // Run km only (bike excluded from volume target)
      const actualKm = wSessions
        .filter((s) => s.category !== "bike" && (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const actualBikeKm = wSessions
        .filter((s) => s.category === "bike" && (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const done    = wSessions.filter((s) => s.status === "done").length;
      const skipped = wSessions.filter((s) => s.status === "skipped").length;

      return {
        weekNo:          w.weekNo ?? null,
        phase:           w.phase ?? null,
        dateStart:       w.dateStart ?? null,
        dateEnd:         w.dateEnd ?? null,
        isDownWeek:      w.isDownWeek ?? false,
        volumeTargetKm:  w.volumeTargetKm ?? null,
        volumeActualRunKm:  actualKm > 0 ? parseFloat(actualKm.toFixed(2)) : null,
        volumeActualBikeKm: actualBikeKm > 0 ? parseFloat(actualBikeKm.toFixed(2)) : null,
        sessionsPlanned: wSessions.length,
        sessionsDone:    done,
        sessionsSkipped: skipped,
        notes:           w.notes ?? null,
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
          targetSnapshot: actual.targetSnapshot ?? null,
          decoupling: decoupling ? {
            firstHalfHr:  decoupling.firstHalfHr ?? null,
            secondHalfHr: decoupling.secondHalfHr ?? null,
            paceHeldKm:   decoupling.paceHeldKm ?? null,
          } : null,
        } : null,
      };
    }),

    // All recovery readings — raw values; baseline/deviation recomputable downstream
    recovery: recoveryItems.map((r) => ({
      date:         r.date ?? null,
      hrvMs:        r.hrvMs ?? null,
      rhrBpm:       r.rhrBpm ?? null,
      sleepHours:   r.sleepHours ?? null,
      sleepScore:   r.sleepScore ?? null,
      readiness:    r.readiness ?? null,
      lifeStress:   r.lifeStress ?? null,
      legFatigue:   r.legFatigue ?? null,
      source:       r.source ?? null,
      note:         r.note ?? null,
    })),
  };
}
