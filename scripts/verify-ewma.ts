/**
 * EWMA-ACWR verification: prints daily acute_ewma, chronic_ewma, ACWR, training_score
 * for a simulated schedule containing the Jun 21 70.3 race.
 *
 * Run: npx tsx scripts/verify-ewma.ts
 */

import { runEwma, EWMA_ACUTE_N, EWMA_CHRONIC_N } from "../src/lib/loadFactor";

// ── Tunables ─────────────────────────────────────────────
const TYPICAL_HRR = 0.65;
const typicalWeeklyHours = 8;    // hrs/week → seed
const weeklyTrimp = typicalWeeklyHours * 60 * TYPICAL_HRR * 0.64 * Math.exp(1.92 * TYPICAL_HRR);
const seedDailyLoad = weeklyTrimp / 7;

const ACWR_LOW     = 0.8;
const ACWR_SAFE_HI = 1.3;
const ACWR_WARN_HI = 1.5;
const ACWR_DANGER  = 1.8;

function lerp(x: number, x0: number, x1: number, y0: number, y1: number) {
  return y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
}
function acwrToScore(acwr: number) {
  if (acwr <= ACWR_LOW)     return lerp(acwr, 0,           ACWR_LOW,      0,  4);
  if (acwr <= ACWR_SAFE_HI) return lerp(acwr, ACWR_LOW,    ACWR_SAFE_HI,  4, 10);
  if (acwr <= ACWR_WARN_HI) return lerp(acwr, ACWR_SAFE_HI, ACWR_WARN_HI, 10, 28);
  return Math.min(40, lerp(acwr, ACWR_WARN_HI, ACWR_DANGER, 28, 40));
}

// ── Simulated daily TRIMP (based on real bridge-2026 schedule + 70.3 race) ──
// Run TRIMP: dur_min × hrr × 0.64 × exp(1.92 × hrr)
// 70.3 race: aprox 270min, avg HR 169, hrMax 194, hrRest 47 → hrr=(169-47)/(194-47)=0.830
// hrr=0.830 → TRIMP = 270 × 0.830 × 0.64 × exp(1.92×0.830) = 270 × 0.830 × 0.64 × 4.976 ≈ 714

const hrr_race = (169 - 47) / (194 - 47);  // 0.830
const trimp_race = 270 * hrr_race * 0.64 * Math.exp(1.92 * hrr_race);

// Easy run TRIMP: 50min, hrr≈0.55 → 50 × 0.55 × 0.64 × exp(1.92×0.55) ≈ 50 × 0.55 × 0.64 × 2.87 ≈ 50.5
const hrr_easy = 0.55;
const trimp_easy = 50 * hrr_easy * 0.64 * Math.exp(1.92 * hrr_easy);

// Threshold: 50min, hrr≈0.88 → 50 × 0.88 × 0.64 × exp(1.92×0.88) ≈ 50 × 0.88 × 0.64 × 5.54 ≈ 156
const hrr_threshold = 0.88;
const trimp_threshold = 50 * hrr_threshold * 0.64 * Math.exp(1.92 * hrr_threshold);

// Build daily loads map (keyed as YYYY-MM-DD)
const dailyLoads = new Map<string, number>([
  // W1 taper (light)
  ["2026-06-09", trimp_easy * 0.6],   // Tue: bike intervals (approx)
  ["2026-06-10", trimp_easy * 0.5],   // Wed: run w/ goal-pace block
  ["2026-06-13", trimp_easy * 0.8],   // Sat: gear-test brick
  ["2026-06-14", trimp_easy * 0.6],   // Sun: easy run
  // W2 race week
  ["2026-06-15", trimp_easy * 0.5],   // Mon: easy + openers
  ["2026-06-16", trimp_easy * 0.4],   // Tue: easy run
  ["2026-06-18", trimp_easy * 0.3],   // Thu: short opener
  ["2026-06-20", trimp_easy * 0.2],   // Sat: travel openers
  ["2026-06-21", trimp_race],         // Sun: ★ 70.3 RACE
  // W3 post-race recovery
  ["2026-06-23", trimp_easy * 0.4],   // Tue: active recovery spin (approx)
  ["2026-06-24", trimp_easy * 0.5],   // Wed: easy run (today is Jun 25)
  ["2026-06-25", trimp_easy * 0.5],   // Thu: easy or rest
  ["2026-06-26", trimp_easy * 0.6],   // Fri: easy run
  ["2026-06-27", trimp_easy * 0.7],   // Sat: easy + strides
  ["2026-06-28", trimp_easy * 1.2],   // Sun: easy return long
  // W4 rebuild
  ["2026-06-29", trimp_easy],         // Mon
  ["2026-06-30", trimp_threshold],    // Tue: light quality
  ["2026-07-01", trimp_easy],         // Wed
  ["2026-07-02", trimp_easy],         // Thu: easy + strides
]);

