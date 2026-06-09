"use server";

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./db";
import type { PersonalBaseline } from "./types";

const BASELINE_PK = "USER#default";
const BASELINE_SK = "RECOVERY_BASELINE";

const DEFAULT_BASELINE: PersonalBaseline = {
  pk: BASELINE_PK,
  sk: BASELINE_SK,
  hrv:  { mean: 67, sd: 10 },
  rhr:  { mean: 53, sd: 3  },
  sleepTargetHours: 7.5,
  note: "Field estimate — HRV ±10ms, RHR ±3bpm based on 2yr averages",
};

export async function getPersonalBaseline(): Promise<PersonalBaseline> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk: BASELINE_PK, sk: BASELINE_SK } })
  );
  return result.Item ? (result.Item as PersonalBaseline) : DEFAULT_BASELINE;
}

export async function savePersonalBaseline(
  baseline: Pick<PersonalBaseline, "hrv" | "rhr" | "sleepTargetHours" | "note">
): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { pk: BASELINE_PK, sk: BASELINE_SK, ...baseline },
  }));
}
