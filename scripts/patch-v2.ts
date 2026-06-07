/**
 * Surgical patch — fixes plan data to match the authoritative document.
 * Only updates items that were wrong; leaves status/actual on logged sessions intact.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, sessionToken: process.env.AWS_SESSION_TOKEN }
      : undefined,
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
});

const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
const TABLE = process.env.DYNAMODB_TABLE || "marathonPlan";
const PK = "PLAN#amsterdam26";

async function upd(sk: string, expr: string, names: Record<string, string>, values: Record<string, unknown>) {
  await doc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: PK, sk },
    UpdateExpression: expr,
    ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
    ExpressionAttributeValues: values,
  }));
  console.log(`  ✓ ${sk}`);
}

async function main() {
  console.log("Patching table:", TABLE);

  // ── Zones v1 ────────────────────────────────────────────────────────────────
  console.log("\nPatching ZONES#1...");
  await doc.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: PK, sk: "ZONES#1",
      version: 1, effectiveWeek: 1, source: "field-anchored (pre-block)",
      zones: {
        E:  { label: "Easy",      paceLow: "5:00", paceHigh: "5:20", hrMax: 174 },
        S:  { label: "Steady",    paceLow: "4:25", paceHigh: "4:40", hrLow: 174, hrHigh: 180 },
        MP: { label: "Marathon",  pace: "4:16",                       hrLow: 168, hrHigh: 176 },
        T:  { label: "Threshold", paceLow: "3:52", paceHigh: "4:02", hrLow: 180, hrHigh: 187 },
        I:  { label: "Interval",  paceLow: "3:25", paceHigh: "3:40", hrMin: 188 },
      },
    },
  }));
  console.log("  ✓ ZONES#1");

  // ── Week metadata ────────────────────────────────────────────────────────────
  console.log("\nPatching week phases + notes...");

  await upd("WEEK#01", "SET #notes = :n",
    { "#notes": "notes" },
    { ":n": "Settle in; all easy days ≤174 HR. Strides Wed+Sat, hill sprints Sat." });

  await upd("WEEK#04", "SET #notes = :n",
    { "#notes": "notes" },
    { ":n": "MP moves into long runs. Begin race-fuel practice on every long run from this week." });

  await upd("WEEK#05", "SET #notes = :n",
    { "#notes": "notes" },
    { ":n": "★ CHECKPOINT: log HR across the MP blocks. Low-to-mid 170s = on track for sub-3. Pushing 180 = adjust target." });

  await upd("WEEK#07", "SET #phase = :p, #notes = :n",
    { "#phase": "phase", "#notes": "notes" },
    { ":p": "Marathon-specific", ":n": "Peak long-run block begins. Volume peaks — absorb cleanly." });

  await upd("WEEK#08", "SET #phase = :p, #notes = :n",
    { "#phase": "phase", "#notes": "notes" },
    { ":p": "Marathon-specific", ":n": "Biggest week. KEY SESSION: MP on tired legs (Sun long). Full race-fuel rehearsal." });

  await upd("WEEK#10", "SET #phase = :p, #notes = :n",
    { "#phase": "phase", "#notes": "notes" },
    { ":p": "Peak / Sharpen", ":n": "Ease into the tune-up half. MP dress rehearsal — full kit + fuel. TRIAL BICARB. Not all-out. Log HR over the MP block — final fitness read before taper." });

  // ── Sessions ─────────────────────────────────────────────────────────────────
  console.log("\nPatching sessions...");

  // W1 Q1: structure tweak (4:05 not ~4:00)
  await upd("WEEK#01#SES#q1", "SET structure = :s",
    {},
    { ":s": "3×8min @ T (4:05), 2min jog" });

  // W4 Q1: was VO2, should be Threshold
  await upd("WEEK#04#SES#q1",
    "SET #cat = :cat, title = :t, structure = :s, zoneRefs = :z",
    { "#cat": "category" },
    { ":cat": "threshold", ":t": "Threshold 1km reps", ":s": "5×1km @ T (4:00–4:05), 90s jog", ":z": ["E", "T"] });

  // W5 Q1: was Threshold, should be VO2 (the ONE VO2 touch)
  await upd("WEEK#05#SES#q1",
    "SET #cat = :cat, title = :t, structure = :s, zoneRefs = :z",
    { "#cat": "category" },
    { ":cat": "vo2", ":t": "VO2 intervals (one touch)", ":s": "6×3min @ I (3:50), 2min jog", ":z": ["E", "I"] });

  // W8 Q1: add the VO2 alternative option
  await upd("WEEK#08#SES#q1",
    "SET title = :t, structure = :s, zoneRefs = :z",
    {},
    { ":t": "Threshold 2km reps (or VO2 alt)", ":s": "3×2km @ T (or 5×1km @ I), 2min jog", ":z": ["E", "T", "I"] });

  console.log("\n✓ Patch complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
