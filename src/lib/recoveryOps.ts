"use server";

import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME, PLAN_PK } from "./db";
import { planPk } from "./activePlan";
import type { RecoveryReading } from "./types";

export async function getRecovery(
  planId?: string,
  startDate?: string,
  endDate?: string
): Promise<RecoveryReading[]> {
  const pk = planId ? planPk(planId) : PLAN_PK;
  const skStart = startDate ? `RECOVERY#${startDate}` : "RECOVERY#";
  const skEnd = endDate ? `RECOVERY#${endDate}~` : "RECOVERY#~";

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
      ExpressionAttributeValues: { ":pk": pk, ":start": skStart, ":end": skEnd },
    })
  );

  return (result.Items ?? []) as RecoveryReading[];
}

export async function getRecoveryWithHistory(startDate: string, planId?: string): Promise<RecoveryReading[]> {
  const historyStart = new Date(startDate + "T12:00:00");
  historyStart.setDate(historyStart.getDate() - 90);
  return getRecovery(planId, historyStart.toISOString().slice(0, 10));
}

export async function upsertRecovery(
  planId: string,
  reading: Omit<RecoveryReading, "pk" | "sk">
): Promise<void> {
  const pk = planPk(planId);
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { ...reading, pk, sk: `RECOVERY#${reading.date}` },
  }));
}
