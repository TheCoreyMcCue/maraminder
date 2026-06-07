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
  notes?: string;
  stravaUrl?: string;
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
  | "race";
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

export interface PlanData {
  meta: PlanMeta;
  currentZones: ZoneSet;
  allZones: ZoneSet[];
  weeks: Week[];
  sessions: Session[];
}
