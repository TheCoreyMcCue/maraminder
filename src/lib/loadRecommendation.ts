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
  rhr?:   { value: number; devBpm: number; devPct: number; z: number };
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

  const legFatigue = reading.legFatigue ?? null;

  // ── Determine level ────────────────────────────────────
  const hrvAmber  = hrvZ != null && hrvZ <= -0.5  && hrvZ > -1.5;
  const hrvRed    = hrvZ != null && hrvZ <= -1.5;
  const rhrAmber  = rhrZ != null && rhrZ >= 0.5   && rhrZ < 1.5;
  const rhrRed    = rhrZ != null && rhrZ >= 1.5;
  const sleepBad  = sleepOk === false;
  const legsHeavy = legFatigue != null && legFatigue >= 7;
  const legsVeryHeavy = legFatigue != null && legFatigue >= 9;
  const trend     = checkMultiDayDecline(recentReadings, baseline);

  let level: LoadLevel;
  if ((hrvRed && (rhrRed || rhrAmber)) || (rhrRed && (hrvRed || hrvAmber)) || trend || legsVeryHeavy) {
    level = "red";
  } else if (hrvRed || rhrRed || hrvAmber || rhrAmber || sleepBad || legsHeavy) {
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
    sessionAdvice: buildSessionAdvice(level, todaySessions, legFatigue),
    hrv: reading.hrvMs != null && hrvZ != null
      ? { value: reading.hrvMs, devPct: ((reading.hrvMs - baseline.hrv.mean) / baseline.hrv.mean) * 100, z: hrvZ }
      : undefined,
    rhr: reading.rhrBpm != null && rhrZ != null
      ? {
          value: reading.rhrBpm,
          devBpm: reading.rhrBpm - baseline.rhr.mean,
          devPct: ((reading.rhrBpm - baseline.rhr.mean) / baseline.rhr.mean) * 100,
          z: rhrZ,
        }
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
  // Actual % deviation — (value − mean) / mean × 100. Never use z × 10.
  const hrvPct = reading.hrvMs != null
    ? Math.round((reading.hrvMs - baseline.hrv.mean) / baseline.hrv.mean * 100)
    : null;
  const rhrDiff = reading.rhrBpm != null ? reading.rhrBpm - baseline.rhr.mean : null;

  const hrvStr = hrvPct != null
    ? `HRV ${reading.hrvMs}ms (${hrvPct >= 0 ? "+" : ""}${hrvPct}% vs baseline)`
    : null;
  const rhrStr = rhrDiff != null
    ? `RHR ${reading.rhrBpm}bpm (${fmtBpmDiff(rhrDiff)})`
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
    const hrvDriven  = hrvZ != null && hrvZ <= -0.5;
    const sleepDriven = sleepHours != null && sleepHours < baseline.sleepTargetHours - 1
      && !hrvDriven && (rhrZ == null || rhrZ < 0.5);
    const legsDriven = (reading.legFatigue ?? 0) >= 7;
    const headline = sleepDriven     ? "Poor sleep — reduce intensity"
      : hrvDriven                    ? "Recovery dip — keep today easy"
      : legsDriven                   ? "Heavy legs — protect intensity"
      : "Mild strain — take the conservative end of each zone";
    return {
      headline,
      rationale: `${dataLine}. ${trend ? "Two-day downward trend. " : ""}${headline.split("—")[1]?.trim() ?? "Proceed carefully"}.`,
    };
  }

  // red
  return {
    headline: "Significant fatigue — easy day only",
    rationale: `${dataLine}. ${trend ? "Multi-day decline — accumulated load. " : "Both HRV and RHR are off together. "}Protect quality sessions; don't compound the stress.`,
  };
}


function fmtBpmDiff(diff: number): string {
  if (Math.abs(diff) < 1) return "at baseline";
  return `${diff > 0 ? "+" : ""}${Math.round(diff)}bpm vs baseline`;
}

// ── Session-specific advice ───────────────────────────────

const ANCHOR_CATS = new Set(["threshold", "vo2", "mp", "long", "race", "brick"]);

function buildSessionAdvice(level: LoadLevel, sessions: Session[], legFatigue?: number | null): SessionAdvice[] {
  return sessions
    .filter((s) => s.status !== "skipped")
    .map((s) => {
      const isAnchor = s.type === "anchor" || ANCHOR_CATS.has(s.category);
      const advice = getSessionAdvice(level, s.category, isAnchor, legFatigue);
      return advice ? { sk: s.sk, title: s.title, advice } : null;
    })
    .filter((a): a is SessionAdvice => a !== null);
}

function getSessionAdvice(
  level: LoadLevel,
  category: Session["category"],
  isAnchor: boolean,
  legFatigue?: number | null
): string | null {
  const heavyLegs = legFatigue != null && legFatigue >= 7;
  const veryHeavyLegs = legFatigue != null && legFatigue >= 9;

  if (level === "green") {
    if (veryHeavyLegs && isAnchor)
      return `Legs very heavy (${legFatigue}/10). Consider dropping 1 rep/set or cap the session at 80% planned volume.`;
    if (heavyLegs && (category === "threshold" || category === "vo2"))
      return `Legs reporting heavy (${legFatigue}/10). Complete the session but stay conservative on pace — let the data not the ego set the effort.`;
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
