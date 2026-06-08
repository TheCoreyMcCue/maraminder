import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { bridgeMeta, bridgeZonesV1, bridgeWeeks, bridgeSessions } from "../src/lib/bridgeSeedData";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, sessionToken: process.env.AWS_SESSION_TOKEN }
    : undefined,
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
});

const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
const TABLE = process.env.DYNAMODB_TABLE || "marathonPlan";

async function batchWrite(items: object[]) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await doc.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: chunk.map((item) => ({ PutRequest: { Item: item } })) },
    }));
    console.log(`  wrote ${i + chunk.length}/${items.length}`);
  }
}

async function main() {
  console.log(`Seeding bridge plan → table: ${TABLE}`);
  await doc.send(new PutCommand({ TableName: TABLE, Item: bridgeMeta }));
  console.log("✓ META");
  await doc.send(new PutCommand({ TableName: TABLE, Item: bridgeZonesV1 }));
  console.log("✓ ZONES#1");
  console.log("Writing weeks...");
  await batchWrite(bridgeWeeks);
  console.log("Writing sessions...");
  await batchWrite(bridgeSessions);
  console.log(`\n✓ Bridge seed complete — ${bridgeWeeks.length} weeks, ${bridgeSessions.length} sessions`);
}

main().catch((e) => { console.error(e); process.exit(1); });
