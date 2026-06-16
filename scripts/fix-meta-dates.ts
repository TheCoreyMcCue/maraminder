import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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
  ...(process.env.DYNAMODB_ENDPOINT
    ? { endpoint: process.env.DYNAMODB_ENDPOINT }
    : {}),
});

const doc = DynamoDBDocumentClient.from(client);
const TABLE = process.env.DYNAMODB_TABLE || "maraplan";

async function main() {
  await doc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: "PLAN#amsterdam26", sk: "META" },
    UpdateExpression: "REMOVE #triDate",
    ExpressionAttributeNames: {
      "#triDate": "triDate",
    },
  }));
  console.log("Removed triDate from amsterdam26 META");
}

main().catch((e) => { console.error(e); process.exit(1); });
