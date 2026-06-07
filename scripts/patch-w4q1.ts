import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

async function main() {
  await doc.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE || "marathonPlan",
    Key: { pk: "PLAN#amsterdam26", sk: "WEEK#04#SES#q1" },
    UpdateExpression: "SET title = :t, structure = :s",
    ExpressionAttributeValues: { ":t": "Threshold intervals", ":s": "4×6min @ T (~3:58), 90s jog" },
  }));
  console.log("✓ W4 Q1 updated");
}

main().catch((e) => { console.error(e); process.exit(1); });
