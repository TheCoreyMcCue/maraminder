import type { Session, ZoneSet, ZoneKey, Zone } from "./types";

export function formatPaceRange(zone: Zone): string {
  if (zone.pace) return `${zone.pace}/km`;
  if (zone.paceLow && zone.paceHigh) return `${zone.paceLow}–${zone.paceHigh}/km`;
  if (zone.paceLow) return `${zone.paceLow}+/km`;
  return "—";
}

export function formatHrRange(zone: Zone): string {
  if (zone.hrMin) return `${zone.hrMin}+ bpm`;
  if (zone.hrMax && !zone.hrLow) return `<${zone.hrMax} bpm`;
  if (zone.hrLow && zone.hrHigh) return `${zone.hrLow}–${zone.hrHigh} bpm`;
  if (zone.hrMax) return `<${zone.hrMax} bpm`;
  return "—";
}

export function resolvePace(zoneKey: ZoneKey, zoneSet: ZoneSet): string {
  const zone = zoneSet.zones[zoneKey];
  if (!zone) return "—";
  return formatPaceRange(zone);
}

export function resolveSessionTargets(
  session: Session,
  zoneSet: ZoneSet
): Partial<Record<ZoneKey, string>> {
  const result: Partial<Record<ZoneKey, string>> = {};
  for (const key of session.zoneRefs) {
    result[key] = resolvePace(key, zoneSet);
  }
  return result;
}

export function buildTargetSnapshot(
  session: Session,
  zoneSet: ZoneSet
): Partial<Record<ZoneKey, string>> {
  return resolveSessionTargets(session, zoneSet);
}

export function formatSessionTarget(session: Session, zoneSet: ZoneSet): string {
  if (session.zoneRefs.length === 0) return "Easy / recovery";
  return session.zoneRefs
    .map((key) => {
      const zone = zoneSet.zones[key];
      if (!zone) return key;
      return `${zone.label}: ${formatPaceRange(zone)}`;
    })
    .join(" · ");
}

// ── Duration helpers ─────────────────────────────────────

// Accepts "1:03:25" (h:mm:ss), "63:25" (mm:ss), or plain decimal minutes.
export function parseTimeToMinutes(s: string): number {
  const clean = s.trim().replace(",", ".");
  if (!clean) return NaN;
  const parts = clean.split(":").map(Number);
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parts[0];
}

// Converts decimal minutes → "h:mm:ss" or "mm:ss" string for display/input.
export function minutesToTimeStr(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const totalSecs = Math.round(minutes * 60);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function computePaceFromDistTime(
  distanceKm: number,
  durationMin: number
): string {
  if (distanceKm <= 0) return "—";
  const secPerKm = (durationMin * 60) / distanceKm;
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
