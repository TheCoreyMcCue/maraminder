import type { ZoneKey, ZoneSet, Lap, WorkSummary, SessionCategory } from "./types";

// ── Pace helpers ──────────────────────────────────────────────────────────────

export function parsePaceSec(pace: string): number {
  const parts = pace.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Infinity;
}

export function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// m/s → sec/km
export function speedToSecPerKm(ms: number): number {
  return ms > 0 ? 1000 / ms : Infinity;
}

// ── Work zone for each quality category ───────────────────────────────────────

export function zoneWorkKey(category: SessionCategory): ZoneKey | null {
  switch (category) {
    case "threshold": return "T";
    case "mp":        return "MP";
    case "long":      return "MP"; // long runs with MP blocks
    default:          return null;
  }
}

export function isQualityCategory(category: SessionCategory): boolean {
  return category === "threshold" || category === "mp" || category === "long";
}

// ── Zone-boundary pace comparison ─────────────────────────────────────────────
// Uses midpoints between adjacent zone boundaries so classification is
// unambiguous even when zones are very close together (e.g. T at 4:02, MP at 4:08).

function midpointSec(a: number, b: number) { return (a + b) / 2; }

export function classifyPaceZone(secPerKm: number, zones: ZoneSet): ZoneKey {
  const z = zones.zones;

  // Build zone representative paces (sec/km)
  const tLo  = z.T.paceLow  ? parsePaceSec(z.T.paceLow)  : 232;
  const tHi  = z.T.paceHigh ? parsePaceSec(z.T.paceHigh) : 242;
  const mpMid = z.MP.pace   ? parsePaceSec(z.MP.pace)     : 248;
  const sLo  = z.S.paceLow  ? parsePaceSec(z.S.paceLow)  : 265;
  const sHi  = z.S.paceHigh ? parsePaceSec(z.S.paceHigh) : 280;

  // Non-overlapping cut points between adjacent zones
  const iToT  = tLo - 10;                    // anything faster = I
  const tToMP = midpointSec(tHi, mpMid);     // ~245 sec/km
  const mpToS = midpointSec(mpMid, sLo);     // ~256 sec/km
  const sToE  = sHi + 15;                    // anything slower = E

  if (secPerKm < iToT)  return "I";
  if (secPerKm < tToMP) return "T";
  if (secPerKm < mpToS) return "MP";
  if (secPerKm < sToE)  return "S";
  return "E";
}

// Midpoint target pace for a zone (used for Δ-vs-target column)
export function targetPaceSecForZone(zoneKey: ZoneKey, zones: ZoneSet): number {
  const z = zones.zones[zoneKey];
  if (z.pace) return parsePaceSec(z.pace);
  if (z.paceLow && z.paceHigh) {
    return (parsePaceSec(z.paceLow) + parsePaceSec(z.paceHigh)) / 2;
  }
  return Infinity;
}

// ── Structure parser ──────────────────────────────────────────────────────────

// "5×8min @ T" | "4×1km" | "3×1.5km" | "3 x 8min" → 5 | 4 | 3 | 3
export function parseRepCount(structure: string): number | null {
  const m = structure.match(/^(\d+)\s*[×x]\s*/i);
  if (!m) return null;
  const n = parseInt(m[1]);
  return n > 0 && n <= 30 ? n : null;
}

// Prescribed rep dimension — time or distance extracted from structure string
export interface RepTarget {
  type: "time" | "distance";
  valueSec?: number; // for time reps
  valueKm?: number;  // for distance reps
}

