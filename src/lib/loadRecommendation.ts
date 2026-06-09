import type { RecoveryReading, Session, PersonalBaseline } from "./types";

export type LoadLevel = "green" | "amber" | "red" | "unknown";

export interface SessionAdvice {
  sk: string;
  title: string;
  advice: string;
}

export interface DailyLoadRec {
  level: LoadLevel;
  headline: string;
  rationale: string;
  sessionAdvice: SessionAdvice[];
  hrv?:   { value: number; devPct: number; z: number };
  rhr?:   { value: number; devBpm: number; z: number };
  sleep?: { hours: number; ok: boolean };
}

// ── Main entry point ──────────────────────────────────────

export function getDailyLoadRec(
  reading: RecoveryReading | null,
  baseline: PersonalBaseline,
  todaySessions: Session[],
  recentReadings: RecoveryReading[]   // last 3 days (excl. today)
): DailyLoadRec {
  if (!reading) {
    return {
      level: "unknown",
      headline: "Log your morning metrics",
      rationale: "HRV, RHR and sleep not yet recorded for today.",
      sessionAdvice: [],
    };
  }

  // ── Compute deviations vs personal baseline ────────────
  const hrvZ = reading.hrvMs != null
    ? (reading.hrvMs - baseline.hrv.mean) / baseline.hrv.sd
    : null;
  const rhrZ = reading.rhrBpm != null
    ? (reading.rhrBpm - baseline.rhr.mean) / baseline.rhr.sd
    : null;
  const sleepHours = reading.sleepHours ?? null;
  const sleepOk = sleepHours != null ? sleepHours >= baseline.sleepTargetHours - 1 : null;

  // ── Determine level ────────────────────────────────────
  const hrvAmber  = hrvZ != null && hrvZ <= -0.5  && hrvZ > -1.5;
  const hrvRed    = hrvZ != null && hrvZ <= -1.5;
  const rhrAmber  = rhrZ != null && rhrZ >= 0.5   && rhrZ < 1.5;
  const rhrRed    = rhrZ != null && rhrZ >= 1.5;
  const sleepBad  = sleepOk === false;
  const trend     = checkMultiDayDecline(recentReadings, baseline);

  let level: LoadLevel;
  if ((hrvRed && (rhrRed || rhrAmber)) || (rhrRed && (hrvRed || hrvAmber)) || trend) {
    level = "red";
  } else if (hrvRed || rhrRed || hrvAmber || rhrAmber || sleepBad) {
    level = "amber";
  } else {
    level = "green";
  }

  // ── Copy ──────────────────────────────────────────────
  const { headline, rationale } = buildCopy(
    level, reading, baseline, hrvZ, rhrZ, sleepHours, trend
  );

  return {
    level,
    headline,
    rationale,
    sessionAdvice: buildSessionAdvice(level, todaySessions),
    hrv: reading.hrvMs != null && hrvZ != null
      ? { value: reading.hrvMs, devPct: ((reading.hrvMs - baseline.hrv.mean) / baseline.hrv.mean) * 100, z: hrvZ }
      : undefined,
    rhr: reading.rhrBpm != null && rhrZ != null
      ? { value: reading.rhrBpm, devBpm: reading.rhrBpm - baseline.rhr.mean, z: rhrZ }
      : undefined,
    sleep: sleepHours != null
      ? { hours: sleepHours, ok: sleepOk ?? true }
      : undefined,
  };
}

// ── Trend: 2+ days of declining HRV + rising RHR ─────────

function checkMultiDayDecline(readings: RecoveryReading[], _baseline: PersonalBaseline): boolean {
  if (readings.length < 2) return false;
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
  const hrv = sorted.map((r) => r.hrvMs).filter((v): v is number => v != null);
  const rhr = sorted.map((r) => r.rhrBpm).filter((v): v is number => v != null);
  if (hrv.length < 2 || rhr.length < 2) return false;
  const hrvFalling = hrv.every((v, i) => i === 0 || v < hrv[i - 1]);
  const rhrRising  = rhr.every((v, i) => i === 0 || v > rhr[i - 1]);
  return hrvFalling && rhrRising;
}

// ── Copy generation ───────────────────────────────────────

