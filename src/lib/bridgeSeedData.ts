import type { PlanMeta, ZoneSet, Week, Session } from "./types";

const PK = "PLAN#bridge-2026";

export const bridgeMeta: PlanMeta = {
  pk: PK, sk: "META",
  name: "70.3 → Pre-Block Bridge",
  raceDate: "2026-06-21",
  halfDate: "2026-06-21",
  startDate: "2026-06-08",
  goalTime: "70.3 + rebuild",
  goalPace: "4:25–4:35/km run",
  currentZoneVersion: 1,
};

export const bridgeZonesV1: ZoneSet = {
  pk: PK, sk: "ZONES#1",
  version: 1, effectiveWeek: 1, source: "field-anchored (pre-block)",
  zones: {
    E:  { label: "Easy",      paceLow: "5:00", paceHigh: "5:20", hrMax: 174 },
    S:  { label: "Steady",    paceLow: "4:25", paceHigh: "4:40", hrLow: 174, hrHigh: 180 },
    MP: { label: "Goal run",  pace: "4:25",    hrLow: 168, hrHigh: 176 },
    T:  { label: "Threshold", paceLow: "3:52", paceHigh: "4:02", hrLow: 180, hrHigh: 187 },
    I:  { label: "Interval",  paceLow: "3:25", paceHigh: "3:40", hrMin: 188 },
  },
};

export const bridgeWeeks: Week[] = [
  { pk: PK, sk: "WEEK#01", weekNo: 1, phase: "70.3 Taper wk1",   dateStart: "2026-06-08", dateEnd: "2026-06-14", volumeTargetKm: 30, isDownWeek: false, notes: "~60% volume. Sharpen, don't train. Lock gear Sat." },
  { pk: PK, sk: "WEEK#02", weekNo: 2, phase: "Race week",         dateStart: "2026-06-15", dateEnd: "2026-06-21", volumeTargetKm: 18, isDownWeek: false, notes: "~40% volume. Short & sharp. Carb-load Fri–Sat. Sun = 70.3 Westfriesland, Hoorn 07:00." },
  { pk: PK, sk: "WEEK#03", weekNo: 3, phase: "Post-race recovery",dateStart: "2026-06-22", dateEnd: "2026-06-28", volumeTargetKm: 35, isDownWeek: true,  notes: "Full rest Mon. Reintroduce movement Tue–Wed. Easy volume by feel." },
  { pk: PK, sk: "WEEK#04", weekNo: 4, phase: "Rebuild wk1",       dateStart: "2026-06-29", dateEnd: "2026-07-05", volumeTargetKm: 60, isDownWeek: false, notes: "First quality back — light. Target ~60km and feel strong doing it." },
  { pk: PK, sk: "WEEK#05", weekNo: 5, phase: "Holiday (flexible)", dateStart: "2026-07-06", dateEnd: "2026-07-12", volumeTargetKm: 45, isDownWeek: false, notes: "Holiday from 7 Jul. No hard quality. 3–4 easy runs, drop freely. Volume ~40–55km." },
  { pk: PK, sk: "WEEK#06", weekNo: 6, phase: "Re-entry / prime",   dateStart: "2026-07-13", dateEnd: "2026-07-19", volumeTargetKm: 65, isDownWeek: false, notes: "Holiday ends 15 Jul. Re-establish rhythm Thu. Prime legs Sat. Arrive at W1 amsterdam26 fresh at ~70km/week." },
];

