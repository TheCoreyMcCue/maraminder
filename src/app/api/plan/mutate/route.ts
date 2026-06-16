import { NextRequest, NextResponse } from "next/server";
import {
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "@/lib/db";
import { planPk } from "@/lib/activePlan";
import { buildTargetSnapshot } from "@/lib/zones";
import type { Session, PlanMeta, ZoneSet, Actual, ZoneKey } from "@/lib/types";
import { createHmac, timingSafeEqual as tse } from "crypto";
import { addSession, splitSession, SameDayConflict } from "@/lib/planMutations";
import type { NewSessionData, SplitPart } from "@/lib/planMutations";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────
// MARAMINDER_WRITE_KEY must be set; without it the route is unconditionally 401.
// Compares via HMAC digest so both sides are a fixed 32 bytes — no length oracle.

function checkAuth(req: NextRequest): boolean {
  const key = process.env.MARAMINDER_WRITE_KEY;
  if (!key) return false;

  const auth = req.headers.get("authorization");
  const xKey = req.headers.get("x-api-key");
  let provided: string | null = null;
  if (auth?.startsWith("Bearer ")) provided = auth.slice(7);
  else if (xKey) provided = xKey;
  if (!provided) return false;

  const salt = "maraminder-auth";
  return tse(
    createHmac("sha256", salt).update(provided as string).digest(),
    createHmac("sha256", salt).update(key as string).digest()
  );
}

// ── Internal types ────────────────────────────────────────────────────────────

type RawItem = Record<string, unknown>;

type WriteOp =
  | { action: "put"; item: RawItem }
  | {
      action: "update";
      key: { pk: string; sk: string };
      expr: string;
      names: Record<string, string>;
      values: Record<string, unknown>;
    }
  | { action: "delete"; key: { pk: string; sk: string } };

// ── DynamoDB helpers ──────────────────────────────────────────────────────────

const weekPad = (n: number) => String(n).padStart(2, "0");
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function queryPlanItems(planId: string): Promise<RawItem[]> {
  const r = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": planPk(planId) },
    })
  );
  return (r.Items ?? []) as RawItem[];
}

// Efficient session lookup: query only the target week's session SKs.
async function findSession(planId: string, weekNo: number, date: string): Promise<Session | null> {
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
  return ((r.Items ?? []) as Session[]).find((s) => s.date === date) ?? null;
}

async function execSequential(writes: WriteOp[]): Promise<void> {
  for (const w of writes) {
    if (w.action === "put") {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: w.item }));
    } else if (w.action === "update") {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: w.key,
          UpdateExpression: w.expr,
          ExpressionAttributeNames: w.names,
          ExpressionAttributeValues: w.values,
        })
      );
    } else {
      await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: w.key }));
    }
  }
}

async function execTransact(writes: WriteOp[]): Promise<void> {
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: writes.map((w) => {
        if (w.action === "put") {
          return { Put: { TableName: TABLE_NAME, Item: w.item } };
        } else if (w.action === "update") {
          return {
            Update: {
              TableName: TABLE_NAME,
              Key: w.key,
              UpdateExpression: w.expr,
              ExpressionAttributeNames: w.names,
              ExpressionAttributeValues: w.values,
            },
          };
        } else {
          return { Delete: { TableName: TABLE_NAME, Key: w.key } };
        }
      }),
    })
  );
}

// ── Response helpers ──────────────────────────────────────────────────────────

const noStore = { "Cache-Control": "no-store" } as const;

function err400(reason: string, opIndex?: number, opType?: string) {
  return NextResponse.json(
    { error: "Bad Request", reason, ...(opIndex !== undefined ? { opIndex, opType } : {}) },
    { status: 400, headers: noStore }
  );
}

function err404(reason: string, opIndex: number, opType: string) {
  return NextResponse.json(
    { error: "Not Found", reason, opIndex, opType },
    { status: 404, headers: noStore }
  );
}

function err409(reason: string, opIndex: number, opType: string) {
  return NextResponse.json(
    { error: "Conflict", reason, opIndex, opType },
    { status: 409, headers: noStore }
  );
}

