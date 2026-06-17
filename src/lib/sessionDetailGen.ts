import type { Session } from "./types";

const T_MIN_PER_KM  = 3.95;   // midpoint of T zone (3:52–4:02)
const E_JOG_MIN_PER_KM = 5.17; // easy jog during recovery
const MP_MIN_PER_KM = 4.133;   // 4:08/km

function tKm(min: number)  { return Math.round((min / T_MIN_PER_KM)  * 10) / 10; }
function eKm(min: number)  { return Math.round((min / E_JOG_MIN_PER_KM) * 10) / 10; }
function mpKm(min: number) { return Math.round((min / MP_MIN_PER_KM) * 10) / 10; }

// ── per-category generators ───────────────────────────────────────────────────

function restDetail(s: Session): string {
  const st = s.structure.toLowerCase();
  if (st.includes("half")) {
    return "Full rest. Recovery from the race — sleep, feet up, eat well. No pressure to move.";
  }
  if (st.includes("race eve") || st.includes("kit") || st.includes("check race")) {
    return "Full rest. Check race kit, confirm logistics, eat your normal pre-race dinner.\n\n**Tomorrow:** 4:08/km, low-mid 170s, fuel on schedule, negative split.";
  }
  return "Full rest or optional easy spin/cross-train. Prioritise sleep and feet-up. No pressure to move.";
}

function easyDetail(s: Session): string {
  const d  = s.targetDistanceKm ?? 0;
  const dur = s.targetDurationMin ?? 0;
  const st = s.structure.toLowerCase();
  const hasStrides   = st.includes("stride");
  const hasHills     = st.includes("hill sprint");
  const isShakeout   = st.includes("shakeout") || st.includes("feel good") || st.includes("20–25min") || st.includes("15–20min");
  const isRecovery   = st.includes("very easy") || st.includes("recovery jog") || st.includes("recovery run") || st.includes("shakeout from half");
  const isPreRace    = (st.includes("pre-race") || (d <= 5 && hasStrides)) && !isRecovery;
  const hasOptionalMP = s.zoneRefs.includes("MP") && s.category === "easy";

  if (isShakeout && d <= 6) {
    return `**Purpose:** keep the legs moving, nothing more.\n\n${dur ? `${dur}min` : `~${d}km`} very easy @ E (5:00–5:20) or slower. Feel-good movement, not aerobic work.`;
  }
  if (isRecovery) {
    return `**Purpose:** gentle flush after the half marathon.\n\n${dur ? `${dur}min` : `~${d}km`} very easy @ E (5:00–5:20), possibly slower. Keep HR well below 155. This is a recovery investment, not training.`;
  }
  if (isPreRace && hasStrides) {
    return `**Purpose:** prime the legs before tomorrow.\n\n~${d}km easy @ E (5:00–5:20), then 4×20s relaxed strides. Full jog recovery between strides. Legs should feel springy — if they don't, that's just nerves; trust the taper.`;
  }
  if (hasHills) {
    const reps = s.structure.match(/(\d+[–-]\d+)/)?.[1] ?? "4–6";
    return `**Purpose:** aerobic base + raw power and form.\n\n**Easy portion:** ~${d - 1}km @ E (5:00–5:20, HR <174).\n**Hill sprints:** ${reps}×8s near-max effort — full walk-back recovery between each. Power and form only; short by design.\n\n~${d}km total. The hill sprints are neuromuscular, not metabolic — do not rush the recovery.`;
  }
  if (hasStrides) {
    return `**Purpose:** aerobic base + neuromuscular sharpness.\n\n~${d - 0.5}km easy @ E (5:00–5:20, HR <174), then 6×20s relaxed strides near the end — full jog recovery between each. Strides are smooth and fast, not a sprint.\n\n~${d}km total.`;
  }
  if (hasOptionalMP) {
    return `**Purpose:** aerobic base with optional MP sharpener.\n\n~${d}km mostly @ E (5:00–5:20). This is a down/recovery week — the MP option is only if legs feel good. Default: keep it all easy.`;
  }
  const hrNote = st.includes("<170") ? "Aim for HR <170 — settle into the block." : "Rein it in if HR drifts above 174.";
  return `**Purpose:** aerobic base / active recovery.\n\n~${d}km entirely @ E (5:00–5:20, HR <174). ${hrNote}`;
}

