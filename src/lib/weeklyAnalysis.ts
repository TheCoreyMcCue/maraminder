import type { Session, Week, RecoveryReading, ZoneSet, PersonalBaseline, PlanMeta } from "./types";

// ── Estimated RPE per category (for planned sessions) ────
const EST_RPE: Record<string, number> = {
  easy: 3.5, steady: 5, mp: 6, threshold: 7, vo2: 8.5,
  long: 4.5, race: 8.5, bike: 3.5, brick: 7, rest: 0,
};

function sessionLoad(
  durationMin: number | undefined,
  category: string,
  rpe?: number
): number {
  const dur = durationMin ?? 0;
  if (dur === 0) return 0;
  return dur * (rpe ?? EST_RPE[category] ?? 5);
}

// ── Types ─────────────────────────────────────────────────

export type WeekStatus = "adapting" | "watch" | "recovering" | "neutral";

export interface WeekAnnotation {
  type: "down" | "race" | "half" | "taper-start" | "recalibration";
  label: string;
}

export interface WeekAnalysis {
  weekNo: number;
  phase: string;
  dateStart: string;
  dateEnd: string;
  // Load
  actualLoad: number;       // sum of RPE×duration for logged sessions
  plannedLoad: number;      // sum of RPE×duration for all sessions
  lifeStressLoad: number;   // life stress component (same units)
  totalLoad: number;        // actualLoad + lifeStressLoad
  actualKm: number;
  plannedKm: number;
  // Recovery index — single composite, +50 = well above baseline, −50 = depleted
  recoveryIndex: number | null;
  recoveryDays: number;     // how many days have readings this week
  recoveryComponents: { hrv: number | null; rhr: number | null; sleep: number | null };
  // Divergence
  status: WeekStatus;
  verdict: string | null;
  // Annotations
  annotations: WeekAnnotation[];
}

// ── Main ──────────────────────────────────────────────────

export function computeWeeklyAnalysis(
  weeks: Week[],
  sessions: Session[],
  readings: RecoveryReading[],
  baseline: PersonalBaseline,
  allZones: ZoneSet[],
  meta: PlanMeta
): WeekAnalysis[] {
  const analyzed: WeekAnalysis[] = weeks.map((w) => {
    const wSessions = sessions.filter((s) => s.weekNo === w.weekNo);
    const wReadings = readings.filter(
      (r) => r.date >= w.dateStart && r.date <= w.dateEnd
    );

    // ── Load ──
    let actualLoad = 0, plannedLoad = 0, actualKm = 0, plannedKm = 0;
    for (const s of wSessions) {
      if (s.status === "skipped") continue;
      plannedLoad += sessionLoad(s.targetDurationMin, s.category);
      plannedKm += s.targetDistanceKm ?? 0;
      if (s.status === "done" && s.actual) {
        actualLoad += sessionLoad(s.actual.durationMin, s.category, s.actual.rpe ?? undefined);
        actualKm += s.actual.distanceKm ?? 0;
      }
    }

    // ── Life stress ──
    const lifeScores = wReadings.filter((r) => r.lifeStress != null).map((r) => r.lifeStress!);
    const avgLife = lifeScores.length > 0
      ? lifeScores.reduce((a, b) => a + b, 0) / lifeScores.length
      : null;
    // Scale: avg life stress × 30 × 7 days (comparable to typical easy training week ~1470)
    const lifeStressLoad = avgLife != null ? Math.round(avgLife * 30 * 7) : 0;
    const totalLoad = actualLoad + lifeStressLoad;

    // ── Recovery index ──
    const { index, components, n } = computeRecoveryIndex(wReadings, baseline);

    // ── Annotations ──
    const annotations = buildAnnotations(w, meta, allZones);

    return {
      weekNo: w.weekNo,
      phase: w.phase,
      dateStart: w.dateStart,
      dateEnd: w.dateEnd,
      actualLoad: Math.round(actualLoad),
      plannedLoad: Math.round(plannedLoad),
      lifeStressLoad,
      totalLoad: Math.round(totalLoad),
      actualKm: Math.round(actualKm * 10) / 10,
      plannedKm: w.volumeTargetKm,
      recoveryIndex: index,
      recoveryDays: n,
      recoveryComponents: components,
      status: "neutral",
      verdict: null,
      annotations,
    };
  });

  // ── Divergence classification ─────────────────────────
  return classifyDivergence(analyzed, weeks);
}

// ── Recovery index ────────────────────────────────────────

