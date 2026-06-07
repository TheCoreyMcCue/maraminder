import type {
  RecoveryReading,
  RecoveryStatus,
  Baseline,
  Deviation,
  DailyRecovery,
  WeeklyRecovery,
} from "./types";

// Configurable thresholds
const T = {
  hrvZAmber: -1,      // HRV z-score below this → amber
  rhrZAmber: 1,       // RHR z-score above this → amber
  sleepAmberH: 6.5,   // sleep below this → amber
  minBaselineN: 3,    // minimum readings needed to compute a baseline
};

// ── Core stats ────────────────────────────────────────────

export function baseline(
  readings: RecoveryReading[],
  metric: "hrvMs" | "rhrBpm" | "sleepHours",
  beforeDate: string,
  windowDays: number
): Baseline | null {
  const cutoff = isoMinusDays(beforeDate, windowDays);
  const window = readings.filter(
    (r) => r.date < beforeDate && r.date >= cutoff && r[metric] != null
  );
  if (window.length < T.minBaselineN) return null;

  const vals = window.map((r) => r[metric] as number);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  return { mean, sd: Math.sqrt(variance), n: vals.length };
}

export function deviation(today: number, base: Baseline): Deviation {
  return {
    pct: ((today - base.mean) / base.mean) * 100,
    z: base.sd > 0 ? (today - base.mean) / base.sd : 0,
  };
}

// ── Status engine ─────────────────────────────────────────

export function dailyStatus(
  readings: RecoveryReading[],
  date: string
): RecoveryStatus {
  const r = readings.find((x) => x.date === date);
  if (!r) return "unknown";

  const hrv7 = r.hrvMs ? baseline(readings, "hrvMs", date, 7) : null;
  const rhr7 = r.rhrBpm ? baseline(readings, "rhrBpm", date, 7) : null;

  const hrvDev = r.hrvMs && hrv7 ? deviation(r.hrvMs, hrv7) : null;
  const rhrDev = r.rhrBpm && rhr7 ? deviation(r.rhrBpm, rhr7) : null;

  let breaches = 0;
  if (hrvDev && hrvDev.z <= T.hrvZAmber) breaches++;
  if (rhrDev && rhrDev.z >= T.rhrZAmber) breaches++;
  if (r.sleepHours != null && r.sleepHours < T.sleepAmberH) breaches++;

  // Red: 2+ metric breaches OR 3 consecutive declining HRV + rising RHR
  if (breaches >= 2 || hasMultiDayDecline(readings, date)) return "red";

  // Amber: 1 breach OR 2-day mild HRV decline
  if (breaches >= 1 || hasMildDecline(readings, date)) return "amber";

  return "green";
}

function hasMultiDayDecline(readings: RecoveryReading[], date: string): boolean {
  const dates = [isoMinusDays(date, 2), isoMinusDays(date, 1), date];
  const rs = dates.map((d) => readings.find((r) => r.date === d));
  if (rs.some((r) => !r)) return false;

  const hrv = rs.map((r) => r!.hrvMs).filter((v) => v != null) as number[];
  const rhr = rs.map((r) => r!.rhrBpm).filter((v) => v != null) as number[];
  if (hrv.length < 3 || rhr.length < 3) return false;

  return hrv[0] > hrv[1] && hrv[1] > hrv[2] && rhr[2] > rhr[1] && rhr[1] > rhr[0];
}

function hasMildDecline(readings: RecoveryReading[], date: string): boolean {
  const d0 = readings.find((r) => r.date === date);
  const d1 = readings.find((r) => r.date === isoMinusDays(date, 1));
  const d2 = readings.find((r) => r.date === isoMinusDays(date, 2));
  if (!d0?.hrvMs || !d1?.hrvMs || !d2?.hrvMs) return false;
  return d2.hrvMs > d1.hrvMs && d1.hrvMs > d0.hrvMs;
}

// ── Per-day enriched object ───────────────────────────────

export function enrichDay(readings: RecoveryReading[], date: string): DailyRecovery {
  const reading = readings.find((r) => r.date === date) ?? null;
  const status = dailyStatus(readings, date);

  const hrv7 = reading?.hrvMs ? baseline(readings, "hrvMs", date, 7) : null;
  const hrv30 = reading?.hrvMs ? baseline(readings, "hrvMs", date, 30) : null;
  const rhr7 = reading?.rhrBpm ? baseline(readings, "rhrBpm", date, 7) : null;

  return {
    date,
    reading,
    status,
    hrv7d: reading?.hrvMs && hrv7 ? deviation(reading.hrvMs, hrv7) : null,
    hrv30d: reading?.hrvMs && hrv30 ? deviation(reading.hrvMs, hrv30) : null,
    rhr7d: reading?.rhrBpm && rhr7 ? deviation(reading.rhrBpm, rhr7) : null,
    sleepOk: reading?.sleepHours != null ? reading.sleepHours >= T.sleepAmberH : null,
  };
}

// ── Weekly aggregate (for Trends overlay) ────────────────

export function weeklyRecovery(
  readings: RecoveryReading[],
  weekStart: string
): WeeklyRecovery {
  const weekEnd = isoMinusDays(weekStart, -7); // +7 days
  const weekReadings = readings.filter((r) => r.date >= weekStart && r.date < weekEnd);

  if (weekReadings.length === 0) {
    return { avgHrvDevPct: null, avgRhr: null, avgSleep: null, status: "unknown" };
  }

  const hrvDevs = weekReadings
    .filter((r) => r.hrvMs)
    .map((r) => {
      const base = baseline(readings, "hrvMs", r.date, 30);
      return base ? deviation(r.hrvMs!, base).pct : null;
    })
    .filter((v): v is number => v != null);

  const rhrVals = weekReadings.filter((r) => r.rhrBpm).map((r) => r.rhrBpm!);
  const sleepVals = weekReadings.filter((r) => r.sleepHours).map((r) => r.sleepHours!);

  const statuses = weekReadings.map((r) => dailyStatus(readings, r.date));
  const status: RecoveryStatus = statuses.includes("red")
    ? "red"
    : statuses.includes("amber")
    ? "amber"
    : statuses.some((s) => s === "green")
    ? "green"
    : "unknown";

  return {
    avgHrvDevPct: avg(hrvDevs),
    avgRhr: avg(rhrVals),
    avgSleep: avg(sleepVals),
    status,
  };
}

// ── Helpers ───────────────────────────────────────────────

function avg(vals: number[]): number | null {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function isoMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ── Formatting helpers (used in UI) ──────────────────────

export function fmtDevPct(dev: Deviation | null, higherIsBetter: boolean): string {
  if (!dev) return "—";
  const sign = dev.pct > 0 ? "+" : "";
  const val = `${sign}${dev.pct.toFixed(0)}%`;
  return val;
}

export function devColor(dev: Deviation | null, higherIsBetter: boolean): string {
  if (!dev) return "var(--text-muted)";
  const bad = higherIsBetter ? dev.z < -0.5 : dev.z > 0.5;
  const good = higherIsBetter ? dev.z > 0.5 : dev.z < -0.5;
  if (bad) return dev.z < -1 || dev.z > 1 ? "#ef4444" : "#f59e0b";
  if (good) return "#22c55e";
  return "var(--text-muted)";
}

export const STATUS_COLOR: Record<RecoveryStatus, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unknown: "var(--border)",
};