function thresholdDetail(s: Session): string {
  const d  = s.targetDistanceKm ?? 0;
  const st = s.structure;
  const minMatch   = st.match(/(\d+)×(\d+)min/);
  const kmMatch    = st.match(/(\d+)×(\d+(?:\.\d+)?)km/);
  const restMinMatch = st.match(/(\d+(?:\.\d+)?)min\s*jog/);
  const rest90s    = st.includes("90s");
  const isLightWeek = st.toLowerCase().includes("light") || st.toLowerCase().includes("cut volume");

  let threshKm: number;
  let recKm:    number;
  let mainDesc:  string;

  if (kmMatch) {
    const reps = parseInt(kmMatch[1]); const perRep = parseFloat(kmMatch[2]);
    threshKm = reps * perRep;
    const restMin = restMinMatch ? parseFloat(restMinMatch[1]) : (rest90s ? 1.5 : 2);
    recKm = reps * eKm(restMin);
    mainDesc = `${reps}×${perRep}km at T (3:52–4:02, HR 180–187)`;
  } else if (minMatch) {
    const reps = parseInt(minMatch[1]); const workMin = parseInt(minMatch[2]);
    threshKm = Math.round(reps * tKm(workMin) * 10) / 10;
    const restMin = restMinMatch ? parseFloat(restMinMatch[1]) : (rest90s ? 1.5 : 2);
    recKm = reps * eKm(restMin);
    mainDesc = `${reps}×${workMin}min at T (3:52–4:02, HR 180–187)`;
  } else {
    threshKm = Math.round(d * 0.45 * 10) / 10;
    recKm    = Math.round(d * 0.10 * 10) / 10;
    mainDesc = `main set at T (3:52–4:02, HR 180–187)`;
  }

  const warmKm = 3;
  const coolKm = Math.max(0.5, Math.round((d - warmKm - threshKm - recKm) * 10) / 10);

  const purpose = isLightWeek
    ? "**Purpose:** sharpen threshold on reduced volume (down/recovery week)."
    : "**Purpose:** lift sustainable threshold pace.";
  const cutNote = isLightWeek
    ? "\n\nDown/recovery week — cut to 2–3 reps if fatigue is carrying. Quality over quantity."
    : "\n\nEven-split every rep. If HR climbs past 187 or pace fades >5s/km, cut one rep rather than force it.";

  return `${purpose}\n\n**Warmup:** ~${warmKm}km @ E (5:00–5:20) + 4×20s strides.\n**Main:** ${mainDesc}; recoveries as easy jog.\n**Cooldown:** ~${coolKm}km @ E.\n\nOnly ~${threshKm}km of the ~${d}km is at threshold — warmup (~${warmKm}km), jog recoveries (~${Math.round(recKm * 10) / 10}km), and cooldown (~${coolKm}km) are all easy.${cutNote}`;
}

