import type { PlanMeta, ZoneSet, Week, Session } from "./types";

export const PLAN_PK = "PLAN#amsterdam26";

export const planMeta: PlanMeta = {
  pk: PLAN_PK,
  sk: "META",
  name: "Amsterdam Marathon Block — Sub-2:55 Build",
  raceDate: "2026-10-18",
  halfDate: "2026-09-27",
  startDate: "2026-07-20",
  goalTime: "2:54",
  goalPace: "4:08",
  currentZoneVersion: 2,
};

export const zonesV1: ZoneSet = {
  pk: PLAN_PK,
  sk: "ZONES#1",
  version: 1,
  effectiveWeek: 1,
  source: "field-anchored (pre-block)",
  zones: {
    E: { label: "Easy", paceLow: "5:00", paceHigh: "5:20", hrMax: 174 },
    S: { label: "Steady", paceLow: "4:25", paceHigh: "4:40", hrLow: 174, hrHigh: 180 },
    MP: { label: "Marathon", pace: "4:16", hrLow: 168, hrHigh: 176 },
    T: { label: "Threshold", paceLow: "3:52", paceHigh: "4:02", hrLow: 180, hrHigh: 187 },
    I: { label: "Interval", paceLow: "3:25", paceHigh: "3:40", hrMin: 188 },
  },
};

export const zonesV2: ZoneSet = {
  pk: PLAN_PK,
  sk: "ZONES#2",
  version: 2,
  effectiveWeek: 1,
  source: "Goal update — 2:54 target (Jun-6 brick: 4:07/km @ 177 HR off the bike)",
  zones: {
    E:  { label: "Easy",      paceLow: "5:00", paceHigh: "5:20", hrMax: 174 },
    S:  { label: "Steady",    paceLow: "4:25", paceHigh: "4:40", hrLow: 174, hrHigh: 180 },
    MP: { label: "Marathon",  pace: "4:08",                       hrLow: 170, hrHigh: 178 },
    T:  { label: "Threshold", paceLow: "3:52", paceHigh: "4:02", hrLow: 180, hrHigh: 187 },
    I:  { label: "Interval",  paceLow: "3:25", paceHigh: "3:40", hrMin: 188 },
  },
};

export const weeks: Week[] = [
  { pk: PLAN_PK, sk: "WEEK#01", weekNo: 1, phase: "Base / Reload", dateStart: "2026-07-20", dateEnd: "2026-07-26", volumeTargetKm: 70, volumeTargetHours: 6, isDownWeek: false, notes: "Settle in; all easy days ≤174 HR. Strides Wed+Sat, hill sprints Sat." },
  { pk: PLAN_PK, sk: "WEEK#02", weekNo: 2, phase: "Base / Reload", dateStart: "2026-07-27", dateEnd: "2026-08-02", volumeTargetKm: 74, isDownWeek: false, notes: "Strides + 1 hill-sprint set." },
  { pk: PLAN_PK, sk: "WEEK#03", weekNo: 3, phase: "Base / Reload", dateStart: "2026-08-03", dateEnd: "2026-08-09", volumeTargetKm: 76, isDownWeek: false, notes: "Consolidate base." },
  { pk: PLAN_PK, sk: "WEEK#04", weekNo: 4, phase: "Marathon-specific", dateStart: "2026-08-10", dateEnd: "2026-08-16", volumeTargetKm: 80, isDownWeek: false, notes: "MP moves into long runs. Begin race-fuel practice on every long run from this week." },
  { pk: PLAN_PK, sk: "WEEK#05", weekNo: 5, phase: "Marathon-specific", dateStart: "2026-08-17", dateEnd: "2026-08-23", volumeTargetKm: 85, isDownWeek: false, notes: "★ CHECKPOINT: log HR across the MP blocks at 4:08. Low-to-mid 170s = on track for 2:54. Drifting to high-170s/180 = ease the target toward 2:56–2:57." },
  { pk: PLAN_PK, sk: "WEEK#06", weekNo: 6, phase: "Down Week", dateStart: "2026-08-24", dateEnd: "2026-08-30", volumeTargetKm: 72, isDownWeek: true, notes: "Recovery / absorb. Pull earlier if cooked sooner." },
  { pk: PLAN_PK, sk: "WEEK#07", weekNo: 7, phase: "Marathon-specific", dateStart: "2026-08-31", dateEnd: "2026-09-06", volumeTargetKm: 88, isDownWeek: false, notes: "Peak long-run block begins. Volume peaks — absorb cleanly." },
  { pk: PLAN_PK, sk: "WEEK#08", weekNo: 8, phase: "Marathon-specific", dateStart: "2026-09-07", dateEnd: "2026-09-13", volumeTargetKm: 92, isDownWeek: false, notes: "Biggest week. KEY SESSION: MP on tired legs (Sun long). Full race-fuel rehearsal." },
  { pk: PLAN_PK, sk: "WEEK#09", weekNo: 9, phase: "Peak / Sharpen", dateStart: "2026-09-14", dateEnd: "2026-09-20", volumeTargetKm: 85, isDownWeek: false, notes: "Last big long run (4 weeks out)." },
  { pk: PLAN_PK, sk: "WEEK#10", weekNo: 10, phase: "Peak / Sharpen", dateStart: "2026-09-21", dateEnd: "2026-09-27", volumeTargetKm: 62, isDownWeek: false, notes: "Ease into the tune-up half. MP dress rehearsal — full kit + fuel. TRIAL BICARB. Not all-out. Log HR over the MP block — final fitness read before taper." },
  { pk: PLAN_PK, sk: "WEEK#11", weekNo: 11, phase: "Taper", dateStart: "2026-09-28", dateEnd: "2026-10-04", volumeTargetKm: 55, isDownWeek: false, notes: "Very easy recovery from half early week (2 weeks out)." },
  { pk: PLAN_PK, sk: "WEEK#12", weekNo: 12, phase: "Taper", dateStart: "2026-10-05", dateEnd: "2026-10-11", volumeTargetKm: 42, isDownWeek: false, notes: "2–3 easy 35–45min runs + strides (1 week out)." },
  { pk: PLAN_PK, sk: "WEEK#13", weekNo: 13, phase: "Race Week", dateStart: "2026-10-12", dateEnd: "2026-10-18", volumeTargetKm: 20, isDownWeek: false, notes: "Short shakeouts only. Execute controlled negative-split plan." },
];

