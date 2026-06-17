import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Lap } from "./types";
import { docClient, TABLE_NAME } from "./db";

export const STRAVA_PK = "INTEGRATION#strava";
const TOKEN_SK = "TOKEN";

export interface StravaTokenRecord {
  pk: string;
  sk: string;
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  lastSyncEpoch?: number;
}

export interface StravaUnmatched {
  pk: string;
  sk: string;
  activityId: number;
  activityName: string;
  date: string;
  sportType: string;
  distanceKm: number;
  durationMin: number;
  avgHr?: number;
  avgPacePerKm?: string;
  stravaUrl: string;
  candidateSessions: Array<{
    planId: string;
    sk: string;
    date: string;
    category: string;
    title: string;
  }>;
  importedAt: string;
  // Set when lap count ≠ prescribed — user must confirm before committing
  lapMismatch?: boolean;
  pendingLaps?: Lap[];
  prescribedRepCount?: number;
}

export async function getTokenRecord(): Promise<StravaTokenRecord | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk: STRAVA_PK, sk: TOKEN_SK } })
  );
  return result.Item ? (result.Item as StravaTokenRecord) : null;
}

export async function saveTokenRecord(
  fields: Pick<StravaTokenRecord, "access_token" | "refresh_token" | "expires_at"> &
    Partial<Pick<StravaTokenRecord, "lastSyncEpoch">>
): Promise<void> {
  const existing = await getTokenRecord();
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...(existing ?? {}),
        pk: STRAVA_PK,
        sk: TOKEN_SK,
        ...fields,
      },
    })
  );
}

// Bootstrap from env var tokens only when no DynamoDB record exists yet.
// Once any token is stored (including via OAuth callback), this is a no-op.
async function ensureBootstrapped(): Promise<void> {
  const existing = await getTokenRecord();
  if (existing) return;

  const envRefreshToken = process.env.STRAVA_REFRESH_TOKEN;
  if (!envRefreshToken) return;

  const accessToken = process.env.STRAVA_ACCESS_TOKEN;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: STRAVA_PK,
        sk: TOKEN_SK,
        access_token: accessToken ?? "",
        refresh_token: envRefreshToken,
        expires_at: 0, // force immediate refresh
        lastSyncEpoch: 0,
      },
    })
  );
}

export async function getValidAccessToken(): Promise<string> {
  await ensureBootstrapped();
  const token = await getTokenRecord();
  if (!token) throw new Error("Strava not connected");

  const nowEpoch = Math.floor(Date.now() / 1000);
  if (nowEpoch < token.expires_at - 60) {
    return token.access_token;
  }

  // Token expired — refresh
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  await saveTokenRecord({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    lastSyncEpoch: token.lastSyncEpoch,
  });

  return data.access_token;
}

export async function stravaFetch<T = unknown>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const accessToken = await getValidAccessToken();
  const url = new URL(`https://www.strava.com/api/v3${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Strava token invalid or missing activity:read_all scope — use Reconnect");
    }
    throw new Error(`Strava API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function updateLastSyncEpoch(epoch: number): Promise<void> {
  const token = await getTokenRecord();
  if (!token) return;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...token, lastSyncEpoch: epoch },
    })
  );
}

export async function listUnmatched(): Promise<StravaUnmatched[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :pfx)",
      ExpressionAttributeValues: {
        ":pk": STRAVA_PK,
        ":pfx": "UNMATCHED#",
      },
    })
  );
  return (result.Items ?? []) as StravaUnmatched[];
}

export async function deleteUnmatched(activityId: number): Promise<void> {
  const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: STRAVA_PK, sk: `UNMATCHED#${activityId}` },
    })
  );
}

export async function isStravaConnected(): Promise<boolean> {
  const token = await getTokenRecord();
  return !!token?.refresh_token;
}