function mpDetail(s: Session): string {
  const d   = s.targetDistanceKm ?? 0;
  const dur = s.targetDurationMin ?? 0;
  const st  = s.structure;

  if (st.includes("MP→T")) {
    return `**Purpose:** rehearse race-pace feel while sharpening the top end.\n\n**Warmup:** ~2.5km @ E (5:00–5:20).\n**Main:** 4×1km progressing MP→T — reps 1–2 @ MP (4:08), reps 3–4 @ T (3:52–3:58). Easy 90s jog between each.\n**Cooldown:** ~2.5km @ E.\n\n~4km quality of ${d}km total. These are 8 days out — prime, don't dig.`;
  }

  if (st.includes("5km E") && st.includes("4×1min @ MP")) {
    return `**Purpose:** prime race-day feel — activation, not work.\n\n~5km easy @ E (5:00–5:20), then 4×1min @ MP (4:08), then 4–6×20s strides. Easy jog recovery throughout.\n\nThis is ~1km of MP work in ${d}km total. Do not chase times — feel the pace, stay smooth, finish refreshed.`;
  }

  if (st.includes("4×1min @ MP/T") || st.includes("race sharpener")) {
    return `**Purpose:** prime legs before Sunday's half without adding fatigue.\n\n~2km easy @ E, then 4×1min alternating MP/T (4:08→3:52), easy jog recovery, then easy filler to ~${d}km.\n\nThe MP/T work is ~1km of effort in ${d}km — activation only.`;
  }

  const contKmMatch = st.match(/(\d+)km continuous @ MP/);
  if (contKmMatch || st.includes("continuous")) {
    const mpK = contKmMatch ? parseInt(contKmMatch[1]) : Math.round(d * 0.5);
    const filK = Math.max(0, d - 3 - mpK - 2);
    return `**Purpose:** groove 4:08 over a sustained effort — the hardest MP session of the block.\n\n**Warmup:** ~3km @ E (5:00–5:20).\n**Main:** ${mpK}km continuous @ MP (4:08, HR 170–178).\n**Filler/Cooldown:** ~${filK > 0 ? filK + "km E float + " : ""}~2km @ E.\n\nOnly ~${mpK}km of ${d}km is at MP. If HR drifts above 178 before 35min in, ease 5s/km and log it.${dur >= 75 ? "\n\n**Fueling:** ≥75min — rehearse race intake (~100g carb/hr). Start at 30min." : ""}`;
  }

  const blocksMinMatch = st.match(/(\d+)×(\d+)min @ MP/);
  const blocksKmMatch  = st.match(/(\d+(?:\.\d+)?)km @ MP/);

  if (blocksMinMatch) {
    const reps = parseInt(blocksMinMatch[1]); const workMin = parseInt(blocksMinMatch[2]);
    const mpK  = Math.round(reps * mpKm(workMin) * 10) / 10;
    const floK = Math.max(0, Math.round((d - 3 - mpK - 2) * 10) / 10);
    return `**Purpose:** groove 4:08 race rhythm in blocks.\n\n**Warmup:** ~3km @ E (5:00–5:20).\n**Main:** ${reps}×${workMin}min @ MP (4:08, HR 170–178) — ~${mpK}km at race pace; easy float between blocks.\n**Filler:** ~${floK}km @ E. **Cooldown:** ~2km @ E.\n\nOnly ~${mpK}km of ${d}km is at MP. MP should sit in low-to-mid 170s; drifting to 180 = ease off and log it.${dur >= 75 ? "\n\n**Fueling:** ≥75min — rehearse race intake (~100g/hr). Start at 30min." : ""}`;
  }

  if (blocksKmMatch) {
    const mpK = parseFloat(blocksKmMatch[1]);
    const filK = Math.max(0, Math.round((d - 3 - mpK - 2) * 10) / 10);
    return `**Purpose:** groove 4:08 race rhythm over a sustained block.\n\n**Warmup:** ~3km @ E (5:00–5:20).\n**Main:** ${mpK}km @ MP (4:08, HR 170–178).\n**Filler:** ~${filK}km @ E. **Cooldown:** ~2km @ E.\n\nOnly ~${mpK}km of ${d}km is at MP. Drifting to 180 HR = ease off and log it.${dur >= 75 ? "\n\n**Fueling:** ≥75min — rehearse race intake (~100g/hr). Start at 30min." : ""}`;
  }

  return `**Purpose:** groove 4:08 race rhythm.\n\n**Warmup:** ~3km @ E (5:00–5:20).\n**Main:** MP work per structure at (4:08, HR 170–178).\n**Cooldown:** ~2km @ E.\n\nMP should sit low-to-mid 170s; drifting to 180 = ease off and log it.`;
}

