"use server";

import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME, PLAN_PK } from "./db";
import type { RecoveryReading } from "./types";

export async function getRecovery(
  startDate?: string,
  endDate?: string
): Promise<RecoveryReading[]> {
  const skStart = startDate ? `RECOVERY#${startDate}` : "RECOVERY#";
  const skEnd = endDate ? `RECOVERY#${endDate}~` : "RECOVERY#~"; // ~ sorts after digits

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": PLAN_PK,
        ":start": skStart,
        ":end": skEnd,
      },
    })
  );

  return (result.Items ?? []) as RecoveryReading[];
}

// Returns enough history (90 days before startDate) for baseline computation
export async function getRecoveryWithHistory(startDate: string): Promise<RecoveryReading[]> {
  const historyStart = new Date(startDate + "T12:00:00");
  historyStart.setDate(historyStart.getDate() - 90);
  return getRecovery(historyStart.toISOString().slice(0, 10));
}

export async function upsertRecovery(reading: Omit<RecoveryReading, "pk" | "sk">): Promise<void> {
  const item: RecoveryReading = {
    ...reading,
    pk: PLAN_PK,
    sk: `RECOVERY#${reading.date}`,
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}
