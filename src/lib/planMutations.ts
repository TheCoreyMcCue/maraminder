import { QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./db";
import { planPk } from "./activePlan";
import type { Session, SessionType, SessionCategory, ZoneKey } from "./types";

function weekPad(n: number) {
  return String(n).padStart(2, "0");
}

// Timestamp base-36 + 5 random chars → ~14 chars, low collision probability
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateToDow(iso: string): string {
  return DOW_NAMES[new Date(iso + "T12:00:00").getDay()];
}

async function getWeekSessions(planId: string, weekNo: number): Promise<Session[]> {
  const r = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :pfx)",
      ExpressionAttributeValues: {
        ":pk": planPk(planId),
        ":pfx": `WEEK#${weekPad(weekNo)}#SES#`,
      },
    })
  );
  return (r.Items ?? []) as Session[];
}

// ── Error classes ─────────────────────────────────────────────────────────────

export class SameDayConflict extends Error {
  readonly code = "SAME_DAY_CONFLICT";
  constructor() {
    super("Day already has a session. Pass allowSameDay:true to add another.");
    this.name = "SameDayConflict";
    Object.setPrototypeOf(this, SameDayConflict.prototype);
  }
}

// ── addSession ────────────────────────────────────────────────────────────────

export interface NewSessionData {
  weekNo: number;
  date: string;
  type?: SessionType;
  category: SessionCategory;
  title: string;
  structure?: string;
  zoneRefs?: ZoneKey[];
  targetDurationMin?: number;
  targetDistanceKm?: number;
}

export async function addSession(
  planId: string,
  data: NewSessionData,
  opts?: { allowSameDay?: boolean }
): Promise<{ sk: string }> {
  const pk = planPk(planId);
  const existing = await getWeekSessions(planId, data.weekNo);

  const sameDay = existing.filter((s) => s.date === data.date);
  if (sameDay.length > 0 && !opts?.allowSameDay) {
    throw new SameDayConflict();
  }

  const maxOrder = existing.reduce((m, s) => Math.max(m, s.order), -1);
  const sk = `WEEK#${weekPad(data.weekNo)}#SES#${genId()}`;

  // Build item; undefined optional fields are stripped by marshallOptions
  const item: Session = {
    pk,
    sk,
    weekNo: data.weekNo,
    date: data.date,
    dayOfWeek: dateToDow(data.date),
    type: data.type ?? "fill",
    category: data.category,
    title: data.title,
    structure: data.structure ?? "",
    zoneRefs: data.zoneRefs ?? [],
    targetDurationMin: data.targetDurationMin,
    targetDistanceKm: data.targetDistanceKm,
    order: maxOrder + 1,
    status: "planned",
    actual: null,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return { sk };
}

// ── splitSession ──────────────────────────────────────────────────────────────

export interface SplitPart {
  title: string;
  targetDurationMin?: number;
  targetDistanceKm?: number;
  date?: string; // part2 only — defaults to original session date
}

export async function splitSession(
  planId: string,
  sessionSk: string,
  parts: { part1: SplitPart; part2: SplitPart }
): Promise<{ sk1: string; sk2: string }> {
  const pk = planPk(planId);

  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk: sessionSk } })
  );
  if (!result.Item) throw new Error("Session not found");
  const original = result.Item as Session;

  // ── Update Part 1 (the original session) ────────────────────────────────
  const p1Fields: Array<[string, unknown]> = [["title", parts.part1.title]];
  if (parts.part1.targetDurationMin !== undefined) {
    p1Fields.push(["targetDurationMin", parts.part1.targetDurationMin]);
  }
  if (parts.part1.targetDistanceKm !== undefined) {
    p1Fields.push(["targetDistanceKm", parts.part1.targetDistanceKm]);
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk: sessionSk },
      UpdateExpression: `SET ${p1Fields.map(([k]) => `#${k} = :${k}`).join(", ")}`,
      ExpressionAttributeNames: Object.fromEntries(
        p1Fields.map(([k]) => [`#${k}`, k as string])
      ),
      ExpressionAttributeValues: Object.fromEntries(
        p1Fields.map(([k, v]) => [`:${k}`, v])
      ),
    })
  );

  // ── Create Part 2 (new session) ──────────────────────────────────────────
  // Re-query to get accurate maxOrder (includes the original we just touched)
  const weekSessions = await getWeekSessions(planId, original.weekNo);
  const maxOrder = weekSessions.reduce((m, s) => Math.max(m, s.order), -1);

  const part2Date = parts.part2.date ?? original.date;
  const sk2 = `WEEK#${weekPad(original.weekNo)}#SES#${genId()}`;

  const part2Item: Session = {
    pk,
    sk: sk2,
    weekNo: original.weekNo,
    date: part2Date,
    dayOfWeek: dateToDow(part2Date),
    type: original.type,
    category: original.category,
    title: parts.part2.title,
    structure: original.structure,
    zoneRefs: [...original.zoneRefs],
    targetDurationMin: parts.part2.targetDurationMin ?? original.targetDurationMin,
    targetDistanceKm: parts.part2.targetDistanceKm ?? original.targetDistanceKm,
    order: maxOrder + 1,
    status: "planned",
    actual: null,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: part2Item }));
  return { sk1: sessionSk, sk2 };
}

// ── deleteSession ─────────────────────────────────────────────────────────────

export async function deleteSession(planId: string, sessionSk: string): Promise<void> {
  const pk = planPk(planId);
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { pk, sk: sessionSk } }));
}
