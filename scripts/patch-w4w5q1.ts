import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const TABLE = process.env.DYNAMODB_TABLE || "marathonPlan";
const PK = "PLAN#amsterdam26";

async function main() {
  // Reset W4 Q1 back to 5×1km threshold
  await doc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: PK, sk: "WEEK#04#SES#q1" },
    UpdateExpression: "SET title = :t, structure = :s, #cat = :cat, zoneRefs = :z",
    ExpressionAttributeNames: { "#cat": "category" },
    ExpressionAttributeValues: {
      ":t": "Threshold 1km reps",
      ":s": "5×1km @ T (4:00–4:05), 90s jog",
      ":cat": "threshold",
      ":z": ["E", "T"],
    },
  }));
  console.log("✓ W4 Q1 reset");

  // Update W5 Q1 to 4×6min threshold
  await doc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: PK, sk: "WEEK#05#SES#q1" },
    UpdateExpression: "SET title = :t, structure = :s, #cat = :cat, zoneRefs = :z",
    ExpressionAttributeNames: { "#cat": "category" },
    ExpressionAttributeValues: {
      ":t": "Threshold intervals",
      ":s": "4×6min @ T (~3:58), 90s jog",
      ":cat": "threshold",
      ":z": ["E", "T"],
    },
  }));
  console.log("✓ W5 Q1 updated");
}

main().catch((e) => { console.error(e); process.exit(1); });