console.log(`\nSeed daily TRIMP (from ${typicalWeeklyHours}h/week): ${seedDailyLoad.toFixed(1)}`);
console.log(`Race TRIMP (70.3, 270min, HR 169): ${trimp_race.toFixed(1)}`);
console.log(`Easy run TRIMP (50min): ${trimp_easy.toFixed(1)}`);
console.log(`Threshold TRIMP (50min): ${trimp_threshold.toFixed(1)}`);
console.log(`EWMA windows: acute N=${EWMA_ACUTE_N}, chronic N=${EWMA_CHRONIC_N}\n`);

// ── Print daily table Jun 18 → Jul 2 ─────────────────────
const VERIFY_START = "2026-06-18";
const VERIFY_END   = "2026-07-02";

console.log("Date        Load      AcuteEWMA  ChronicEWMA  ACWR    TrainScore");
console.log("──────────  ────────  ─────────  ───────────  ──────  ──────────");

const cur = new Date(VERIFY_START + "T12:00:00");
const end = new Date(VERIFY_END   + "T12:00:00");

while (cur <= end) {
  const d = cur.toISOString().slice(0, 10);
  const { acuteEwma, chronicEwma } = runEwma(dailyLoads, d, seedDailyLoad);
  const acwr = chronicEwma > 0 ? acuteEwma / chronicEwma : 0;
  const score = Math.round(acwrToScore(acwr));
  const load = dailyLoads.get(d) ?? 0;
  const flag = d === "2026-06-21" ? " ← RACE" : d === "2026-06-25" ? " ← today" : d === "2026-06-29" ? " ← old cliff date" : "";
  console.log(
    `${d}  ${load.toFixed(1).padStart(8)}  ${acuteEwma.toFixed(1).padStart(9)}  ${chronicEwma.toFixed(1).padStart(11)}  ${acwr.toFixed(3).padStart(6)}  ${score.toString().padStart(10)}${flag}`
  );
  cur.setDate(cur.getDate() + 1);
}

// ── Jun 24 composite sanity check ────────────────────────
const jun25 = runEwma(dailyLoads, "2026-06-25", seedDailyLoad);
const acwr25 = jun25.chronicEwma > 0 ? jun25.acuteEwma / jun25.chronicEwma : 0;
const trainScore25 = Math.round(acwrToScore(acwr25));
// HRV ~68, baseline 67±10 → hrvZ = (68-67)/10 = 0.1 → contributes 0 recovery pts
// RHR ~48, baseline 53±3 → rhrZ = (48-53)/3 = -1.67 → below baseline = 0 recovery pts
const recoveryScore25 = 0; // both metrics looking good
const fatigueScore25  = Math.round((3 / 10) * 10); // legFatigue 3 → 3 pts
const lifeScore25     = 0; // not logged
const total25 = trainScore25 + recoveryScore25 + fatigueScore25 + lifeScore25;

console.log(`\n── Jun 25 composite (HRV ~68 / RHR ~48 / legFatigue 3) ──`);
console.log(`  Training:    ${trainScore25}/40  (ACWR ${acwr25.toFixed(3)})`);
console.log(`  Recovery:    ${recoveryScore25}/40  (HRV+0.1σ, RHR-1.67σ → metrics normal)`);
console.log(`  Leg fatigue: ${fatigueScore25}/10  (3/10 logged)`);
console.log(`  Life:        ${lifeScore25}/10  (not logged)`);
console.log(`  ─────────────────`);
console.log(`  TOTAL:       ${total25}/100  → ${total25 >= 75 ? "CRITICAL" : total25 >= 55 ? "RED" : total25 >= 35 ? "AMBER" : "GREEN"}`);
console.log();