// Sessions: Sun = long run, Tue = Q1, Thu = Q2, Mon/Wed/Fri = easy, Sat = easy/rest
export const sessions: Session[] = [
  // === WEEK 1 ===
  { pk: PLAN_PK, sk: "WEEK#01#SES#q1", weekNo: 1, date: "2026-07-21", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold intervals", structure: "3×8min @ T (~3:58), 2min jog", zoneRefs: ["E", "T"], targetDurationMin: 60, targetDistanceKm: 12, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#01#SES#long", weekNo: 1, date: "2026-07-26", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run — easy", structure: "1:45 easy (~20km)", zoneRefs: ["E"], targetDurationMin: 105, targetDistanceKm: 20, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#01#SES#easy1", weekNo: 1, date: "2026-07-20", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#01#SES#easy2", weekNo: 1, date: "2026-07-22", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy + strides", structure: "Easy run + 6×20s strides", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#01#SES#rest1", weekNo: 1, date: "2026-07-23", dayOfWeek: "Thu", type: "fill", category: "rest", title: "Rest", structure: "Full rest or cross-train", zoneRefs: [], order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#01#SES#easy3", weekNo: 1, date: "2026-07-24", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#01#SES#easy4", weekNo: 1, date: "2026-07-25", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy + hill sprints", structure: "Easy run + 4–6×8s hill sprints", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 6, status: "planned", actual: null },

  // === WEEK 2 ===
  { pk: PLAN_PK, sk: "WEEK#02#SES#q1", weekNo: 2, date: "2026-07-28", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold intervals", structure: "4×8min @ T (~3:58), 2min jog recovery", zoneRefs: ["E", "T"], targetDurationMin: 65, targetDistanceKm: 13, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#02#SES#long", weekNo: 2, date: "2026-08-02", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run — easy", structure: "2:00 easy (~23km)", zoneRefs: ["E"], targetDurationMin: 120, targetDistanceKm: 23, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#02#SES#easy1", weekNo: 2, date: "2026-07-27", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#02#SES#easy2", weekNo: 2, date: "2026-07-29", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy + strides", structure: "Easy run + 6×20s strides", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#02#SES#rest1", weekNo: 2, date: "2026-07-30", dayOfWeek: "Thu", type: "fill", category: "rest", title: "Rest", structure: "Full rest or cross-train", zoneRefs: [], order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#02#SES#easy3", weekNo: 2, date: "2026-07-31", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#02#SES#easy4", weekNo: 2, date: "2026-08-01", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy + hill sprints", structure: "Easy run + 4–6×8s hill sprints", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 9, order: 6, status: "planned", actual: null },

  // === WEEK 3 ===
  { pk: PLAN_PK, sk: "WEEK#03#SES#q1", weekNo: 3, date: "2026-08-04", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold intervals", structure: "5×8min @ T (~3:55) [or 3×10min], 2min jog recovery", zoneRefs: ["E", "T"], targetDurationMin: 70, targetDistanceKm: 14, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#03#SES#long", weekNo: 3, date: "2026-08-09", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run w/ steady finish", structure: "2:00 total, last 15min @ Steady", zoneRefs: ["E", "S"], targetDurationMin: 120, targetDistanceKm: 24, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#03#SES#easy1", weekNo: 3, date: "2026-08-03", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#03#SES#easy2", weekNo: 3, date: "2026-08-05", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#03#SES#rest1", weekNo: 3, date: "2026-08-06", dayOfWeek: "Thu", type: "fill", category: "rest", title: "Rest", structure: "Full rest or cross-train", zoneRefs: [], order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#03#SES#easy3", weekNo: 3, date: "2026-08-07", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#03#SES#easy4", weekNo: 3, date: "2026-08-08", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 6, status: "planned", actual: null },

  // === WEEK 4 ===
  { pk: PLAN_PK, sk: "WEEK#04#SES#q1", weekNo: 4, date: "2026-08-11", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold 1km reps", structure: "5×1km @ T (~3:55–4:00), 90s jog", zoneRefs: ["E", "T"], targetDurationMin: 55, targetDistanceKm: 11, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#04#SES#q2", weekNo: 4, date: "2026-08-13", dayOfWeek: "Thu", type: "anchor", category: "mp", title: "MP intervals — midweek", structure: "14km w/ 3×10min @ MP", zoneRefs: ["E", "MP"], targetDurationMin: 75, targetDistanceKm: 14, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#04#SES#long", weekNo: 4, date: "2026-08-16", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run w/ MP blocks", structure: "2:15 w/ 3×10min @ MP (~26km). Begin race-fuel practice.", zoneRefs: ["E", "MP"], targetDurationMin: 135, targetDistanceKm: 26, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#04#SES#easy1", weekNo: 4, date: "2026-08-10", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#04#SES#easy2", weekNo: 4, date: "2026-08-12", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#04#SES#easy3", weekNo: 4, date: "2026-08-14", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 10, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#04#SES#easy4", weekNo: 4, date: "2026-08-15", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 6, status: "planned", actual: null },

  // === WEEK 5 (CHECKPOINT) ===
  { pk: PLAN_PK, sk: "WEEK#05#SES#q1", weekNo: 5, date: "2026-08-18", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold intervals", structure: "4×6min @ T (~3:58), 90s jog", zoneRefs: ["E", "T"], targetDurationMin: 55, targetDistanceKm: 11, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#05#SES#q2", weekNo: 5, date: "2026-08-20", dayOfWeek: "Thu", type: "anchor", category: "mp", title: "MP intervals — midweek", structure: "15km w/ 2×15min @ MP", zoneRefs: ["E", "MP"], targetDurationMin: 80, targetDistanceKm: 15, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#05#SES#long", weekNo: 5, date: "2026-08-23", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run w/ MP blocks", structure: "2:15–2:30 w/ 2×15min @ MP (~28km)", zoneRefs: ["E", "MP"], targetDurationMin: 142, targetDistanceKm: 28, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#05#SES#easy1", weekNo: 5, date: "2026-08-17", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#05#SES#easy2", weekNo: 5, date: "2026-08-19", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#05#SES#easy3", weekNo: 5, date: "2026-08-21", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#05#SES#easy4", weekNo: 5, date: "2026-08-22", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 11, order: 6, status: "planned", actual: null },

  // === WEEK 6 (DOWN WEEK) ===
  { pk: PLAN_PK, sk: "WEEK#06#SES#q1", weekNo: 6, date: "2026-08-25", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold — reduced volume", structure: "4×8min @ T (~4:00, cut volume), 2min jog", zoneRefs: ["E", "T"], targetDurationMin: 55, targetDistanceKm: 10, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#06#SES#q2", weekNo: 6, date: "2026-08-27", dayOfWeek: "Thu", type: "anchor", category: "easy", title: "Easy w/ optional MP strides", structure: "easy 12km (or light 4×6min @ MP)", zoneRefs: ["E", "MP"], targetDurationMin: 65, targetDistanceKm: 12, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#06#SES#long", weekNo: 6, date: "2026-08-30", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run — easy-steady", structure: "2:00 easy-steady (~24km). Recovery week.", zoneRefs: ["E", "S"], targetDurationMin: 120, targetDistanceKm: 24, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#06#SES#easy1", weekNo: 6, date: "2026-08-24", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, recovery focus", zoneRefs: ["E"], targetDurationMin: 40, targetDistanceKm: 8, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#06#SES#easy2", weekNo: 6, date: "2026-08-26", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#06#SES#rest1", weekNo: 6, date: "2026-08-28", dayOfWeek: "Fri", type: "fill", category: "rest", title: "Rest", structure: "Full rest or easy cross-train", zoneRefs: [], order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#06#SES#easy3", weekNo: 6, date: "2026-08-29", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 6, status: "planned", actual: null },

  // === WEEK 7 ===
  { pk: PLAN_PK, sk: "WEEK#07#SES#q1", weekNo: 7, date: "2026-09-01", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold cruise intervals", structure: "2×3km @ T (~3:55–4:00), 3min jog recovery", zoneRefs: ["E", "T"], targetDurationMin: 65, targetDistanceKm: 13, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#07#SES#q2", weekNo: 7, date: "2026-09-03", dayOfWeek: "Thu", type: "anchor", category: "mp", title: "MP continuous — midweek", structure: "16km w/ 8km continuous @ MP", zoneRefs: ["E", "MP"], targetDurationMin: 85, targetDistanceKm: 16, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#07#SES#long", weekNo: 7, date: "2026-09-06", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run w/ MP blocks", structure: "2:30 w/ 2×15min @ MP (~30–31km)", zoneRefs: ["E", "MP"], targetDurationMin: 150, targetDistanceKm: 30, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#07#SES#easy1", weekNo: 7, date: "2026-08-31", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#07#SES#easy2", weekNo: 7, date: "2026-09-02", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#07#SES#easy3", weekNo: 7, date: "2026-09-04", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#07#SES#easy4", weekNo: 7, date: "2026-09-05", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 9, order: 6, status: "planned", actual: null },

  // === WEEK 8 (BIGGEST) ===
  { pk: PLAN_PK, sk: "WEEK#08#SES#q1", weekNo: 8, date: "2026-09-08", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold 2km reps (or VO2 alt)", structure: "3×2km @ T (or 5×1km @ I), 2min jog", zoneRefs: ["E", "T", "I"], targetDurationMin: 65, targetDistanceKm: 13, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#08#SES#q2", weekNo: 8, date: "2026-09-10", dayOfWeek: "Thu", type: "anchor", category: "mp", title: "MP sustained — midweek", structure: "16–18km w/ 10km @ MP", zoneRefs: ["E", "MP"], targetDurationMin: 95, targetDistanceKm: 17, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#08#SES#long", weekNo: 8, date: "2026-09-13", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run — final 10km @ MP", structure: "2:30 total, final 10km @ MP (~32km). Full race-fuel rehearsal.", zoneRefs: ["E", "MP"], targetDurationMin: 150, targetDistanceKm: 32, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#08#SES#easy1", weekNo: 8, date: "2026-09-07", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#08#SES#easy2", weekNo: 8, date: "2026-09-09", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#08#SES#easy3", weekNo: 8, date: "2026-09-11", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#08#SES#easy4", weekNo: 8, date: "2026-09-12", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 6, status: "planned", actual: null },

  // === WEEK 9 ===
  { pk: PLAN_PK, sk: "WEEK#09#SES#q1", weekNo: 9, date: "2026-09-15", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Threshold cruise intervals", structure: "2×3km @ T (~3:55), 3min jog recovery", zoneRefs: ["E", "T"], targetDurationMin: 60, targetDistanceKm: 12, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#09#SES#q2", weekNo: 9, date: "2026-09-17", dayOfWeek: "Thu", type: "anchor", category: "mp", title: "MP intervals — midweek", structure: "14km w/ 6km @ MP", zoneRefs: ["E", "MP"], targetDurationMin: 75, targetDistanceKm: 14, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#09#SES#long", weekNo: 9, date: "2026-09-20", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Last big long run — 2×20min @ MP", structure: "2:30 w/ final 2×20min @ MP (~31km). Last big long run (4 weeks out).", zoneRefs: ["E", "MP"], targetDurationMin: 150, targetDistanceKm: 31, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#09#SES#easy1", weekNo: 9, date: "2026-09-14", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, <170 HR", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#09#SES#easy2", weekNo: 9, date: "2026-09-16", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 50, targetDistanceKm: 10, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#09#SES#easy3", weekNo: 9, date: "2026-09-18", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#09#SES#easy4", weekNo: 9, date: "2026-09-19", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 6, status: "planned", actual: null },

  // === WEEK 10 (TUNE-UP / HALF MARATHON) ===
  { pk: PLAN_PK, sk: "WEEK#10#SES#q1", weekNo: 10, date: "2026-09-24", dayOfWeek: "Thu", type: "anchor", category: "mp", title: "Pre-half opener", structure: "2km E + 4×1min @ MP/T — race sharpener", zoneRefs: ["E", "MP", "T"], targetDurationMin: 45, targetDistanceKm: 8, order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#10#SES#long", weekNo: 10, date: "2026-09-27", dayOfWeek: "Sun", type: "anchor", category: "race", title: "★ TUNE-UP HALF MARATHON", structure: "Amsterdam (or local) half. Warmup → 16km @ MP → final 5km controlled lift. Full kit + fuel. TRIAL BICARB.", zoneRefs: ["E", "MP", "T"], targetDurationMin: 105, targetDistanceKm: 21, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#10#SES#easy1", weekNo: 10, date: "2026-09-21", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy recovery run", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#10#SES#easy2", weekNo: 10, date: "2026-09-22", dayOfWeek: "Tue", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#10#SES#easy3", weekNo: 10, date: "2026-09-23", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 40, targetDistanceKm: 8, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#10#SES#rest1", weekNo: 10, date: "2026-09-25", dayOfWeek: "Fri", type: "fill", category: "rest", title: "Rest or easy shakeout", structure: "Rest or 20min easy shakeout", zoneRefs: [], order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#10#SES#easy4", weekNo: 10, date: "2026-09-26", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Pre-race easy + strides", structure: "20–30min easy + 4×20s strides", zoneRefs: ["E"], targetDurationMin: 30, targetDistanceKm: 5, order: 6, status: "planned", actual: null },

  // === WEEK 11 (TAPER) ===
  { pk: PLAN_PK, sk: "WEEK#11#SES#q1", weekNo: 11, date: "2026-10-02", dayOfWeek: "Fri", type: "anchor", category: "threshold", title: "Light threshold reps", structure: "light 3×1km @ T (~3:52)", zoneRefs: ["E", "T"], targetDurationMin: 45, targetDistanceKm: 9, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#11#SES#long", weekNo: 11, date: "2026-10-04", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Long run w/ MP finish", structure: "2:00 easy w/ 15min @ MP (~24km)", zoneRefs: ["E", "MP"], targetDurationMin: 120, targetDistanceKm: 24, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#11#SES#easy1", weekNo: 11, date: "2026-09-28", dayOfWeek: "Mon", type: "fill", category: "rest", title: "Post-half rest", structure: "Full rest. Recovery from the half.", zoneRefs: [], order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#11#SES#easy2", weekNo: 11, date: "2026-09-29", dayOfWeek: "Tue", type: "fill", category: "easy", title: "Very easy recovery jog", structure: "20–30min very easy, shakeout from half", zoneRefs: ["E"], targetDurationMin: 30, targetDistanceKm: 5, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#11#SES#easy3", weekNo: 11, date: "2026-09-30", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, keep it short", zoneRefs: ["E"], targetDurationMin: 45, targetDistanceKm: 9, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#11#SES#rest1", weekNo: 11, date: "2026-10-01", dayOfWeek: "Thu", type: "fill", category: "rest", title: "Rest", structure: "Rest or easy cross-train", zoneRefs: [], order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#11#SES#easy4", weekNo: 11, date: "2026-10-03", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic", zoneRefs: ["E"], targetDurationMin: 40, targetDistanceKm: 8, order: 6, status: "planned", actual: null },

  // === WEEK 12 (TAPER) ===
  { pk: PLAN_PK, sk: "WEEK#12#SES#q1", weekNo: 12, date: "2026-10-06", dayOfWeek: "Tue", type: "anchor", category: "mp", title: "MP→T sharpener", structure: "4×1km @ MP→T (4:08→3:52)", zoneRefs: ["E", "MP", "T"], targetDurationMin: 45, targetDistanceKm: 9, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#12#SES#long", weekNo: 12, date: "2026-10-11", dayOfWeek: "Sun", type: "anchor", category: "long", title: "Medium-long w/ MP taste", structure: "80–90min easy w/ a few min @ MP", zoneRefs: ["E", "MP"], targetDurationMin: 85, targetDistanceKm: 17, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#12#SES#easy1", weekNo: 12, date: "2026-10-05", dayOfWeek: "Mon", type: "fill", category: "easy", title: "Easy run", structure: "Easy aerobic, 35–45min", zoneRefs: ["E"], targetDurationMin: 40, targetDistanceKm: 8, order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#12#SES#easy2", weekNo: 12, date: "2026-10-07", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy run + strides", structure: "Easy 35–45min + 4×20s strides", zoneRefs: ["E"], targetDurationMin: 40, targetDistanceKm: 8, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#12#SES#rest1", weekNo: 12, date: "2026-10-08", dayOfWeek: "Thu", type: "fill", category: "rest", title: "Rest", structure: "Rest or easy cross-train", zoneRefs: [], order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#12#SES#rest2", weekNo: 12, date: "2026-10-09", dayOfWeek: "Fri", type: "fill", category: "rest", title: "Rest", structure: "Rest", zoneRefs: [], order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#12#SES#easy3", weekNo: 12, date: "2026-10-10", dayOfWeek: "Sat", type: "fill", category: "easy", title: "Easy shakeout", structure: "Easy 30min shakeout", zoneRefs: ["E"], targetDurationMin: 30, targetDistanceKm: 6, order: 6, status: "planned", actual: null },

  // === WEEK 13 (RACE WEEK) ===
  { pk: PLAN_PK, sk: "WEEK#13#SES#q1", weekNo: 13, date: "2026-10-13", dayOfWeek: "Tue", type: "anchor", category: "mp", title: "Race-week sharpener", structure: "5km E + 4×1min @ MP + strides. Keep it short and sharp.", zoneRefs: ["E", "MP"], targetDurationMin: 40, targetDistanceKm: 8, order: 2, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#13#SES#race", weekNo: 13, date: "2026-10-18", dayOfWeek: "Sun", type: "anchor", category: "race", title: "★ AMSTERDAM MARATHON", structure: "Race day. Controlled negative-split plan. Goal: 2:54 (4:08/km).", zoneRefs: ["MP"], targetDurationMin: 179, targetDistanceKm: 42.2, order: 7, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#13#SES#easy1", weekNo: 13, date: "2026-10-12", dayOfWeek: "Mon", type: "fill", category: "rest", title: "Rest", structure: "Full rest", zoneRefs: [], order: 1, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#13#SES#easy2", weekNo: 13, date: "2026-10-14", dayOfWeek: "Wed", type: "fill", category: "easy", title: "Easy shakeout", structure: "20–25min easy, feel good", zoneRefs: ["E"], targetDurationMin: 25, targetDistanceKm: 5, order: 3, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#13#SES#rest1", weekNo: 13, date: "2026-10-15", dayOfWeek: "Thu", type: "fill", category: "rest", title: "Rest", structure: "Rest", zoneRefs: [], order: 4, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#13#SES#easy3", weekNo: 13, date: "2026-10-16", dayOfWeek: "Fri", type: "fill", category: "easy", title: "Easy shakeout", structure: "15–20min easy + 4×20s strides", zoneRefs: ["E"], targetDurationMin: 20, targetDistanceKm: 4, order: 5, status: "planned", actual: null },
  { pk: PLAN_PK, sk: "WEEK#13#SES#rest2", weekNo: 13, date: "2026-10-17", dayOfWeek: "Sat", type: "fill", category: "rest", title: "Rest — race eve", structure: "Rest. Check kit, plan logistics.", zoneRefs: [], order: 6, status: "planned", actual: null },
];
