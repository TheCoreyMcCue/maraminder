import type { RecoveryReading, Session, PersonalBaseline } from "./types";

// Estimated RPE per category — used when RPE is not logged
// (Session-RPE method: load = durationMin × RPE, unit-agnostic across run/bike/brick)
const EST_RPE_FALLBACK: Record<string, number> = {
  easy: 3.5, steady: 5, mp: 6, threshold: 7, vo2: 8.5,
  long: 4.5, race: 8.5, bike: 3.5, brick: 7, rest: 0,
};

export type LoadLevel = "green" | "amber" | "red" | "critical";

// Once this many sessions are logged, actual data drives the chronic load fully.
// Below it, we blend with the seeded baseline so ACWR is meaningful from day 1.
const MIN_LOGGED_FOR_FULL_ACWR = 10;

// Average RPE used to convert typical weekly hours → load units
const TYPICAL_RPE = 4.5;

// Component weights — must sum to 100
const W = { training: 30, fatigue: 25, recovery: 25, life: 20 } as const;

export interface LoadFactorResult {
  score: number;          // 0–100
  level: LoadLevel;
  restBonus: number;      // points reduced by deliberate rest (0–4)
  training: {
    acute: number;
    chronic: number;
    ratio: number;
    score: number;        // 0–30
    insufficient: boolean;
  };
  legFatigue: {
    value: number | null; // today's logged 1–10
    score: number;        // 0–25
  };
  recoveryDeficit: {
    hrvZ: number | null;
    rhrZ: number | null;
    score: number;        // 0–25
  };
  lifeStress: {
    avg: number | null;
    score: number;        // 0–20
  };
  headline: string;
  insight: string;
}

// ── Main entry ────────────────────────────────────────────