// ── POST /api/plan/mutate ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }

  let body: RawItem;
  try {
    body = await req.json();
  } catch {
    return err400("Invalid JSON");
  }

  const planId = body.planId as string | undefined;
  const ops = body.ops as unknown[] | undefined;

  if (typeof planId !== "string" || !planId) return err400("planId (string) required");
  if (!Array.isArray(ops) || ops.length === 0) return err400("ops must be a non-empty array");

  const pk = planPk(planId);

  // Populated during validation; reused during build to avoid double-reads.
  let planItemsCache: RawItem[] | null = null;
  const sessionCache = new Map<string, Session>(); // "<weekNo>:<date>" -> Session

  async function getPlanItems(): Promise<RawItem[]> {
    if (!planItemsCache) planItemsCache = await queryPlanItems(planId as string);
    return planItemsCache;
  }

  async function getSession(weekNo: number, date: string): Promise<Session | null> {
    const k = `${weekNo}:${date}`;
    if (!sessionCache.has(k)) {
      const s = await findSession(planId as string, weekNo, date);
      if (s) sessionCache.set(k, s);
    }
    return sessionCache.get(k) ?? null;
  }

  // ── Phase 1: Validate entire batch — no writes ─────────────────────────────

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i] as RawItem;
    const t = op?.type as string | undefined;
    if (!t) return err400("op.type is required", i, "unknown");

    if (t === "replacePlan") {
      if (op.confirm !== true) return err400("confirm must be true for replacePlan", i, t);
      const plan = op.plan as RawItem | null;
      if (!plan || typeof plan !== "object") return err400("plan object required", i, t);
      const m = plan.meta as RawItem | null;
      if (
        !m ||
        typeof m.name !== "string" ||
        typeof m.raceDate !== "string" ||
        typeof m.halfDate !== "string" ||
        typeof m.startDate !== "string" ||
        typeof m.goalTime !== "string" ||
        typeof m.goalPace !== "string" ||
        typeof m.currentZoneVersion !== "number"
      ) {
        return err400(
          "plan.meta requires: name, raceDate, halfDate, startDate, goalTime, goalPace, currentZoneVersion",
          i, t
        );
      }
      for (const f of ["zones", "weeks", "sessions", "recovery"] as const) {
        if (plan[f] !== undefined && !Array.isArray(plan[f])) {
          return err400(`plan.${f} must be an array if provided`, i, t);
        }
      }
      await getPlanItems(); // pre-load existing items for delete computation

    } else if (t === "patchPlanMeta") {
      const fields = op.fields as RawItem | null;
      if (!fields || typeof fields !== "object" || !Object.keys(fields).length) {
        return err400("fields (non-empty object) required", i, t);
      }
      const allowed = new Set([
        "goalPace", "goalTime", "raceDate", "halfDate",
        "startDate", "name", "currentZoneVersion",
      ]);
      const unknown = Object.keys(fields).filter((k) => !allowed.has(k));
      if (unknown.length) return err400(`unknown fields: ${unknown.join(", ")}`, i, t);

    } else if (t === "upsertZoneVersion") {
      const zv = op.zoneVersion as RawItem | null;
      if (!zv || typeof zv !== "object") return err400("zoneVersion object required", i, t);
      if (typeof zv.version !== "number") return err400("zoneVersion.version (number) required", i, t);
      if (typeof zv.effectiveWeek !== "number") return err400("zoneVersion.effectiveWeek (number) required", i, t);
      if (!zv.zones || typeof zv.zones !== "object") return err400("zoneVersion.zones object required", i, t);
      if (typeof op.setCurrent !== "boolean") return err400("setCurrent (boolean) required", i, t);

    } else if (t === "patchSession" || t === "logActual") {
      const match = op.match as { weekNo?: unknown; date?: unknown } | null;
      if (!match || typeof match.weekNo !== "number" || typeof match.date !== "string") {
        return err400("match.weekNo (number) and match.date (string) required", i, t);
      }
      const session = await getSession(match.weekNo, match.date);
      if (!session) {
        return err404(`no session matching weekNo=${match.weekNo} date=${match.date}`, i, t);
      }
      if (t === "patchSession") {
        const set = op.set as RawItem | null;
        if (!set || !Object.keys(set).length) return err400("set (non-empty object) required", i, t);
      } else {
        const actual = op.actual as RawItem | null;
        if (!actual || typeof actual !== "object") return err400("actual object required", i, t);
        if (typeof actual.distanceKm !== "number") return err400("actual.distanceKm (number) required", i, t);
        if (typeof actual.durationMin !== "number") return err400("actual.durationMin (number) required", i, t);
      }
    } else if (t === "addSession") {
      const data = op.data as RawItem | null;
      if (!data || typeof data !== "object") return err400("data object required", i, t);
      if (typeof data.weekNo !== "number") return err400("data.weekNo (number) required", i, t);
      if (typeof data.date !== "string") return err400("data.date (string) required", i, t);
      const validCats = new Set(["easy","steady","mp","threshold","vo2","long","rest","race","bike","brick"]);
      if (typeof data.category !== "string" || !validCats.has(data.category)) {
        return err400("data.category must be a valid SessionCategory", i, t);
      }
      if (typeof data.title !== "string" || !data.title.trim()) {
        return err400("data.title (non-empty string) required", i, t);
      }

    } else if (t === "splitSession") {
      if (typeof op.sk !== "string" || !op.sk) return err400("sk (string) required", i, t);
      const parts = op.parts as { part1?: RawItem; part2?: RawItem } | null;
      if (!parts || typeof parts !== "object") return err400("parts object required", i, t);
      if (!parts.part1 || typeof parts.part1.title !== "string" || !(parts.part1.title as string).trim()) {
        return err400("parts.part1.title (non-empty string) required", i, t);
      }
      if (!parts.part2 || typeof parts.part2.title !== "string" || !(parts.part2.title as string).trim()) {
        return err400("parts.part2.title (non-empty string) required", i, t);
      }
      // Confirm session exists
      const chk = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk, sk: op.sk as string },
      }));
      if (!chk.Item) return err404(`session ${op.sk as string} not found`, i, t);

    } else {
      return err400(`unknown op type: "${t}"`, i, t);
    }
  }

  // ── Phase 2: Build write list ─────────────────────────────────────────────

  const writes: WriteOp[] = [];
  const directOps: RawItem[] = [];
  const opResults: { type: string; result: string }[] = [];
  const now = new Date().toISOString();

  // Loads current zone set for targetSnapshot; uses planItemsCache when available.
  let currentZonesCache: ZoneSet | null = null;
  async function getCurrentZones(): Promise<ZoneSet> {
    if (currentZonesCache) return currentZonesCache;
    const items = planItemsCache ?? (await queryPlanItems(planId as string));
    let meta: PlanMeta | undefined;
    const zones: ZoneSet[] = [];
    for (const item of items) {
      const sk = item.sk as string;
      if (sk === "META") meta = item as unknown as PlanMeta;
      else if (sk.startsWith("ZONES#")) zones.push(item as unknown as ZoneSet);
    }
    if (!meta) throw new Error("Plan META not found");
    zones.sort((a, b) => a.version - b.version);
    currentZonesCache =
      zones.find((z) => z.version === meta!.currentZoneVersion) ?? zones[zones.length - 1];
    return currentZonesCache;
  }

  for (const op of ops as RawItem[]) {
    const t = op.type as string;

    // ── replacePlan ──────────────────────────────────────────────────────────
    if (t === "replacePlan") {
      const plan = op.plan as RawItem;
      const metaFields = plan.meta as RawItem;
      const zones = (plan.zones as RawItem[] | undefined) ?? [];
      const weeks = (plan.weeks as RawItem[] | undefined) ?? [];
      const sessions = (plan.sessions as RawItem[] | undefined) ?? [];
      const recovery = (plan.recovery as RawItem[] | undefined) ?? [];

      // Build the full set of new items (pk is always overwritten to this plan's pk).
      const newItems: RawItem[] = [];

      newItems.push({ ...metaFields, pk, sk: "META", lastMutatedAt: now });

      for (const z of zones) {
        newItems.push({ ...z, pk, sk: `ZONES#${z.version as number}` });
      }
      for (const w of weeks) {
        newItems.push({ ...w, pk, sk: `WEEK#${weekPad(w.weekNo as number)}` });
      }
      for (const s of sessions) {
        // Sessions must carry their sk in the payload (e.g. "WEEK#01#SES#q1").
        const sk = (s.sk ?? null) as string | null;
        if (sk) newItems.push({ ...s, pk, sk });
      }
      for (const r of recovery) {
        const sk = (
          (r.sk ?? (r.date ? `RECOVERY#${r.date}` : null)) ?? null
        ) as string | null;
        if (sk) newItems.push({ ...r, pk, sk });
      }

      const newSks = new Set(newItems.map((item) => item.sk as string));

      // Delete existing controlled items that are absent from the new payload.
      const toDelete = (planItemsCache ?? ([] as RawItem[])).filter((item) => {
        const sk = item.sk as string;
        return (
          sk === "META" ||
          sk.startsWith("ZONES#") ||
          sk.startsWith("RECOVERY#") ||
          /^WEEK#\d+$/.test(sk) ||
          /^WEEK#\d+#SES#/.test(sk)
        ) && !newSks.has(sk);
      });

      for (const item of newItems) writes.push({ action: "put", item });
      for (const item of toDelete) {
        writes.push({
          action: "delete",
          key: { pk: item.pk as string, sk: item.sk as string },
        });
      }

      opResults.push({
        type: t,
        result: `${newItems.length} items written, ${toDelete.length} stale items deleted`,
      });

    // ── patchPlanMeta ────────────────────────────────────────────────────────
    } else if (t === "patchPlanMeta") {
      const fields = op.fields as Record<string, unknown>;
      const entries = Object.entries(fields);
      writes.push({
        action: "update",
        key: { pk, sk: "META" },
        expr: `SET ${entries.map(([k]) => `#${k} = :${k}`).join(", ")}, #lma = :lma`,
        names: {
          ...Object.fromEntries(entries.map(([k]) => [`#${k}`, k])),
          "#lma": "lastMutatedAt",
        },
        values: {
          ...Object.fromEntries(entries.map(([k, v]) => [`:${k}`, v])),
          ":lma": now,
        },
      });
      opResults.push({ type: t, result: `updated: ${entries.map(([k]) => k).join(", ")}` });

    // ── upsertZoneVersion ────────────────────────────────────────────────────
    } else if (t === "upsertZoneVersion") {
      const zv = op.zoneVersion as RawItem;
      const version = zv.version as number;
      writes.push({ action: "put", item: { ...zv, pk, sk: `ZONES#${version}` } });

      if (op.setCurrent) {
        writes.push({
          action: "update",
          key: { pk, sk: "META" },
          expr: "SET currentZoneVersion = :v, #lma = :lma",
          names: { "#lma": "lastMutatedAt" },
          values: { ":v": version, ":lma": now },
        });
      }

      opResults.push({
        type: t,
        result: [
          `zone version ${version} upserted`,
          op.setCurrent ? "set as current" : null,
          // Live session targets derive from the current zone set at read time
          // (session.zoneRefs × currentZones). No stored field to re-price.
          // Previously logged actual.targetSnapshot values reflect zones at log time.
          "live session targets are computed at read time — no stored re-price needed",
        ]
          .filter(Boolean)
          .join("; "),
      });

    // ── patchSession ─────────────────────────────────────────────────────────
    } else if (t === "patchSession") {
      const match = op.match as { weekNo: number; date: string };
      const set = op.set as RawItem;
      const session = sessionCache.get(`${match.weekNo}:${match.date}`)!;

      const update: Record<string, unknown> = {};
      if (set.status !== undefined) update.status = set.status;
      if (set.category !== undefined) update.category = set.category;
      if (set.type !== undefined) update.type = set.type;
      if (set.title !== undefined) update.title = set.title;
      // Changing date = move; derive new dayOfWeek automatically.
      if (typeof set.date === "string") {
        update.date = set.date;
        update.dayOfWeek = DOW[new Date(set.date + "T12:00:00").getDay()];
      }
      // Merge target sub-fields (only provided fields are written).
      const target = set.target as RawItem | undefined;
      if (target) {
        if (target.durationMin !== undefined) update.targetDurationMin = target.durationMin;
        if (target.distanceKm !== undefined) update.targetDistanceKm = target.distanceKm;
        if (target.zoneRefs !== undefined) update.zoneRefs = target.zoneRefs;
        if (target.structure !== undefined) update.structure = target.structure;
      }

      const entries = Object.entries(update);
      if (entries.length) {
        writes.push({
          action: "update",
          key: { pk: session.pk, sk: session.sk },
          expr: `SET ${entries.map(([k]) => `#${k} = :${k}`).join(", ")}`,
          names: Object.fromEntries(entries.map(([k]) => [`#${k}`, k])),
          values: Object.fromEntries(entries.map(([k, v]) => [`:${k}`, v])),
        });
      }
      opResults.push({
        type: t,
        result: entries.length
          ? `${session.sk} patched (${entries.map(([k]) => k).join(", ")})`
          : `${session.sk} — no recognized fields, no-op`,
      });

    // ── logActual ────────────────────────────────────────────────────────────
    } else if (t === "logActual") {
      const match = op.match as { weekNo: number; date: string };
      const session = sessionCache.get(`${match.weekNo}:${match.date}`)!;
      const actualInput = op.actual as Omit<Actual, "targetSnapshot">;

      let targetSnapshot: Partial<Record<ZoneKey, string>> = {};
      try {
        const zones = await getCurrentZones();
        targetSnapshot = buildTargetSnapshot(session, zones);
      } catch {
        // Proceed without snapshot if zones are unavailable.
      }

      const fullActual = { ...actualInput, targetSnapshot };

      writes.push({
        action: "update",
        key: { pk: session.pk, sk: session.sk },
        expr: "SET #actual = :actual, #status = :status",
        names: { "#actual": "actual", "#status": "status" },
        values: {
          ":actual": fullActual as unknown as Record<string, unknown>,
          ":status": "done",
        },
      });
      opResults.push({
        type: t,
        result: `${session.sk} logged done (${actualInput.distanceKm}km / ${actualInput.durationMin}min)`,
      });

    // ── addSession / splitSession — delegate to planMutations ────────────────
    } else if (t === "addSession" || t === "splitSession") {
      directOps.push(op);
      opResults.push({ type: t, result: "queued" });
    }
  }

  // ── Phase 3: Execute ──────────────────────────────────────────────────────

  // TransactWrite requires each key to appear at most once.
  const seenKeys = new Set<string>();
  let hasDupKey = false;
  for (const w of writes) {
    const keyStr =
      w.action === "put"
        ? `${w.item.pk as string}::${w.item.sk as string}`
        : `${w.key.pk}::${w.key.sk}`;
    if (seenKeys.has(keyStr)) { hasDupKey = true; break; }
    seenKeys.add(keyStr);
  }

  const mode: "transact" | "sequential" =
    writes.length <= 100 && !hasDupKey ? "transact" : "sequential";

  console.log(
    `[mutate] planId=${planId} ops=${ops.length} writes=${writes.length} mode=${mode}` +
    ` types=${(ops as RawItem[]).map((o) => o.type).join(",")}`
  );

  try {
    if (writes.length > 0) {
      if (mode === "transact") {
        await execTransact(writes);
      } else {
        await execSequential(writes);
      }
    }
  } catch (err) {
    console.error("[mutate] write error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(err) },
      { status: 500, headers: noStore }
    );
  }

  // ── Direct ops (addSession, splitSession) — run after transact ───────────
  for (let i = 0; i < directOps.length; i++) {
    const op = directOps[i];
    const t = op.type as string;
    const opIdx = opResults.findIndex((r, idx) => r.type === t && r.result === "queued" && idx >= i);

    try {
      if (t === "addSession") {
        const data = op.data as NewSessionData;
        const opts = op.opts as { allowSameDay?: boolean } | undefined;
        const { sk } = await addSession(planId as string, data, opts);
        if (opIdx !== -1) opResults[opIdx] = { type: t, result: `added ${sk}` };

      } else if (t === "splitSession") {
        const parts = op.parts as { part1: SplitPart; part2: SplitPart };
        const { sk1, sk2 } = await splitSession(planId as string, op.sk as string, parts);
        if (opIdx !== -1) opResults[opIdx] = { type: t, result: `split: ${sk1} → ${sk2}` };
      }
    } catch (err) {
      if (err instanceof SameDayConflict) {
        return err409((err as SameDayConflict).message, opIdx, t);
      }
      console.error(`[mutate] direct op ${t} error:`, err);
      return NextResponse.json(
        { error: "Internal Server Error", detail: String(err) },
        { status: 500, headers: noStore }
      );
    }
  }

  return NextResponse.json(
    { ok: true, planId, mode, applied: opResults },
    { status: 200, headers: noStore }
  );
}