function longDetail(s: Session): string {
  const d   = s.targetDistanceKm ?? 0;
  const dur = s.targetDurationMin ?? 0;
  const st  = s.structure;
  const hasMPBlocks = s.zoneRefs.includes("MP");
  const hasSteady   = s.zoneRefs.includes("S") && !hasMPBlocks;

  if (!hasMPBlocks && !hasSteady) {
    return `**Purpose:** build aerobic base and running durability.\n\n~${d}km entirely @ E (5:00–5:20, HR <174). Time on feet counts more than pace. Rein it in if HR drifts above 174.`;
  }

  if (hasSteady) {
    const steadyMinMatch = st.match(/(\d+)min @ Steady/);
    const steadyMin = steadyMinMatch ? parseInt(steadyMinMatch[1]) : 15;
    const steadyK = Math.round(steadyMin / 4.55 * 10) / 10;
    return `**Purpose:** aerobic base + introduce tempo drift.\n\n**Easy portion:** ~${Math.round((d - steadyK) * 10) / 10}km @ E (5:00–5:20).\n**Steady finish:** last ${steadyMin}min @ S (4:25–4:40, HR 174–180) — ~${steadyK}km.\n\n~${d}km total. The steady finish teaches the body to hold form when tired. Do not accelerate earlier — let it come naturally.`;
  }

  if (st.includes("easy-steady")) {
    return `**Purpose:** aerobic volume on a down/recovery week — no quality.\n\n~${d}km @ E/S mix (mostly E, allow drift to S in the final third if legs are moving well). HR below 180 throughout.\n\nRecovery week: do not chase pace. This run consolidates the previous block.`;
  }

  const finalKmMatch    = st.match(/final (\d+)km @ MP/);
  const final2blksMatch = st.match(/final 2×(\d+)min @ MP/);
  const twoHourMpMatch  = st.match(/2:00 easy w\/ (\d+)min @ MP/);

  if (finalKmMatch) {
    const mpK = parseInt(finalKmMatch[1]);
    return `**Purpose:** durability + MP on tired legs — the signature session of the block.\n\n**Easy portion:** first ~${d - mpK}km @ E (5:00–5:20). Stay easy — resist the urge to drift faster.\n**MP finish:** final ${mpK}km @ MP (4:08, HR 170–178). These kilometres are the whole point.\n\n~${d}km total. HR should stay 170–178; if it climbs to 180+ in the first 5km of the MP block, back off slightly and hold form.\n\n**Fueling:** race-day rehearsal — start at 30min, every 30–40min, ~100g/hr. Full race kit.`;
  }

  if (final2blksMatch) {
    const blkMin = parseInt(final2blksMatch[1]);
    const mpK = Math.round(2 * mpKm(blkMin) * 10) / 10;
    return `**Purpose:** last big quality long run — 4 weeks out.\n\n**Easy portion:** first ~${Math.round((d - mpK - 1) * 10) / 10}km @ E (5:00–5:20). Long and patient.\n**MP blocks:** 2×${blkMin}min @ MP (4:08, HR 170–178) — ~${mpK}km total; easy 5min float between blocks.\n\n~${d}km total. Nail the fueling (race protocol from 30min, ~100g/hr). Log HR over the MP blocks — this is your final fitness read.`;
  }

  if (twoHourMpMatch) {
    const mpMin = parseInt(twoHourMpMatch[1]);
    const mpK   = mpKm(mpMin);
    return `**Purpose:** maintain fitness into taper — one MP passage to keep the rhythm.\n\n**Easy portion:** ~${Math.round((d - mpK) * 10) / 10}km @ E (5:00–5:20).\n**MP passage:** ${mpMin}min @ MP (4:08, HR 170–178) — ~${Math.round(mpK * 10) / 10}km.\n\n~${d}km total. The MP block should feel controlled and comfortable — if it doesn't, you need more rest. Fueling: treat it like a race rehearsal (100g/hr from 30min).`;
  }

  if (st.includes("80–90min") || (dur <= 90 && d <= 18 && dur > 0)) {
    return `**Purpose:** taper volume with a taste of race pace.\n\n~${d}km mostly @ E (5:00–5:20). Include a few minutes @ MP (4:08) in the middle — nothing structured, just a reminder. HR should feel low and controlled.\n\nTaper week: don't extend. Finish feeling fresh.`;
  }

  const blksMinMatch = st.match(/(\d+)×(\d+)min @ MP/);
  if (blksMinMatch) {
    const reps = parseInt(blksMinMatch[1]); const workMin = parseInt(blksMinMatch[2]);
    const mpK = Math.round(reps * mpKm(workMin) * 10) / 10;
    const easyK = Math.round((d - mpK) * 10) / 10;
    return `**Purpose:** durability + groove 4:08 rhythm in the back half.\n\n**Easy portion:** first ~${Math.round(easyK * 0.6 * 10) / 10}km @ E (5:00–5:20). Patient and aerobic.\n**MP blocks:** ${reps}×${workMin}min @ MP (4:08, HR 170–178) — ~${mpK}km total; easy float between blocks.\n**Easy to finish:** ~${Math.round(easyK * 0.4 * 10) / 10}km @ E.\n\n~${d}km total. Only ~${mpK}km is at MP — the rest is base.\n\n**Fueling:** race-day rehearsal — start at 30–40min, ~100g carb/hr.`;
  }

  return `**Purpose:** aerobic durability.\n\n~${d}km @ E (5:00–5:20), with quality per structure where indicated.\n\n**Fueling:** start by 30–40min, ~100g/hr.`;
}