export function computeLoadFactor(
  today: string,
  sessions: Session[],
  readings: RecoveryReading[],
  baseline: PersonalBaseline
): LoadFactorResult {

  const ftpW = baseline.ftpW;
  const typicalWeeklyHours = baseline.typicalWeeklyHours;

  // ── Training load (ACWR) ──
  const { acute, chronic, insufficient } = computeTrainingLoad(today, sessions, ftpW, typicalWeeklyHours);
  const acwr = insufficient || chronic === 0
    ? 0
    : acute / chronic;
  const trainingScore = insufficient
    ? 0
    : Math.round(Math.min(W.training, (acwr / 1.5) * W.training));

  // ── Leg fatigue (today's reading, direct signal) ──
  const todayFatigue = readings.find((r) => r.date === today)?.legFatigue ?? null;
  const fatigueScore = todayFatigue != null
    ? Math.round((todayFatigue / 10) * W.fatigue)
    : 0;

  // ── Life stress (3-day rolling avg) ──
  const recentLifeStress = readings
    .filter((r) => r.date <= today && r.lifeStress != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((r) => r.lifeStress!);
  const lifeAvg = recentLifeStress.length > 0
    ? recentLifeStress.reduce((a, b) => a + b, 0) / recentLifeStress.length
    : null;
  const lifeScore = lifeAvg != null ? Math.round((lifeAvg / 10) * W.life) : 0;

  // ── Recovery deficit (HRV + RHR z-scores) ──
  const todayR = readings.find((r) => r.date === today);
  const hrvZ = todayR?.hrvMs != null
    ? (todayR.hrvMs - baseline.hrv.mean) / baseline.hrv.sd
    : null;
  const rhrZ = todayR?.rhrBpm != null
    ? (todayR.rhrBpm - baseline.rhr.mean) / baseline.rhr.sd
    : null;
  const half = W.recovery / 2;
  const recoveryScore = Math.round(
    Math.min(half, Math.max(0, -(hrvZ ?? 0)) / 2 * half) +
    Math.min(half, Math.max(0,  (rhrZ ?? 0)) / 2 * half)
  );

  // Recovery bonus for deliberate rest days — reduces total score by up to 4 points.
  // More impactful when already loaded (up to 30% of current deficit).
  const restTakenToday = sessions.some(
    (s) => s.date === today && s.actual?.restTaken === true
  );
  const restBonus = restTakenToday ? Math.min(4, Math.round(recoveryScore * 0.3) + 1) : 0;

  const score = Math.max(0, Math.min(100, trainingScore + fatigueScore + lifeScore + recoveryScore - restBonus));

  const level: LoadLevel =
    score >= 75 ? "critical" :
    score >= 55 ? "red" :
    score >= 35 ? "amber" :
    "green";

  return {
    score,
    level,
    restBonus,
    training:        { acute, chronic, ratio: Math.round(acwr * 100) / 100, score: trainingScore, insufficient },
    legFatigue:      { value: todayFatigue, score: fatigueScore },
    recoveryDeficit: { hrvZ, rhrZ, score: recoveryScore },
    lifeStress:      { avg: lifeAvg != null ? Math.round(lifeAvg * 10) / 10 : null, score: lifeScore },
    ...buildCopy(level, acwr, lifeAvg, todayFatigue, hrvZ, rhrZ, score, insufficient, restTakenToday),
  };
}

// ── Training load helpers ─────────────────────────────────

// Returns load in RPE×min units (or TSS×6 for power-based, to keep same scale).
// Never uses km as a proxy — cycling km ≠ running km in physiological terms.
function sessionLoad(s: Session, ftpW?: number): number {
  const a = s.actual;

  // Power-based TSS for cycling when power + FTP are available
  // TSS = (durationHours × avgPower²/FTP²) × 100
  // Scaled ×6 to match RPE×duration units (1hr @ threshold ≈ 420 both ways)
  if ((s.category === "bike" || s.category === "brick") && a?.avgPowerW && ftpW) {
    const hrs = (a.durationMin ?? 0) / 60;
    const tss = hrs * Math.pow(a.avgPowerW / ftpW, 2) * 100;
    return tss * 6;
  }

  // RPE × duration (Session-RPE method — unit-agnostic: works for run, bike, brick)
  const dur = a?.durationMin ?? s.targetDurationMin ?? 0;
  const rpe = a?.rpe ?? EST_RPE_FALLBACK[s.category] ?? 5;
  return dur * rpe;
}

function isoMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeTrainingLoad(
  today: string,
  sessions: Session[],
  ftpW?: number,
  typicalWeeklyHours?: number
): { acute: number; chronic: number; insufficient: boolean } {
  const day7  = isoMinusDays(today, 7);
  const day28 = isoMinusDays(today, 28);

  const done = sessions.filter((s) =>
    s.date <= today && s.date > day28 && s.status === "done" && s.actual
  );

  const acute = done
    .filter((s) => s.date > day7)
    .reduce((sum, s) => sum + sessionLoad(s, ftpW), 0);

  // Seeded chronic from the user's known typical load.
  // typicalWeeklyHours × 60min × TYPICAL_RPE = weekly load units (7-day equivalent).
  const seededChronic = typicalWeeklyHours
    ? typicalWeeklyHours * 60 * TYPICAL_RPE
    : 0;

  // Data-driven chronic from logged sessions.
  const dataChronic = done.length > 0
    ? (done.reduce((sum, s) => sum + sessionLoad(s, ftpW), 0) / 28) * 7
    : 0;

  // Blend: weight shifts from seeded → data as more sessions accumulate.
  // At 0 sessions: fully seeded. At MIN_LOGGED sessions: fully data-driven.
  const dataWeight = Math.min(1, done.length / MIN_LOGGED_FOR_FULL_ACWR);
  const chronic = seededChronic > 0
    ? seededChronic * (1 - dataWeight) + dataChronic * dataWeight
    : dataChronic;

  const insufficient = seededChronic === 0 && done.length < 5;

  return {
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    insufficient,
  };
}

// ── Copy ──────────────────────────────────────────────────

function buildCopy(
  level: LoadLevel,
  acwr: number,
  lifeAvg: number | null,
  legFatigue: number | null,
  hrvZ: number | null,
  rhrZ: number | null,
  score: number,
  insufficient: boolean,
  restTaken: boolean = false
): { headline: string; insight: string } {
  const parts: string[] = [];

  if (insufficient) {
    parts.push(`training history building (need ${MIN_LOGGED_FOR_FULL_ACWR} logged sessions for full ACWR)`);
  } else if (acwr > 1.3) parts.push(`acute:chronic ratio ${acwr.toFixed(2)} — above the safe window`);
  else if (acwr >= 0.8) parts.push(`training load in range (ACWR ${acwr.toFixed(2)})`);
  else if (acwr >= 0.3) parts.push(`light training week so far (ACWR ${acwr.toFixed(2)})`);
  else if (acwr > 0) parts.push(`very light load today (ACWR ${acwr.toFixed(2)}) — taper / recovery week`);

  if (legFatigue != null) {
    if (legFatigue >= 8) parts.push(`legs very heavy (${legFatigue}/10) — significant accumulated fatigue`);
    else if (legFatigue >= 6) parts.push(`moderate leg fatigue (${legFatigue}/10)`);
    else if (legFatigue >= 4) parts.push(`mild leg fatigue (${legFatigue}/10)`);
    else parts.push(`legs feeling fresh (${legFatigue}/10)`);
  } else {
    parts.push("leg fatigue not logged");
  }

  if (lifeAvg != null) {
    if (lifeAvg >= 7) parts.push(`life stress elevated (avg ${lifeAvg.toFixed(1)}/10)`);
    else if (lifeAvg >= 5) parts.push(`moderate life stress (${lifeAvg.toFixed(1)}/10)`);
    else parts.push(`life stress low (${lifeAvg.toFixed(1)}/10)`);
  } else {
    parts.push("life stress not yet logged");
  }

  if (hrvZ != null && rhrZ != null) {
    if (hrvZ < -1 && rhrZ > 0.5) parts.push("HRV suppressed + RHR elevated — body carrying accumulated load");
    else if (hrvZ < -1) parts.push("HRV below baseline");
    else if (rhrZ > 1) parts.push("RHR elevated");
    else parts.push("recovery metrics look normal");
  }

  if (restTaken) parts.push("full rest taken today — recovery investment applied ✦");

  const headlines: Record<LoadLevel, string> = {
    green:    "Body load manageable",
    amber:    "Load building — stay intentional",
    red:      "High load — recovery is the priority",
    critical: "Critical load — pull back now",
  };

  return {
    headline: restTaken ? `${headlines[level]} · rest day ✦` : headlines[level],
    insight: parts.join(". ") + ".",
  };
}
