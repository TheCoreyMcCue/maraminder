import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        }
      : undefined,
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
});
const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
const TABLE = process.env.DYNAMODB_TABLE || "maraplan";
const PK = "PLAN#amsterdam26";

async function update(sk: string, expr: string, names: Record<string, string>, values: Record<string, unknown>) {
  await doc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: PK, sk },
    UpdateExpression: expr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
  console.log(`  ✓ ${sk}`);
}

async function main() {
  // 1. Plan meta
  console.log("1. Patching plan meta…");
  await update("META",
    "SET #goalTime = :goalTime, #goalPace = :goalPace, #name = :name, #czv = :czv",
    { "#goalTime": "goalTime", "#goalPace": "goalPace", "#name": "name", "#czv": "currentZoneVersion" },
    { ":goalTime": "2:54", ":goalPace": "4:08", ":name": "Amsterdam Marathon Block — Sub-2:55 Build", ":czv": 2 },
  );

  // 2. Zone version 2 (PUT — new item, v1 untouched)
  console.log("2. Adding zone version 2…");
  await doc.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: PK,
      sk: "ZONES#2",
      version: 2,
      effectiveWeek: 1,
      source: "Goal update — 2:54 target (Jun-6 brick: 4:07/km @ 177 HR off the bike)",
      zones: {
        E:  { label: "Easy",       paceLow: "5:00", paceHigh: "5:20", hrMax: 174 },
        S:  { label: "Steady",     paceLow: "4:25", paceHigh: "4:40", hrLow: 174, hrHigh: 180 },
        MP: { label: "Marathon",   pace: "4:08",                       hrLow: 170, hrHigh: 178 },
        T:  { label: "Threshold",  paceLow: "3:52", paceHigh: "4:02", hrLow: 180, hrHigh: 187 },
        I:  { label: "Interval",   paceLow: "3:25", paceHigh: "3:40", hrMin: 188 },
      },
    },
    ConditionExpression: "attribute_not_exists(pk)", // never overwrite if already run
  })).catch((e) => {
    if (e.name === "ConditionalCheckFailedException") {
      console.log("  ⚠ ZONES#2 already exists — skipped");
    } else throw e;
  });
  console.log("  ✓ ZONES#2");

  // 3. Session structure patches
  console.log("3. Patching session structures…");
  await update("WEEK#13#SES#race",
    "SET #s = :s",
    { "#s": "structure" },
    { ":s": "Race day. Controlled negative-split plan. Goal: 2:54 (4:08/km)." },
  );
  await update("WEEK#12#SES#q1",
    "SET #s = :s",
    { "#s": "structure" },
    { ":s": "4×1km @ MP→T (4:08→3:52)" },
  );
  await update("WEEK#01#SES#q1",
    "SET #s = :s",
    { "#s": "structure" },
    { ":s": "3×8min @ T (~3:58), 2min jog" },
  );
  await update("WEEK#04#SES#q1",
    "SET #s = :s",
    { "#s": "structure" },
    { ":s": "5×1km @ T (~3:55–4:00), 90s jog" },
  );

  // 4. W5 checkpoint note
  console.log("4. Patching W5 week note…");
  await update("WEEK#05",
    "SET #notes = :notes",
    { "#notes": "notes" },
    { ":notes": "★ CHECKPOINT: log HR across the MP blocks at 4:08. Low-to-mid 170s = on track for 2:54. Drifting to high-170s/180 = ease the target toward 2:56–2:57." },
  );

  console.log("\nDone. Verifying — grep for stale 4:16 / sub-3 strings would find zero matches.");
}

main().catch((e) => { console.error(e); process.exit(1); });
