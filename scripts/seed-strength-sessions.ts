/**
 * Writes the 16 amsterdam26 strength sessions to DynamoDB.
 * Run: npx tsx --env-file .env.local scripts/seed-strength-sessions.ts
 *
 * Safe to re-run — PutCommand is idempotent (overwrites if sk already exists).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { sessions } from "../src/lib/seedData";

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
  const strength = sessions.filter((s) => s.category === "strength");
  console.log(`Seeding ${strength.length} strength sessions to ${TABLE}…\n`);

  let ok = 0, fail = 0;
  for (const s of strength) {
    try {
      await doc.send(new PutCommand({ TableName: TABLE, Item: s }));
      console.log(`  ✓  ${s.sk}  (${s.date})`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${s.sk}:`, err);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} written, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
