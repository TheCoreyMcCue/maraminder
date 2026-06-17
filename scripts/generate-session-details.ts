/**
 * Writes targetDetail markdown for every amsterdam26 session to DynamoDB.
 * Run: npx tsx --env-file .env.local scripts/generate-session-details.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { sessions } from "../src/lib/seedData";
import { generateTargetDetail } from "../src/lib/sessionDetailGen";

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
const doc   = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
const TABLE = process.env.DYNAMODB_TABLE || "maraplan";

async function main() {
  console.log(`Writing targetDetail for ${sessions.length} sessions…\n`);

  let ok = 0;
  for (const s of sessions) {
    const detail = generateTargetDetail(s);
    await doc.send(new UpdateCommand({
      TableName: TABLE,
      Key:  { pk: "PLAN#amsterdam26", sk: s.sk },
      UpdateExpression: "SET #td = :td",
      ExpressionAttributeNames:  { "#td": "targetDetail" },
      ExpressionAttributeValues: { ":td": detail },
    }));
    ok++;
    if (ok % 10 === 0) process.stdout.write(`  ${ok}/${sessions.length}\n`);
  }
  console.log(`\nDone — ${ok} sessions updated.`);

  // Spot-check
  console.log("\n── Spot checks ──────────────────────────────────────────────────────────");
  const checks = [
    sessions.find((s) => s.sk === "WEEK#04#SES#q1"),
    sessions.find((s) => s.sk === "WEEK#08#SES#long"),
    sessions.find((s) => s.sk === "WEEK#02#SES#easy1"),
  ];
  for (const s of checks) {
    if (!s) continue;
    const detail = generateTargetDetail(s);
    console.log(`\n${s.sk} [${s.category}] ${s.targetDistanceKm}km`);
    console.log(`  ${s.structure}`);
    console.log(`  → ${detail.split("\n")[0]}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
