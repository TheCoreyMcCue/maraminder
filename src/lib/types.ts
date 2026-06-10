export type ZoneKey = "E" | "S" | "MP" | "T" | "I";

export interface Zone {
  label: string;
  paceLow?: string;
  paceHigh?: string;
  pace?: string;
  hrMax?: number;
  hrMin?: number;
  hrLow?: number;
  hrHigh?: number;
}

export interface ZoneSet {
  pk: string;
  sk: string;
  version: number;
  effectiveWeek: number;
  source: string;
  zones: Record<ZoneKey, Zone>;
}

export interface Actual {
  distanceKm: number;
  durationMin: number;
  avgPacePerKm?: string;
  avgHr?: number;
  // HR logged per quality zone (e.g. { MP: 172 }) — more accurate than overall avgHr
  segmentHr?: Partial<Record<ZoneKey, number>>;
  // Pace logged per quality zone (e.g. { MP: "4:18" }) — actual pace during the blocks
  segmentPace?: Partial<Record<ZoneKey, string>>;
  rpe?: number;
  avgPowerW?: number;
  restTaken?: boolean;  // true when a fill session was consciously swapped for full rest
  notes?: string;
  stravaUrl?: string;
  // Conditions
  tempC?: number;
  wind?: string;
  // Cardiac decoupling (long runs / MP blocks) — the durability signal
  decoupling?: {
    firstHalfHr?: number;
    secondHalfHr?: number;
    paceHeldKm?: string;
  };
  targetSnapshot: Partial<Record<ZoneKey, string>>;
}

export type SessionStatus = "planned" | "done" | "skipped" | "moved";
export type SessionCategory =
  | "easy"
  | "steady"
  | "mp"
  | "threshold"
  | "vo2"
  | "long"
  | "rest"
  | "race"
  | "bike"
  | "brick";
export type SessionType = "anchor" | "fill";

export interface Session {
  pk: string;
  sk: string;
  weekNo: number;
  date: string;
  dayOfWeek: string;
  type: SessionType;
  category: SessionCategory;
  title: string;
  structure: string;
  zoneRefs: ZoneKey[];
  targetDurationMin?: number;
  targetDistanceKm?: number;
  order: number;
  status: SessionStatus;
  actual: Actual | null;
}

export interface Week {
  pk: string;
  sk: string;
  weekNo: number;
  phase: string;
  dateStart: string;
  dateEnd: string;
  volumeTargetKm: number;
  volumeTargetHours?: number;
  isDownWeek: boolean;
  notes?: string;
}

export interface PlanMeta {
  pk: string;
  sk: string;
  name: string;
  raceDate: string;
  halfDate: string;
  startDate: string;
  goalTime: string;
  goalPace: string;
  currentZoneVersion: number;
}

export interface Warning {
  code: string;
  message: string;
  severity: "warn" | "info";
  sessionIds?: string[];
}

// ── Personal baseline ─────────────────────────────────────

export interface PersonalBaseline {
  pk: string;   // "USER#default"
  sk: string;   // "RECOVERY_BASELINE"
  hrv:   { mean: number; sd: number };
  rhr:   { mean: number; sd: number };
  sleepTargetHours: number;
  ftpW?: number;
  // Seeds the 28-day chronic load when app history is sparse.
  // Reflects pre-app training so ACWR isn't misleadingly high on day 1.
  typicalWeeklyHours?: number;
  note?: string;
}

// ── Recovery ──────────────────────────────────────────────

export interface RecoveryReading {
  pk: string;
  sk: string; // RECOVERY#YYYY-MM-DD
  date: string;
  hrvMs?: number;
  rhrBpm?: number;
  sleepHours?: number;
  sleepScore?: number;
  readiness?: number;
  source: "shortcuts" | "manual" | "export-tool";
  note?: string;
  lifeStress?: number;  // 1–10 subjective scale
  legFatigue?: number;  // 1–10 (1 = fresh, 10 = very heavy legs)
}

export type RecoveryStatus = "green" | "amber" | "red" | "unknown";

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

export interface Deviation {
  pct: number;  // % deviation from mean (negative = worse for HRV, positive = worse for RHR)
  z: number;    // z-score
}

export interface DailyRecovery {
  date: string;
  reading: RecoveryReading | null;
  status: RecoveryStatus;
  hrv7d: Deviation | null;
  hrv30d: Deviation | null;
  rhr7d: Deviation | null;
  sleepOk: boolean | null;
}

export interface WeeklyRecovery {
  avgHrvDevPct: number | null;
  avgRhr: number | null;
  avgSleep: number | null;
  status: RecoveryStatus;
}

export interface PlanData {
  meta: PlanMeta;
  currentZones: ZoneSet;
  allZones: ZoneSet[];
  weeks: Week[];
  sessions: Session[];
}
