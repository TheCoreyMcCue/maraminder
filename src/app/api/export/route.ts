import { NextRequest, NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME, PLAN_PK } from "@/lib/db";

const EXPORT_KEY = process.env.EXPORT_KEY;

export async function GET(req: NextRequest) {
  if (EXPORT_KEY && req.headers.get("x-export-key") !== EXPORT_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pretty = req.nextUrl.searchParams.get("pretty") === "1";

  // ── Single Query — every item under this plan partition ──
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": PLAN_PK },
    })
  );

  const items = result.Items ?? [];

  // ── Split by SK prefix ────────────────────────────────────
  let meta: Record<string, unknown> | null = null;
  const zones: Record<string, unknown>[] = [];
  const weekItems: Record<string, unknown>[] = [];
  const sessionItems: Record<string, unknown>[] = [];
  const recoveryItems: Record<string, unknown>[] = [];

  for (const item of items) {
    const sk = item.sk as string;
    if (sk === "META") {
      meta = item;
    } else if (sk.startsWith("ZONES#")) {
      zones.push(item);
    } else if (/^WEEK#\d+#SES#/.test(sk)) {
      sessionItems.push(item);
    } else if (/^WEEK#\d+$/.test(sk)) {
      weekItems.push(item);
    } else if (sk.startsWith("RECOVERY#")) {
      recoveryItems.push(item);
    }
  }

  if (!meta) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // ── Sort ──────────────────────────────────────────────────
  zones.sort((a, b) => (a.version as number) - (b.version as number));
  weekItems.sort((a, b) => (a.weekNo as number) - (b.weekNo as number));
  sessionItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  recoveryItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // ── Derive per-week actuals ───────────────────────────────
  const sessionsByWeek = new Map<number, typeof sessionItems>();
  for (const s of sessionItems) {
    const wn = s.weekNo as number;
    if (!sessionsByWeek.has(wn)) sessionsByWeek.set(wn, []);
    sessionsByWeek.get(wn)!.push(s);
  }

  // ── Assemble payload ──────────────────────────────────────
  const payload = {
    exportedAt: new Date().toISOString(),

    plan: {
      name: meta.name ?? null,
      raceDate: meta.raceDate ?? null,
      halfDate: meta.halfDate ?? null,
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
      const actualKm = wSessions
        .filter((s) => (s.actual as Record<string, unknown> | null)?.distanceKm != null)
        .reduce((sum, s) => sum + ((s.actual as Record<string, unknown>).distanceKm as number), 0);
      const done = wSessions.filter((s) => s.status === "done").length;
      const skipped = wSessions.filter((s) => s.status === "skipped").length;

      return {
        weekNo: w.weekNo ?? null,
        phase: w.phase ?? null,
        dateStart: w.dateStart ?? null,
        dateEnd: w.dateEnd ?? null,
        isDownWeek: w.isDownWeek ?? false,
        volumeTargetKm: w.volumeTargetKm ?? null,
        volumeActualKm: actualKm > 0 ? parseFloat(actualKm.toFixed(2)) : null,
        sessionsPlanned: wSessions.length,
        sessionsDone: done,
        sessionsSkipped: skipped,
        notes: w.notes ?? null,
      };
    }),

    sessions: sessionItems.map((s) => {
      const actual = s.actual as Record<string, unknown> | null;
      const decoupling = actual?.decoupling as Record<string, unknown> | undefined;

      return {
        weekNo: s.weekNo ?? null,
        date: s.date ?? null,
        dayOfWeek: s.dayOfWeek ?? null,
        type: s.type ?? null,
        category: s.category ?? null,
        title: s.title ?? null,
        status: s.status ?? null,
        target: {
          durationMin: s.targetDurationMin ?? null,
          distanceKm: s.targetDistanceKm ?? null,
          zoneRefs: s.zoneRefs ?? [],
          structure: s.structure ?? null,
        },
        actual: actual
          ? {
              distanceKm: actual.distanceKm ?? null,
              durationMin: actual.durationMin ?? null,
              avgPacePerKm: actual.avgPacePerKm ?? null,
              avgHr: actual.avgHr ?? null,
              segmentHr: actual.segmentHr ?? null,
              segmentPace: actual.segmentPace ?? null,
              rpe: actual.rpe ?? null,
              tempC: actual.tempC ?? null,
              wind: actual.wind ?? null,
              notes: actual.notes ?? null,
              stravaUrl: actual.stravaUrl ?? null,
              targetSnapshot: actual.targetSnapshot ?? null,
              decoupling: decoupling
                ? {
                    firstHalfHr: decoupling.firstHalfHr ?? null,
                    secondHalfHr: decoupling.secondHalfHr ?? null,
                    paceHeldKm: decoupling.paceHeldKm ?? null,
                  }
                : null,
            }
          : null,
      };
    }),

    recovery: recoveryItems.map((r) => ({
      date: r.date ?? null,
      hrvMs: r.hrvMs ?? null,
      rhrBpm: r.rhrBpm ?? null,
      sleepHours: r.sleepHours ?? null,
      sleepScore: r.sleepScore ?? null,
      readiness: r.readiness ?? null,
      source: r.source ?? null,
      note: r.note ?? null,
    })),
  };

  const body = pretty
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);

  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
