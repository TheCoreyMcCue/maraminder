import type { RecoveryReading, Session, PersonalBaseline } from "./types";

// Intensity multiplier per category (load = km × multiplier)
const INTENSITY: Record<string, number> = {
  easy:      1.0,
  steady:    1.5,
  mp:        2.0,
  threshold: 3.0,
  vo2:       4.0,
  long:      1.2,
  race:      3.5,
  bike:      0.7,
  brick:     2.5,
  rest:      0,
};

export type LoadLevel = "green" | "amber" | "red" | "critical";

export interface LoadFactorResult {
  score: number;          // 0–100
  level: LoadLevel;
  training: {
    acute: number;        // 7-day load
    chronic: number;      // 28-day baseline (normalized to 7d)
    ratio: number;        // ACWR
    score: number;        // 0–33 contribution
  };
  lifeStress: {
    avg: number | null;   // 3-day rolling avg of 1–10
    score: number;        // 0–33 contribution
  };
  recoveryDeficit: {
    hrvZ: number | null;
    rhrZ: number | null;
    score: number;        // 0–34 contribution
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

  // ── Training load (ACWR) ──
  const { acute, chronic } = computeTrainingLoad(today, sessions);
  const acwr = chronic > 0 ? acute / chronic : (acute > 0 ? 1.0 : 0);
  // Score: 0 at ACWR ≤0.8 (safe), ramps to 33 at ACWR ≥1.5
  const trainingScore = Math.round(Math.min(33, Math.max(0, (acwr - 0.8) / 0.7) * 33));

  // ── Life stress (3-day rolling avg) ──
  const recentLifeStress = readings
    .filter((r) => r.date <= today && r.lifeStress != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((r) => r.lifeStress!);
  const lifeAvg = recentLifeStress.length > 0
    ? recentLifeStress.reduce((a, b) => a + b, 0) / recentLifeStress.length
    : null;
  // Score: linear 0–33 across the 1–10 scale
  const lifeScore = lifeAvg != null ? Math.round((lifeAvg / 10) * 33) : 0;

  // ── Recovery deficit (HRV + RHR z-scores) ──
  const todayR = readings.find((r) => r.date === today);
  const hrvZ = todayR?.hrvMs != null
    ? (todayR.hrvMs - baseline.hrv.mean) / baseline.hrv.sd
    : null;
  const rhrZ = todayR?.rhrBpm != null
    ? (todayR.rhrBpm - baseline.rhr.mean) / baseline.rhr.sd
    : null;
  // Each metric contributes up to 17 points; negative HRV z = deficit, positive RHR z = deficit
  const recoveryScore = Math.round(
    Math.min(17, Math.max(0, -(hrvZ ?? 0)) / 2 * 17) +
    Math.min(17, Math.max(0,  (rhrZ ?? 0)) / 2 * 17)
  );

  const score = Math.min(100, trainingScore + lifeScore + recoveryScore);

  const level: LoadLevel =
    score >= 75 ? "critical" :
    score >= 55 ? "red" :
    score >= 35 ? "amber" :
    "green";

  return {
    score,
    level,
    training:        { acute, chronic, ratio: Math.round(acwr * 100) / 100, score: trainingScore },
    lifeStress:      { avg: lifeAvg != null ? Math.round(lifeAvg * 10) / 10 : null, score: lifeScore },
    recoveryDeficit: { hrvZ, rhrZ, score: recoveryScore },
    ...buildCopy(level, acwr, lifeAvg, hrvZ, rhrZ, score),
  };
}

// ── Training load helpers ─────────────────────────────────

function sessionLoad(s: Session): number {
  const km = (s.actual?.distanceKm ?? s.targetDistanceKm ?? 0);
  return km * (INTENSITY[s.category] ?? 1.0);
}

function isoMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeTrainingLoad(today: string, sessions: Session[]): { acute: number; chronic: number } {
  const day7  = isoMinusDays(today, 7);
  const day28 = isoMinusDays(today, 28);

  const done = sessions.filter((s) =>
    s.date <= today && s.date > day28 && s.status !== "skipped"
  );

  const acute        = done.filter((s) => s.date > day7).reduce((sum, s) => sum + sessionLoad(s), 0);
  const chronicTotal = done.reduce((sum, s) => sum + sessionLoad(s), 0);
  // Normalize chronic to a 7-day equivalent for direct ACWR comparison
  const chronic = (chronicTotal / 28) * 7;

  return { acute: Math.round(acute), chronic: Math.round(chronic) };
}

// ── Copy ──────────────────────────────────────────────────

function buildCopy(
  level: LoadLevel,
  acwr: number,
  lifeAvg: number | null,
  hrvZ: number | null,
  rhrZ: number | null,
  score: number
): { headline: string; insight: string } {
  const parts: string[] = [];

  if (acwr > 1.3) parts.push(`acute:chronic ratio at ${acwr.toFixed(2)} — above the safe window`);
  else if (acwr < 0.8 && acwr > 0) parts.push(`low training load (ACWR ${acwr.toFixed(2)}) — room to build`);
  else if (acwr > 0) parts.push(`training load in range (ACWR ${acwr.toFixed(2)})`);

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

  const headlines: Record<LoadLevel, string> = {
    green:    "Body load manageable",
    amber:    "Load building — stay intentional",
    red:      "High load — recovery is the priority",
    critical: "Critical load — pull back now",
  };

  return {
    headline: headlines[level],
    insight: parts.join(". ") + ".",
  };
}
