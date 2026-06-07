import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { planMeta, zonesV1, weeks, sessions } from "../src/lib/seedData";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        }
      : undefined,
  ...(process.env.DYNAMODB_ENDPOINT
    ? { endpoint: process.env.DYNAMODB_ENDPOINT }
    : {}),
});

const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = process.env.DYNAMODB_TABLE || "marathonPlan";

async function batchWrite(items: object[]) {
  // DynamoDB batch write limit is 25 items
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: chunk.map((item) => ({ PutRequest: { Item: item } })),
        },
      })
    );
    console.log(`  wrote ${i + chunk.length}/${items.length}`);
  }
}

async function main() {
  console.log(`Seeding table: ${TABLE}`);

  console.log("Writing plan META...");
  await doc.send(new PutCommand({ TableName: TABLE, Item: planMeta }));

  console.log("Writing zone set v1...");
  await doc.send(new PutCommand({ TableName: TABLE, Item: zonesV1 }));

  console.log("Writing weeks...");
  await batchWrite(weeks);

  console.log("Writing sessions...");
  await batchWrite(sessions);

  console.log("✓ Seed complete.");
  console.log(`  ${weeks.length} weeks, ${sessions.length} sessions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