function buildCopy(
  level: LoadLevel,
  reading: RecoveryReading,
  baseline: PersonalBaseline,
  hrvZ: number | null,
  rhrZ: number | null,
  sleepHours: number | null,
  trend: boolean
): { headline: string; rationale: string } {
  const hrvStr = reading.hrvMs != null
    ? `HRV ${reading.hrvMs}ms (${fmtZ(hrvZ, true)} vs baseline)`
    : null;
  const rhrStr = reading.rhrBpm != null
    ? `RHR ${reading.rhrBpm}bpm (${fmtBpmDiff(reading.rhrBpm - baseline.rhr.mean)})`
    : null;
  const sleepStr = sleepHours != null
    ? `${sleepHours.toFixed(1)}h sleep`
    : null;
  const dataLine = [hrvStr, rhrStr, sleepStr].filter(Boolean).join(" · ");

  if (level === "green") {
    const aboveBaseline = hrvZ != null && hrvZ >= 0.5;
    return {
      headline: aboveBaseline ? "Strong day — full load" : "Good to go — proceed as planned",
      rationale: `${dataLine}. Within normal range. No adjustments needed.`,
    };
  }

  if (level === "amber") {
    const sleepOnly = sleepHours != null && sleepHours < baseline.sleepTargetHours - 1
      && (hrvZ == null || hrvZ > -0.5) && (rhrZ == null || rhrZ < 0.5);
    return {
      headline: sleepOnly ? "Poor sleep — reduce intensity" : "Mild fatigue — reduce load",
      rationale: `${dataLine}. ${trend ? "Two-day downward trend. " : ""}Proceed but take the conservative end of every zone.`,
    };
  }

  // red
  return {
    headline: "Significant fatigue — easy day",
    rationale: `${dataLine}. ${trend ? "Multi-day decline — accumulated load. " : "Both HRV and RHR are off together. "}Protect quality sessions; don't compound the stress.`,
  };
}

function fmtZ(z: number | null, higherBetter: boolean): string {
  if (z == null) return "—";
  const pct = Math.round(Math.abs(z * 10));
  const direction = higherBetter ? (z >= 0 ? "above" : "below") : (z >= 0 ? "above" : "below");
  return `${pct > 0 ? `~${pct}% ` : "≈ "}${direction} baseline`;
}

function fmtBpmDiff(diff: number): string {
  if (Math.abs(diff) < 1) return "at baseline";
  return `${diff > 0 ? "+" : ""}${Math.round(diff)}bpm vs baseline`;
}

// ── Session-specific advice ───────────────────────────────

const ANCHOR_CATS = new Set(["threshold", "vo2", "mp", "long", "race", "brick"]);

function buildSessionAdvice(level: LoadLevel, sessions: Session[]): SessionAdvice[] {
  return sessions
    .filter((s) => s.status !== "skipped")
    .map((s) => {
      const isAnchor = s.type === "anchor" || ANCHOR_CATS.has(s.category);
      const advice = getSessionAdvice(level, s.category, isAnchor);
      return advice ? { sk: s.sk, title: s.title, advice } : null;
    })
    .filter((a): a is SessionAdvice => a !== null);
}

function getSessionAdvice(level: LoadLevel, category: Session["category"], isAnchor: boolean): string | null {
  if (level === "green") {
    return isAnchor ? "Full session. Good adaptation signal today." : null;
  }

  if (level === "amber") {
    switch (category) {
      case "threshold": return "Complete, but stay at the conservative end of T zone. Stop a rep early if HR climbs above ceiling.";
      case "vo2":       return "Reduce to 4–5 reps. By feel — stop if you can't hold target pace without forcing it.";
      case "mp":        return "Proceed. Cap HR at the lower end of MP zone. Don't extend the MP blocks.";
      case "long":      return "Full duration. Keep entirely easy — no steady or MP finish today.";
      case "brick":     return "Complete, but keep the run-off easy. No intensity on the run leg.";
      case "race":      return "Race as planned. Note the data for post-race context.";
      case "easy":      return "Keep HR below 165. Don't chase pace.";
      case "bike":      return "Easy effort only. Skip any intervals today.";
      default:          return null;
    }
  }

  // red
  switch (category) {
    case "threshold":
    case "vo2":       return "Convert to easy today. Come back to this session fresher — the adaptation won't happen on a depleted system.";
    case "mp":        return "Drop the MP blocks. Run the distance easy or cut it short.";
    case "long":      return "Shorten to 60% of planned time. Keep entirely easy.";
    case "brick":     return "Easy spin only — skip the run-off or keep it to 10min very easy.";
    case "race":      return "Race as planned. Note that fatigue data is pre-race context.";
    case "easy":      return "Very easy — cap at 155bpm.";
    case "bike":      return "Easy spin or rest.";
    default:          return null;
  }
}