// "5×8min @T" → {type:"time", valueSec:480}
// "4×1km"    → {type:"distance", valueKm:1}
// "10×400m"  → {type:"distance", valueKm:0.4}
export function parseRepTarget(structure: string): RepTarget | null {
  const timeMatch = structure.match(/\d+\s*[×x]\s*(\d+(?:\.\d+)?)\s*min/i);
  if (timeMatch) return { type: "time", valueSec: parseFloat(timeMatch[1]) * 60 };
  const kmMatch = structure.match(/\d+\s*[×x]\s*(\d+(?:\.\d+)?)\s*km/i);
  if (kmMatch) return { type: "distance", valueKm: parseFloat(kmMatch[1]) };
  const mMatch = structure.match(/\d+\s*[×x]\s*(\d+(?:\.\d+)?)\s*m\b/i);
  if (mMatch) return { type: "distance", valueKm: parseFloat(mMatch[1]) / 1000 };
  return null;
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Set completedAsPrescribed on each rep lap based on target dimension
export function annotateLapCompletion(laps: Lap[], structure: string): Lap[] {
  const target = parseRepTarget(structure);
  if (!target) return laps;
  return laps.map((lap) => {
    if (lap.label !== "rep") return lap;
    let completed: boolean;
    if (target.type === "time" && target.valueSec != null) {
      // Rep counts if athlete ran ≥90% of target duration
      completed = lap.durationSec >= target.valueSec * 0.9;
    } else if (target.type === "distance" && target.valueKm != null) {
      // Rep counts if athlete ran ≥95% of target distance
      completed = lap.distanceKm >= target.valueKm * 0.95;
    } else {
      return lap;
    }
    return { ...lap, completedAsPrescribed: completed };
  });
}

// ── Strava raw lap shape ──────────────────────────────────────────────────────

export interface StravaLapRaw {
  id: number;
  lap_index: number;
  elapsed_time: number;
  moving_time: number;
  distance: number;      // metres
  average_speed: number; // m/s
  average_heartrate?: number;
  average_watts?: number;
  average_cadence?: number;
}

// ── Lap classification ────────────────────────────────────────────────────────

export function classifyLaps(
  raw: StravaLapRaw[],
  workZone: ZoneKey,
  zones: ZoneSet,
): Lap[] {
  if (!raw.length) return [];

  // Pre-classify each lap as work or not
  const tagged = raw.map((lap) => {
    const secPerKm = speedToSecPerKm(lap.average_speed);
    const paceZone = classifyPaceZone(secPerKm, zones);
    // A lap is "work" if it falls in the target work zone, or faster (I-zone when T expected)
    const isWork =
      paceZone === workZone ||
      (workZone === "T" && paceZone === "I");
    return { lap, secPerKm, paceZone, isWork };
  });

  const firstWorkIdx = tagged.findIndex((t) => t.isWork);
  const lastWorkIdx  = tagged.reduce((acc, t, i) => (t.isWork ? i : acc), -1);

  let repNo = 0;
  return tagged.map(({ lap, secPerKm, paceZone, isWork }, i) => {
    let label: Lap["label"];
    if (isWork) {
      label = "rep";
      repNo++;
    } else if (firstWorkIdx === -1 || i < firstWorkIdx) {
      label = "warmup";
    } else if (i > lastWorkIdx) {
      label = "cooldown";
    } else {
      label = "recovery";
    }

    return {
      lapIndex: lap.lap_index,
      label,
      repNo: label === "rep" ? repNo : undefined,
      zone: paceZone,
      durationSec: lap.moving_time,
      distanceKm: parseFloat((lap.distance / 1000).toFixed(3)),
      avgPace: fmtPace(secPerKm),
      avgHr:      lap.average_heartrate != null ? Math.round(lap.average_heartrate) : undefined,
      avgPowerW:  lap.average_watts     != null ? Math.round(lap.average_watts)     : undefined,
      avgCadence: lap.average_cadence   != null ? Math.round(lap.average_cadence)   : undefined,
    } satisfies Lap;
  });
}

// ── Derived metrics ───────────────────────────────────────────────────────────

export function buildWorkSummary(laps: Lap[], zone: ZoneKey): WorkSummary | null {
  const work = laps.filter((l) => l.label === "rep");
  if (work.length < 1) return null;

  // Weighted average pace (by distance)
  const totalDist = work.reduce((s, l) => s + l.distanceKm, 0);
  const totalSec  = work.reduce((s, l) => s + l.durationSec, 0);
  const avgSecPerKm = totalDist > 0 ? totalSec / totalDist : 0;

  // Average HR across reps
  const hrVals = work.filter((l) => l.avgHr != null).map((l) => l.avgHr!);
  const avgHr  = hrVals.length > 0
    ? Math.round(hrVals.reduce((s, v) => s + v, 0) / hrVals.length)
    : undefined;

  // Pace of first and last rep (sec/km)
  const firstRep = work[0];
  const lastRep  = work[work.length - 1];
  const firstSec = firstRep.distanceKm > 0 ? firstRep.durationSec / firstRep.distanceKm : parsePaceSec(firstRep.avgPace);
  const lastSec  = lastRep.distanceKm  > 0 ? lastRep.durationSec  / lastRep.distanceKm  : parsePaceSec(lastRep.avgPace);
  const fadeSecPerKm = Math.round(lastSec - firstSec);

  const hrDriftBpm =
    firstRep.avgHr != null && lastRep.avgHr != null
      ? lastRep.avgHr - firstRep.avgHr
      : undefined;

  return {
    zone,
    repCount: work.length,
    avgPace: fmtPace(avgSecPerKm),
    avgHr,
    fadeSecPerKm,
    hrDriftBpm,
  };
}

export function deriveSegments(laps: Lap[]): {
  segmentPace: Partial<Record<ZoneKey, string>>;
  segmentHr:   Partial<Record<ZoneKey, number>>;
} {
  const work = laps.filter((l) => l.label === "rep");
  if (!work.length) return { segmentPace: {}, segmentHr: {} };

  // Group by zone and compute weighted avg pace + mean HR
  const byZone = new Map<ZoneKey, { dist: number; sec: number; hrs: number[] }>();
  for (const lap of work) {
    const acc = byZone.get(lap.zone) ?? { dist: 0, sec: 0, hrs: [] };
    acc.dist += lap.distanceKm;
    acc.sec  += lap.durationSec;
    if (lap.avgHr != null) acc.hrs.push(lap.avgHr);
    byZone.set(lap.zone, acc);
  }

  const segmentPace: Partial<Record<ZoneKey, string>> = {};
  const segmentHr:   Partial<Record<ZoneKey, number>> = {};
  for (const [zone, { dist, sec, hrs }] of byZone) {
    if (dist > 0) segmentPace[zone] = fmtPace(sec / dist);
    if (hrs.length > 0) segmentHr[zone] = Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length);
  }

  return { segmentPace, segmentHr };
}
