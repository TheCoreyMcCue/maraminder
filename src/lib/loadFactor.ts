import type { RecoveryReading, Session, PersonalBaseline } from "./types";

export type LoadLevel = "green" | "amber" | "red" | "critical";

// ── ACWR transfer-function breakpoints (tunable) ──────────
const ACWR_LOW      = 0.8;   // below → under-training territory
const ACWR_SAFE_HI  = 1.3;   // safe band upper edge
const ACWR_WARN_HI  = 1.5;   // caution zone upper edge
const ACWR_DANGER   = 1.8;   // score maxes out here

// ── Banister TRIMP defaults ───────────────────────────────
const HR_MAX_DEFAULT  = 194;
const HR_REST_DEFAULT = 47;

// Category HRR estimates — used only when no HR/RPE is logged.
// HRR = (avgHr - HRrest) / (HRmax - HRrest).
const CAT_HRR: Record<string, number> = {
  easy: 0.55, steady: 0.75, mp: 0.82, threshold: 0.88, vo2: 0.95,
  long: 0.60, race: 0.90, bike: 0.55, brick: 0.75, rest: 0,
};

// Typical HRR for seeding chronic EWMA from typicalWeeklyHours.
const TYPICAL_HRR = 0.65;

// ── EWMA-ACWR parameters (Williams/Murray 2017) ──────────
// Exposed as named constants so callers can reference the window lengths.
export const EWMA_ACUTE_N   = 7;                          // acute window (days)
export const EWMA_CHRONIC_N = 28;                         // chronic window (days)
const LAMBDA_A = 2 / (EWMA_ACUTE_N   + 1);               // 0.25
const LAMBDA_C = 2 / (EWMA_CHRONIC_N + 1);               // ≈ 0.0690

// Days of history used to run the EWMAs forward from the seed.
// 60 days reduces the seed's influence on chronic to < 2 % ((1-λ_c)^60 ≈ 0.013).
const EWMA_HISTORY_DAYS = 60;

// Once this many sessions are logged, the seed has negligible structural influence.
const MIN_LOGGED_FOR_FULL_ACWR = 10;

// Component weights — must sum to 100.
const W = { training: 40, recovery: 40, fatigue: 10, life: 10 } as const;

export interface LoadFactorResult {
  score: number;          // 0–100
  level: LoadLevel;
  restBonus: number;
  training: {
    acuteEwma: number;   // EWMA over last ~7 days (TRIMP units)
    chronicEwma: number; // EWMA over last ~28 days (TRIMP units)
    ratio: number;       // acuteEwma / chronicEwma
    score: number;       // 0–40
    insufficient: boolean;
    taperCapped: boolean;
    acwrColor: string;   // green / amber / red by zone
  };
  legFatigue: {
    value: number | null;
    score: number;        // 0–10
  };
  recoveryDeficit: {
    hrvZ: number | null;
    rhrZ: number | null;
    score: number;        // 0–40
  };
  lifeStress: {
    avg: number | null;
    score: number;        // 0–10
  };
  headline: string;
  insight: string;
}

// ── Helpers ───────────────────────────────────────────────

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  return y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
}

function acwrToScore(acwr: number): number {
  if (acwr <= ACWR_LOW)     return lerp(acwr, 0,           ACWR_LOW,     0,  4);
  if (acwr <= ACWR_SAFE_HI) return lerp(acwr, ACWR_LOW,    ACWR_SAFE_HI, 4,  10);
  if (acwr <= ACWR_WARN_HI) return lerp(acwr, ACWR_SAFE_HI, ACWR_WARN_HI, 10, 28);
  return Math.min(40, lerp(acwr, ACWR_WARN_HI, ACWR_DANGER, 28, 40));
}

function acwrColor(acwr: number): string {
  if (acwr > ACWR_WARN_HI) return "#ef4444";
  if (acwr > ACWR_SAFE_HI) return "#f59e0b";
  return "#22c55e";
}

// ── Banister TRIMP for a single session ──────────────────
// Exported so the /api/export route can build the same daily-load series.