function computeRecoveryIndex(
  readings: RecoveryReading[],
  baseline: PersonalBaseline
): { index: number | null; components: { hrv: number | null; rhr: number | null; sleep: number | null }; n: number } {
  const daysWithData = readings.filter((r) => r.hrvMs != null || r.rhrBpm != null);
  if (daysWithData.length === 0) return { index: null, components: { hrv: null, rhr: null, sleep: null }, n: 0 };

  // Per-metric % deviation from baseline, clamped ±30
  const clamp = (v: number) => Math.max(-30, Math.min(30, v));

  const hrvDevs = readings.filter((r) => r.hrvMs != null)
    .map((r) => clamp(((r.hrvMs! - baseline.hrv.mean) / baseline.hrv.mean) * 100));
  const rhrDevs = readings.filter((r) => r.rhrBpm != null)
    .map((r) => clamp(-((r.rhrBpm! - baseline.rhr.mean) / baseline.rhr.mean) * 100)); // negated: lower RHR = better
  const sleepDevs = readings.filter((r) => r.sleepHours != null)
    .map((r) => clamp(((r.sleepHours! - baseline.sleepTargetHours) / baseline.sleepTargetHours) * 100));

  const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  const hrvAvg  = avg(hrvDevs);
  const rhrAvg  = avg(rhrDevs);
  const sleepAvg = avg(sleepDevs);

  // Weighted composite: HRV 60%, RHR 25%, sleep 15%
  let weightedSum = 0, totalWeight = 0;
  if (hrvAvg  != null) { weightedSum += hrvAvg  * 0.60; totalWeight += 0.60; }
  if (rhrAvg  != null) { weightedSum += rhrAvg  * 0.25; totalWeight += 0.25; }
  if (sleepAvg != null) { weightedSum += sleepAvg * 0.15; totalWeight += 0.15; }

  // Normalise so missing metrics don't drag it to 0
  const raw = totalWeight > 0 ? weightedSum / totalWeight * 30 / 30 : null;
  const index = raw != null ? Math.round(raw * 10) / 10 : null;

  return {
    index,
    components: { hrv: hrvAvg != null ? Math.round(hrvAvg) : null, rhr: rhrAvg != null ? Math.round(rhrAvg) : null, sleep: sleepAvg != null ? Math.round(sleepAvg) : null },
    n: daysWithData.length,
  };
}

// ── Divergence ────────────────────────────────────────────

function classifyDivergence(weeks: WeekAnalysis[], weekMeta: Week[]): WeekAnalysis[] {
  const result = [...weeks];

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const curr = result[i];

    // Need actual load data to classify
    if (curr.actualLoad === 0 && curr.lifeStressLoad === 0) continue;
    if (prev.actualLoad === 0 && prev.lifeStressLoad === 0) continue;

    const loadDelta = prev.totalLoad > 0
      ? (curr.totalLoad - prev.totalLoad) / prev.totalLoad
      : 0;

    const recDelta = curr.recoveryIndex != null && prev.recoveryIndex != null
      ? curr.recoveryIndex - prev.recoveryIndex
      : null;

    const loadUp   = loadDelta > 0.05;      // >5% increase
    const loadDown = loadDelta < -0.05;     // >5% decrease
    const recUp    = recDelta != null && recDelta > 3;
    const recDown  = recDelta != null && recDelta < -3;

    let status: WeekStatus = "neutral";
    if (loadUp && (recDown || recDelta == null)) {
      // Check if it's 2+ weeks of divergence
      if (i >= 2 && result[i - 1].status === "watch") {
        status = "watch"; // sustained divergence
      } else if (i >= 2 && result[i - 1].status === "neutral" && recDelta != null && recDelta < -5) {
        status = "watch"; // single-week but large divergence
      } else if (recDelta == null) {
        status = "neutral"; // can't confirm without recovery data
      } else {
        status = "neutral"; // first week of potential divergence — watch but don't flag yet
        // If the load jump is very large (>20%), flag immediately
        if (loadDelta > 0.2 && recDown) status = "watch";
      }
    } else if (loadUp && recUp) {
      status = "adapting";
    } else if (loadDown && recUp) {
      status = "recovering";
    }

    result[i] = { ...curr, status };
  }

  // Add verdicts to "watch" weeks
  for (let i = 0; i < result.length; i++) {
    if (result[i].status !== "watch") continue;

    // Find next down week
    const nextDown = weekMeta.slice(i + 1).find((w) => w.isDownWeek);
    const totalLoadKind = result[i].lifeStressLoad > result[i].actualLoad * 0.3
      ? "combined training + life stress load"
      : "training load";

    result[i] = {
      ...result[i],
      verdict: nextDown
        ? `W${result[i].weekNo}: ${totalLoadKind} climbing while recovery dips. Down week is W${nextDown.weekNo} — consider pulling it forward.`
        : `W${result[i].weekNo}: ${totalLoadKind} climbing while recovery dips. Add an easy day or reduce next week's quality volume.`,
    };
  }

  return result;
}

// ── Annotations ───────────────────────────────────────────

function buildAnnotations(w: Week, meta: PlanMeta, allZones: ZoneSet[]): WeekAnnotation[] {
  const ann: WeekAnnotation[] = [];

  if (w.isDownWeek) ann.push({ type: "down", label: "Down" });

  if (meta.raceDate >= w.dateStart && meta.raceDate <= w.dateEnd) {
    ann.push({ type: "race", label: "Race" });
  } else if (meta.halfDate && meta.halfDate !== meta.raceDate &&
             meta.halfDate >= w.dateStart && meta.halfDate <= w.dateEnd) {
    ann.push({ type: "half", label: "Half" });
  }

  if (w.phase.toLowerCase().includes("taper") && !w.phase.toLowerCase().includes("week 2")) {
    // Mark first taper week
    ann.push({ type: "taper-start", label: "Taper" });
  }

  const recalibration = allZones.find(
    (z) => z.version > 1 && z.effectiveWeek === w.weekNo
  );
  if (recalibration) ann.push({ type: "recalibration", label: `Zones v${recalibration.version}` });

  return ann;
}