export const bridgeSessions: Session[] = [

  // ══════ BW1 · 8–14 Jun · 70.3 Taper wk1 ══════

  { pk: PK, sk: "WEEK#01#SES#mon",  weekNo: 1, date: "2026-06-08", dayOfWeek: "Mon", type: "fill",   category: "rest",   title: "Rest or easy spin",          structure: "Optional 30min easy spin to loosen up. No pressure.",              zoneRefs: [],       order: 1, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#01#SES#tue",  weekNo: 1, date: "2026-06-09", dayOfWeek: "Tue", type: "anchor", category: "bike",   title: "Bike intervals",              structure: "50–60min total, 3×6min @ 180–185W, 3min easy between. Sharp, not deep.", zoneRefs: [],  order: 2, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#01#SES#wed",  weekNo: 1, date: "2026-06-10", dayOfWeek: "Wed", type: "anchor", category: "easy",   title: "Run w/ goal-pace block",      structure: "~6–7km total, incl. 2km @ goal run pace (~4:25–4:35), easy either side.", zoneRefs: ["E", "S"], targetDistanceKm: 7, targetDurationMin: 38, order: 3, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#01#SES#thu",  weekNo: 1, date: "2026-06-11", dayOfWeek: "Thu", type: "fill",   category: "bike",   title: "Easy spin",                   structure: "30–40min easy + a few short pickups. Flush the legs.",             zoneRefs: [],       order: 4, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#01#SES#fri",  weekNo: 1, date: "2026-06-12", dayOfWeek: "Fri", type: "fill",   category: "rest",   title: "Rest",                        structure: "Full rest.",                                                      zoneRefs: [],       order: 5, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#01#SES#sat",  weekNo: 1, date: "2026-06-13", dayOfWeek: "Sat", type: "anchor", category: "brick",  title: "★ Gear-test ride",            structure: "60–75min outdoor ride (P5, full race kit) over rougher road. Load-test bottle + computer, sweat-rate protocol, rehearse steady fuelling. Tag 10–15min easy run off the bike. Controlled effort. Lock all gear after today.", zoneRefs: [], targetDurationMin: 80, order: 6, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#01#SES#sun",  weekNo: 1, date: "2026-06-14", dayOfWeek: "Sun", type: "fill",   category: "easy",   title: "Easy run",                    structure: "~8km easy aerobic.",                                              zoneRefs: ["E"], targetDistanceKm: 8, targetDurationMin: 45, order: 7, status: "planned", actual: null },

  // ══════ BW2 · 15–21 Jun · Race week ══════

  { pk: PK, sk: "WEEK#02#SES#mon",  weekNo: 2, date: "2026-06-15", dayOfWeek: "Mon", type: "fill",   category: "bike",   title: "Easy + openers",              structure: "40min easy + 3×2min @ race power. Keep it light.",                zoneRefs: [],       order: 1, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#02#SES#tue",  weekNo: 2, date: "2026-06-16", dayOfWeek: "Tue", type: "fill",   category: "easy",   title: "Easy run + strides",          structure: "~5km easy + 4×20s strides. Legs should feel good.",               zoneRefs: ["E"], targetDistanceKm: 5, targetDurationMin: 28, order: 2, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#02#SES#wed",  weekNo: 2, date: "2026-06-17", dayOfWeek: "Wed", type: "fill",   category: "rest",   title: "Rest or very easy spin",      structure: "Optional 30min very easy. Prioritise feet-off-the-floor.",        zoneRefs: [],       order: 3, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#02#SES#thu",  weekNo: 2, date: "2026-06-18", dayOfWeek: "Thu", type: "fill",   category: "easy",   title: "Short opener",                structure: "20–30min easy + 3–4 short race-effort pickups. Feel sharp.",      zoneRefs: ["E"], targetDistanceKm: 5, targetDurationMin: 25, order: 4, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#02#SES#fri",  weekNo: 2, date: "2026-06-19", dayOfWeek: "Fri", type: "fill",   category: "rest",   title: "Rest · start carb-load",      structure: "Full rest. Bump carbs today and tomorrow. Sleep is the priority.",zoneRefs: [],       order: 5, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#02#SES#sat",  weekNo: 2, date: "2026-06-20", dayOfWeek: "Sat", type: "anchor", category: "easy",   title: "Travel · race check-in · openers", structure: "Travel to Hoorn. Check-in, briefing. ~10–15min easy spin + 3×30s @ race power + 10min jog w/ strides. Off feet otherwise. Lay out gear, prep bottles.", zoneRefs: ["E"], targetDurationMin: 30, order: 6, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#02#SES#sun",  weekNo: 2, date: "2026-06-21", dayOfWeek: "Sun", type: "anchor", category: "race",   title: "★ 70.3 WESTFRIESLAND",        structure: "Hoorn, 07:00. Race-morning swim warm-up. Execute the plan: controlled bike, aerobic run build.", zoneRefs: [], targetDurationMin: 270, order: 7, status: "planned", actual: null },

  // ══════ BW3 · 22–28 Jun · Post-race recovery ══════

  { pk: PK, sk: "WEEK#03#SES#mon",  weekNo: 3, date: "2026-06-22", dayOfWeek: "Mon", type: "fill",   category: "rest",   title: "Full rest",                   structure: "Nothing. Eat, sleep, walk if you want.",                          zoneRefs: [],       order: 1, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#03#SES#tue",  weekNo: 3, date: "2026-06-23", dayOfWeek: "Tue", type: "fill",   category: "bike",   title: "Active recovery spin",        structure: "30min very easy spin. Flush the legs.",                           zoneRefs: [],       targetDurationMin: 30, order: 2, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#03#SES#wed",  weekNo: 3, date: "2026-06-24", dayOfWeek: "Wed", type: "fill",   category: "easy",   title: "Easy run (if legs OK)",       structure: "30min easy. Else rest. No pressure — this week is recovery.",     zoneRefs: ["E"], targetDistanceKm: 6, targetDurationMin: 30, order: 3, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#03#SES#thu",  weekNo: 3, date: "2026-06-25", dayOfWeek: "Thu", type: "fill",   category: "rest",   title: "Rest or easy",                structure: "Optional 30min. Go by feel.",                                     zoneRefs: [],       order: 4, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#03#SES#fri",  weekNo: 3, date: "2026-06-26", dayOfWeek: "Fri", type: "fill",   category: "easy",   title: "Easy run",                    structure: "40min easy aerobic.",                                             zoneRefs: ["E"], targetDistanceKm: 8, targetDurationMin: 40, order: 5, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#03#SES#sat",  weekNo: 3, date: "2026-06-27", dayOfWeek: "Sat", type: "fill",   category: "easy",   title: "Easy + light strides",        structure: "45min easy + 4×20s strides. Legs should be waking up.",          zoneRefs: ["E"], targetDistanceKm: 9, targetDurationMin: 45, order: 6, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#03#SES#sun",  weekNo: 3, date: "2026-06-28", dayOfWeek: "Sun", type: "anchor", category: "long",   title: "Easy return long",            structure: "70min easy (~13–14km). First proper long since the race.",        zoneRefs: ["E"], targetDistanceKm: 14, targetDurationMin: 70, order: 7, status: "planned", actual: null },

  // ══════ BW4 · 29 Jun–5 Jul · Rebuild wk1 ══════

  { pk: PK, sk: "WEEK#04#SES#mon",  weekNo: 4, date: "2026-06-29", dayOfWeek: "Mon", type: "fill",   category: "easy",   title: "Easy run",                    structure: "45min easy aerobic.",                                             zoneRefs: ["E"], targetDistanceKm: 9, targetDurationMin: 45, order: 1, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#04#SES#tue",  weekNo: 4, date: "2026-06-30", dayOfWeek: "Tue", type: "anchor", category: "threshold", title: "Light quality — ease back in", structure: "6×3min @ S–T (4:00–4:25), 90s jog. Comfortable, controlled. First real quality since the race.", zoneRefs: ["E", "S", "T"], targetDistanceKm: 10, targetDurationMin: 50, order: 2, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#04#SES#wed",  weekNo: 4, date: "2026-07-01", dayOfWeek: "Wed", type: "fill",   category: "easy",   title: "Easy run",                    structure: "50min easy aerobic.",                                             zoneRefs: ["E"], targetDistanceKm: 10, targetDurationMin: 50, order: 3, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#04#SES#thu",  weekNo: 4, date: "2026-07-02", dayOfWeek: "Thu", type: "fill",   category: "easy",   title: "Easy + strides",              structure: "45min easy + 6×20s strides.",                                    zoneRefs: ["E"], targetDistanceKm: 9, targetDurationMin: 45, order: 4, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#04#SES#fri",  weekNo: 4, date: "2026-07-03", dayOfWeek: "Fri", type: "fill",   category: "rest",   title: "Rest or easy",                structure: "Optional 30min easy.",                                            zoneRefs: [],       order: 5, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#04#SES#sat",  weekNo: 4, date: "2026-07-04", dayOfWeek: "Sat", type: "fill",   category: "easy",   title: "Easy + hill strides",         structure: "50min easy + 4–6×8s hill sprints.",                               zoneRefs: ["E"], targetDistanceKm: 10, targetDurationMin: 50, order: 6, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#04#SES#sun",  weekNo: 4, date: "2026-07-05", dayOfWeek: "Sun", type: "anchor", category: "long",   title: "Long run",                    structure: "90min easy (~18km). Back to long run territory.",                 zoneRefs: ["E"], targetDistanceKm: 18, targetDurationMin: 90, order: 7, status: "planned", actual: null },

  // ══════ BW5 · 6–12 Jul · Holiday (flexible) ══════

  { pk: PK, sk: "WEEK#05#SES#mon",  weekNo: 5, date: "2026-07-06", dayOfWeek: "Mon", type: "fill",   category: "easy",   title: "Easy run (last pre-travel)",  structure: "50min easy. Last session before holiday travel.",                 zoneRefs: ["E"], targetDistanceKm: 10, targetDurationMin: 50, order: 1, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#05#SES#tue",  weekNo: 5, date: "2026-07-07", dayOfWeek: "Tue", type: "fill",   category: "easy",   title: "Holiday run (by feel)",       structure: "30–50min easy. Drop freely if tired or life intervenes.",         zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 2, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#05#SES#wed",  weekNo: 5, date: "2026-07-08", dayOfWeek: "Wed", type: "fill",   category: "rest",   title: "Holiday rest",                structure: "Rest or easy walk. No pressure.",                                 zoneRefs: [],       order: 3, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#05#SES#thu",  weekNo: 5, date: "2026-07-09", dayOfWeek: "Thu", type: "fill",   category: "easy",   title: "Holiday run (by feel)",       structure: "30–50min easy.",                                                  zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 4, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#05#SES#fri",  weekNo: 5, date: "2026-07-10", dayOfWeek: "Fri", type: "fill",   category: "rest",   title: "Holiday rest",                structure: "Rest.",                                                           zoneRefs: [],       order: 5, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#05#SES#sat",  weekNo: 5, date: "2026-07-11", dayOfWeek: "Sat", type: "fill",   category: "easy",   title: "Holiday run (by feel)",       structure: "30–50min easy.",                                                  zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 6, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#05#SES#sun",  weekNo: 5, date: "2026-07-12", dayOfWeek: "Sun", type: "anchor", category: "long",   title: "Easy long (if it fits)",      structure: "60–75min easy if rested and willing. Drop if not.",               zoneRefs: ["E"], targetDistanceKm: 14, targetDurationMin: 70, order: 7, status: "planned", actual: null },

  // ══════ BW6 · 13–19 Jul · Holiday tail + re-entry ══════

  { pk: PK, sk: "WEEK#06#SES#mon",  weekNo: 6, date: "2026-07-13", dayOfWeek: "Mon", type: "fill",   category: "easy",   title: "Holiday-tail run",            structure: "30–50min easy.",                                                  zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 1, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#06#SES#tue",  weekNo: 6, date: "2026-07-14", dayOfWeek: "Tue", type: "fill",   category: "easy",   title: "Holiday-tail run",            structure: "30–50min easy.",                                                  zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 2, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#06#SES#wed",  weekNo: 6, date: "2026-07-15", dayOfWeek: "Wed", type: "fill",   category: "easy",   title: "Holiday-tail run (ends today)", structure: "30–50min easy. Holiday ends 15 Jul.",                           zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 3, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#06#SES#thu",  weekNo: 6, date: "2026-07-16", dayOfWeek: "Thu", type: "anchor", category: "easy",   title: "Easy + strides (home)",       structure: "50min easy + strides. Back home — re-establish rhythm.",          zoneRefs: ["E"], targetDistanceKm: 10, targetDurationMin: 50, order: 4, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#06#SES#fri",  weekNo: 6, date: "2026-07-17", dayOfWeek: "Fri", type: "fill",   category: "easy",   title: "Easy or rest",                structure: "40min easy or rest.",                                             zoneRefs: ["E"], targetDistanceKm: 8,  targetDurationMin: 40, order: 5, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#06#SES#sat",  weekNo: 6, date: "2026-07-18", dayOfWeek: "Sat", type: "fill",   category: "easy",   title: "Easy + race-effort strides",  structure: "45min easy + 4–6 short hard pickups (10s). Prime the legs for the block.", zoneRefs: ["E"], targetDistanceKm: 9, targetDurationMin: 45, order: 6, status: "planned", actual: null },
  { pk: PK, sk: "WEEK#06#SES#sun",  weekNo: 6, date: "2026-07-19", dayOfWeek: "Sun", type: "anchor", category: "long",   title: "Final bridge long run",       structure: "75–90min easy (~16–18km). Arrive at amsterdam26 W1 fresh, ~70km/week rhythm.", zoneRefs: ["E"], targetDistanceKm: 17, targetDurationMin: 85, order: 7, status: "planned", actual: null },
];