export function sessionTrimp(
  s: Session,
  ftpW?: number,
  hrMax = HR_MAX_DEFAULT,
  hrRest = HR_REST_DEFAULT,
): number {
  const a = s.actual;
  const dur = a?.durationMin ?? s.targetDurationMin ?? 0;
  if (!dur) return 0;

  // Power-based: derive HRR from IF (avgPower/FTP) for consistent TRIMP currency.
  if ((s.category === "bike" || s.category === "brick") && a?.avgPowerW && ftpW) {
    const hrr = Math.min(1, Math.max(0, a.avgPowerW / ftpW));
    return dur * hrr * 0.64 * Math.exp(1.92 * hrr);
  }

  // Heart-rate based, then RPE-based, then category default.
  let hrr: number;
  if (a?.avgHr != null) {
    hrr = Math.min(1, Math.max(0, (a.avgHr - hrRest) / (hrMax - hrRest)));
  } else if (a?.rpe != null) {
    hrr = Math.min(1, Math.max(0, a.rpe / 10));
  } else {
    hrr = CAT_HRR[s.category] ?? 0.65;
  }

  return dur * hrr * 0.64 * Math.exp(1.92 * hrr);
}

// ── EWMA runner (pure — no side effects, no Date.now()) ──

/**
 * Run both EWMAs forward from (asOf − EWMA_HISTORY_DAYS) to asOf.
 * Both are seeded at seedDailyLoad. Days absent from dailyLoads are treated
 * as 0 — the EWMAs decay on every rest day, which is essential for the
 * smooth-decay property.
 *
 * Exported so the /api/export route can call it with its own load map.
 */
export function runEwma(
  dailyLoads: Map<string, number>,
  asOf: string,
  seedDailyLoad: number,
): { acuteEwma: number; chronicEwma: number } {
  let acuteEwma   = seedDailyLoad;
  let chronicEwma = seedDailyLoad;

  const cur = new Date(asOf + "T12:00:00");
  cur.setDate(cur.getDate() - EWMA_HISTORY_DAYS);
  const end = new Date(asOf + "T12:00:00");

  while (cur <= end) {
    const d    = cur.toISOString().slice(0, 10);
    const load = dailyLoads.get(d) ?? 0;
    acuteEwma   = load * LAMBDA_A + acuteEwma   * (1 - LAMBDA_A);
    chronicEwma = load * LAMBDA_C + chronicEwma * (1 - LAMBDA_C);
    cur.setDate(cur.getDate() + 1);
  }

  return { acuteEwma, chronicEwma };
}

// ── EWMA-ACWR (main training load computation) ────────────

function computeEwmaAcwr(
  today: string,
  sessions: Session[],
  ftpW?: number,
  typicalWeeklyHours?: number,
  hrMax = HR_MAX_DEFAULT,
  hrRest = HR_REST_DEFAULT,
): { acuteEwma: number; chronicEwma: number; acwr: number; insufficient: boolean } {
  // Convert typicalWeeklyHours → per-day TRIMP seed.
  // Both EWMAs start here; real data blends in as the EWMA walks forward.
  const weeklyTrimp = typicalWeeklyHours
    ? typicalWeeklyHours * 60 * TYPICAL_HRR * 0.64 * Math.exp(1.92 * TYPICAL_HRR)
    : 0;
  const seedDailyLoad = weeklyTrimp / 7;

  // Build date → TRIMP map. Multiple sessions on the same date are summed.
  // Days with no sessions are intentionally absent (treated as 0 in runEwma).
  const dailyLoads = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== "done" || !s.actual) continue;
    const trimp = sessionTrimp(s, ftpW, hrMax, hrRest);
    if (trimp > 0) dailyLoads.set(s.date, (dailyLoads.get(s.date) ?? 0) + trimp);
  }

  const done = sessions.filter((s) => s.status === "done" && s.actual);
  const insufficient = seedDailyLoad === 0 && done.length < MIN_LOGGED_FOR_FULL_ACWR;

  const { acuteEwma, chronicEwma } = runEwma(dailyLoads, today, seedDailyLoad);
  const acwr = (insufficient || chronicEwma === 0) ? 0 : acuteEwma / chronicEwma;

  return {
    acuteEwma:   Math.round(acuteEwma   * 10) / 10,
    chronicEwma: Math.round(chronicEwma * 10) / 10,
    acwr:        Math.round(acwr        * 100) / 100,
    insufficient,
  };
}

// ── Main entry ────────────────────────────────────────────

