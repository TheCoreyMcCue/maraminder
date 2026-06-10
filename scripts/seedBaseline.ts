import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const doc = DynamoDBDocumentClient.from(client);
const TABLE = process.env.DYNAMODB_TABLE || "marathonPlan";

async function main() {
  await doc.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: "USER#default",
      sk: "RECOVERY_BASELINE",
      hrv:  { mean: 67, sd: 10 },
      rhr:  { mean: 53, sd: 3  },
      sleepTargetHours: 7.5,
      typicalWeeklyHours: 8,
      note: "Field estimate — HRV ±10ms, RHR ±3bpm based on 2yr averages",
    },
  }));
  console.log("✓ Personal baseline seeded (HRV 67±10, RHR 53±3, sleep 7.5h, 8h/week training)");
}

main().catch((e) => { console.error(e); process.exit(1); });