function strengthDetail(s: Session): string {
  const title = s.title.toLowerCase();
  const st    = s.structure.toLowerCase();

  if (title.includes("primer") || st.includes("activation only")) {
    return "**Purpose:** keep the legs springy into taper — activation only, zero grind.\n\nPogo hops 2×8, 2 light fast squats 2×3, calf raises 2× light. ~15–20min. Drop it without guilt if the legs want rest.";
  }
  if (title.includes("maintenance") || st.includes("maintenance")) {
    return "**Purpose:** hold the strength gains on minimal fatigue while running volume peaks. Run first; keep it short.\n\n**Main:**\n- Back squat 2–3×5\n- Romanian deadlift 2×5\n- Standing calf raise 2–3×6 + seated (soleus) 2×8\n- Plyo: pogo hops 2×10 + bounding 2×6 (light, springy)\n- Core 1–2 sets.\n\n~30–35min. Heavy enough to maintain, low volume. Pull it entirely if a key long run feels compromised.";
  }
  if (st.includes("plyo") || title.includes("+ plyo")) {
    return "**Purpose:** running economy + calf/soleus resilience. Heavy and low-rep — strength, not size. Run first, lift after.\n\n**Main (RIR 1–2):**\n- Back squat 4×5 heavy\n- Romanian deadlift 4×5\n- Bulgarian split squat 3×6/leg\n**Calves (priority):**\n- Standing calf raise 4×6 heavy, slow eccentric\n- Seated calf raise (soleus) 3×8\n**Plyo (neuromuscular — full recovery between sets, not fatigue):**\n- Pogo hops 3×10 + low box jumps 3×6\n**Core:** Pallof + plank, 2 sets.\n\n~45–50min. Never the day before a long run.";
  }
  if (title.includes("max-strength") || title.includes("max strength") || st.includes("4×5")) {
    return "**Purpose:** running economy + calf/soleus resilience. Heavy and low-rep — strength, not size. Run first, lift after.\n\n**Main (RIR 1–2):**\n- Back squat 4×5 heavy\n- Romanian deadlift 4×5\n- Bulgarian split squat 3×6/leg\n**Calves (priority):**\n- Standing calf raise 4×6 heavy, slow eccentric\n- Seated calf raise (soleus) 3×8\n**Core:** Pallof + plank, 2 sets.\n\n~45–50min. Never the day before a long run.";
  }
  // Foundation (default)
  return "**Purpose:** build movement quality + load tolerance before going heavy. Run first if you run today.\n\n**Main (RIR 2–3, moderate load):**\n- Back squat (goblet until barbell is loadable) 3×8\n- Romanian deadlift 3×8\n- Reverse lunge or step-up 3×8/leg\n**Calves (priority):**\n- Standing calf raise 3×10\n- Seated calf raise (soleus) 3×12\n**Core:** plank + Pallof, 2 sets.\n\n~40min. Never the day before a long run.";
}

function raceDetail(s: Session): string {
  const isHalf = (s.targetDistanceKm ?? 0) <= 22;
  if (isHalf) {
    return `**Purpose:** race-fitness data point and full execution rehearsal.\n\n**Pacing:** warmup ~2km E → 16km @ MP (4:08, HR 170–178) → final 5km controlled lift (allow to 4:00–4:05 if HR permits).\n**Kit:** full race kit — shoes, shorts, singlet, watch, gels.\n**Fuel:** race protocol. **TRIAL BICARB** — log how the stomach responds.\n\nThis is not an all-out effort. A controlled 1:26–1:28 here with HR in 170s predicts 2:54 marathon capability. Log HR at each km split.`;
  }
  return `**Purpose:** execute 2:54 (4:08/km) controlled negative split.\n\n**First 21km:** 4:08–4:10/km, HR low-to-mid 170s. Resist going faster even if it feels easy — it won't feel this easy at 35km.\n**Km 21–35:** hold 4:08, stay in 170–178 HR. Use landmarks as mental checkpoints.\n**Km 35–42:** if HR is ≤178 and legs are responding, lift to 4:05 then 4:00 in the final 2km.\n\n**Fueling:** gel/drink at 30min, then every 30–40min. ~100g carb/hr. Execute the plan you've rehearsed.\n\nThree laws: **go out controlled**, **fuel to plan**, **trust the training**.`;
}

// ── public API ────────────────────────────────────────────────────────────────

export function generateTargetDetail(s: Session): string {
  switch (s.category) {
    case "rest":       return restDetail(s);
    case "easy":       return easyDetail(s);
    case "threshold":  return thresholdDetail(s);
    case "mp":         return mpDetail(s);
    case "long":       return longDetail(s);
    case "race":       return raceDetail(s);
    case "strength":   return strengthDetail(s);
    default:           return s.structure;
  }
}