export function computeLoadFactor(
  today: string,
  sessions: Session[],
  readings: RecoveryReading[],
  baseline: PersonalBaseline,
  currentWeek?: { phase: string; isDownWeek: boolean }
): LoadFactorResult {

  const ftpW = baseline.ftpW;
  const typicalWeeklyHours = baseline.typicalWeeklyHours;
  const hrMax = baseline.hrMax ?? HR_MAX_DEFAULT;
  const hrRest = baseline.hrRest ?? HR_REST_DEFAULT;

  // Cap only for intentional low-load phases: pre-race taper and race week itself.
  // isDownWeek and "Post-race recovery" are excluded — the load in those contexts is
  // real (e.g. the race happened yesterday) and should be reflected in the score.
  const isTaperWeek = currentWeek != null && (
    /taper/i.test(currentWeek.phase) ||
    /^race\s*(week|wk)\b/i.test(currentWeek.phase)
  );

  // ── Training load (EWMA-ACWR) ──
  const { acuteEwma, chronicEwma, acwr, insufficient } =
    computeEwmaAcwr(today, sessions, ftpW, typicalWeeklyHours, hrMax, hrRest);

  const rawTrainingScore = insufficient ? 0 : Math.round(acwrToScore(acwr));
  const trainingScore = isTaperWeek
    ? Math.min(10, rawTrainingScore)
    : rawTrainingScore;

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
  const restTakenToday = sessions.some(
    (s) => s.date === today && s.actual?.restTaken === true
  );
  const restBonus = restTakenToday ? Math.min(4, Math.round(recoveryScore * 0.3) + 1) : 0;

  const score = Math.max(0, Math.min(100,
    trainingScore + fatigueScore + lifeScore + recoveryScore - restBonus
  ));

  const level: LoadLevel =
    score >= 75 ? "critical" :
    score >= 55 ? "red" :
    score >= 35 ? "amber" :
    "green";

  return {
    score,
    level,
    restBonus,
    training: {
      acuteEwma,
      chronicEwma,
      ratio:        Math.round(acwr * 100) / 100,
      score:        trainingScore,
      insufficient,
      taperCapped:  isTaperWeek && rawTrainingScore > 10,
      acwrColor:    acwrColor(acwr),
    },
    legFatigue:      { value: todayFatigue, score: fatigueScore },
    recoveryDeficit: { hrvZ, rhrZ, score: recoveryScore },
    lifeStress:      { avg: lifeAvg != null ? Math.round(lifeAvg * 10) / 10 : null, score: lifeScore },
    ...buildCopy(level, acwr, lifeAvg, todayFatigue, hrvZ, rhrZ, score, insufficient, restTakenToday, isTaperWeek,
      { trainingScore, fatigueScore, recoveryScore, lifeScore }),
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
  restTaken: boolean = false,
  isTaperWeek: boolean = false,
  components?: { trainingScore: number; fatigueScore: number; recoveryScore: number; lifeScore: number }
): { headline: string; insight: string } {
  const parts: string[] = [];

  const dominant = components
    ? Object.entries(components).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  if (insufficient) {
    parts.push(`training history building (need ${MIN_LOGGED_FOR_FULL_ACWR} logged sessions for full ACWR)`);
  } else if (isTaperWeek) {
    parts.push(`taper/race week — load ratio reads high by design, not a concern (ACWR ${acwr.toFixed(2)})`);
  } else if (acwr > ACWR_SAFE_HI) {
    parts.push(`acute:chronic ratio ${acwr.toFixed(2)} — above the safe window`);
  } else if (acwr >= ACWR_LOW) {
    parts.push(`training load in range (ACWR ${acwr.toFixed(2)})`);
  } else if (acwr >= 0.3) {
    parts.push(`light training week so far (ACWR ${acwr.toFixed(2)})`);
  } else if (acwr > 0) {
    parts.push(`very light load today (ACWR ${acwr.toFixed(2)}) — taper / recovery week`);
  }

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

  const dominantHeadline = (): string => {
    if (isTaperWeek) return "Taper/race week — body absorbing the work";
    if (level === "green") return acwr > 1.0 ? "Strong adaptation signal" : "Body load manageable";
    if (level === "critical") return "Critical load — pull back now";
    if (dominant === "recoveryScore") {
      return level === "red" ? "Recovery down — easy day only" : "Recovery dip — keep today easy";
    }
    if (dominant === "trainingScore") {
      return level === "red" ? "Load too high — back off" : "Load building — stay intentional";
    }
    if (dominant === "fatigueScore") {
      return level === "red" ? "Heavy legs — rest or very easy" : "Legs reporting fatigue — protect intensity";
    }
    if (dominant === "lifeScore") {
      return level === "red" ? "Life stress high — guard recovery" : "Life stress elevated — stay intentional";
    }
    return level === "red" ? "High load — recovery is the priority" : "Load building — stay intentional";
  };

  const headline = restTaken ? `${dominantHeadline()} · rest day ✦` : dominantHeadline();

  return { headline, insight: parts.join(". ") + "." };
}
