"use server";
// All exports from this module are Next.js Server Actions.
// Import only from Server Components or via useTransition in Client Components.

import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME, PLAN_PK } from "./db";
import type { PlanData, PlanMeta, ZoneSet, Week, Session, Actual } from "./types";
import { evaluateWeek } from "./rules";
import { buildTargetSnapshot } from "./zones";

function weekPad(n: number) {
  return n.toString().padStart(2, "0");
}

export async function getPlan(): Promise<PlanData> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": PLAN_PK },
    })
  );

  const items = result.Items || [];
  let meta: PlanMeta | undefined;
  const allZones: ZoneSet[] = [];
  const weeks: Week[] = [];
  const sessions: Session[] = [];

  for (const item of items) {
    if (item.sk === "META") {
      meta = item as PlanMeta;
    } else if (item.sk.startsWith("ZONES#")) {
      allZones.push(item as ZoneSet);
    } else if (/^WEEK#\d+$/.test(item.sk)) {
      weeks.push(item as Week);
    } else if (/^WEEK#\d+#SES#/.test(item.sk)) {
      sessions.push(item as Session);
    }
  }

  if (!meta) throw new Error("Plan META not found");

  allZones.sort((a, b) => a.version - b.version);
  weeks.sort((a, b) => a.weekNo - b.weekNo);
  sessions.sort((a, b) => a.order - b.order);

  const currentZones =
    allZones.find((z) => z.version === meta!.currentZoneVersion) ||
    allZones[allZones.length - 1];

  return { meta, currentZones, allZones, weeks, sessions };
}

export async function getWeekData(weekNo: number): Promise<{
  week: Week;
  sessions: Session[];
  currentZones: ZoneSet;
  meta: PlanMeta;
}> {
  const plan = await getPlan();
  const week = plan.weeks.find((w) => w.weekNo === weekNo);
  if (!week) throw new Error(`Week ${weekNo} not found`);
  const sessions = plan.sessions
    .filter((s) => s.weekNo === weekNo)
    .sort((a, b) => a.order - b.order);
  return { week, sessions, currentZones: plan.currentZones, meta: plan.meta };
}

export async function logActual(
  sessionSk: string,
  actual: Omit<Actual, "targetSnapshot">
): Promise<void> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk: PLAN_PK, sk: sessionSk } })
  );
  if (!result.Item) throw new Error("Session not found");

  const session = result.Item as Session;

  const plan = await getPlan();
  const snapshot = buildTargetSnapshot(session, plan.currentZones);

  const fullActual: Actual = { ...actual, targetSnapshot: snapshot };

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PLAN_PK, sk: sessionSk },
      UpdateExpression: "SET #actual = :actual, #status = :status",
      ExpressionAttributeNames: { "#actual": "actual", "#status": "status" },
      ExpressionAttributeValues: { ":actual": fullActual, ":status": "done" },
    })
  );
}

export async function updateSessionStatus(
  sessionSk: string,
  status: "planned" | "skipped" | "done" | "moved"
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PLAN_PK, sk: sessionSk },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
    })
  );
}

export async function unlogSession(sessionSk: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PLAN_PK, sk: sessionSk },
      UpdateExpression: "SET #status = :status REMOVE #actual",
      ExpressionAttributeNames: { "#status": "status", "#actual": "actual" },
      ExpressionAttributeValues: { ":status": "planned" },
    })
  );
}

export async function moveSession(
  sessionSk: string,
  toDate: string
): Promise<{ warnings: ReturnType<typeof evaluateWeek> }> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk: PLAN_PK, sk: sessionSk } })
  );
  if (!result.Item) throw new Error("Session not found");

  const session = result.Item as Session;

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date(toDate + "T12:00:00").getDay()
  ];

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PLAN_PK, sk: sessionSk },
      UpdateExpression: "SET #date = :date, dayOfWeek = :dow",
      ExpressionAttributeNames: { "#date": "date" },
      ExpressionAttributeValues: { ":date": toDate, ":dow": dow },
    })
  );

  const plan = await getPlan();
  const weekSessions = plan.sessions.filter((s) => s.weekNo === session.weekNo);
  const week = plan.weeks.find((w) => w.weekNo === session.weekNo);
  const warnings = evaluateWeek(weekSessions, week);

  return { warnings };
}

export async function recalibrateZones(
  newZones: ZoneSet["zones"],
  effectiveWeek: number,
  source: string
): Promise<void> {
  const plan = await getPlan();
  const nextVersion = plan.meta.currentZoneVersion + 1;

  const newZoneSet: ZoneSet = {
    pk: PLAN_PK,
    sk: `ZONES#${nextVersion}`,
    version: nextVersion,
    effectiveWeek,
    source,
    zones: newZones,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: newZoneSet }));
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PLAN_PK, sk: "META" },
      UpdateExpression: "SET currentZoneVersion = :v",
      ExpressionAttributeValues: { ":v": nextVersion },
    })
  );
}

export async function updateSession(
  sessionSk: string,
  patch: Partial<Pick<Session, "title" | "structure" | "targetDistanceKm" | "targetDurationMin">>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const setExpr = entries.map(([k]) => `#${k} = :${k}`).join(", ");
  const names = Object.fromEntries(entries.map(([k]) => [`#${k}`, k]));
  const values = Object.fromEntries(entries.map(([k, v]) => [`:${k}`, v]));

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PLAN_PK, sk: sessionSk },
      UpdateExpression: `SET ${setExpr}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function getTrends(): Promise<{
  mpHrHistory: Array<{ date: string; avgHr: number; weekNo: number }>;
  easyPaceHistory: Array<{ date: string; pace: string; weekNo: number }>;
  weeklyVolume: Array<{ weekNo: number; targetKm: number; actualKm: number }>;
}> {
  const plan = await getPlan();
  const logged = plan.sessions.filter((s) => s.status === "done" && s.actual);

  const mpHrHistory = logged
    .filter((s) => s.zoneRefs.includes("MP") && s.actual?.avgHr)
    .map((s) => ({ date: s.date, avgHr: s.actual!.avgHr!, weekNo: s.weekNo }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const easyPaceHistory = logged
    .filter((s) => s.category === "easy" && s.actual?.avgPacePerKm)
    .map((s) => ({ date: s.date, pace: s.actual!.avgPacePerKm!, weekNo: s.weekNo }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyVolume = plan.weeks.map((w) => {
    const wSessions = plan.sessions.filter((s) => s.weekNo === w.weekNo);
    const actualKm = wSessions
      .filter((s) => s.actual?.distanceKm)
      .reduce((sum, s) => sum + (s.actual?.distanceKm || 0), 0);
    return { weekNo: w.weekNo, targetKm: w.volumeTargetKm, actualKm };
  });

  return { mpHrHistory, easyPaceHistory, weeklyVolume };
}
