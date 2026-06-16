import { NextRequest, NextResponse } from "next/server";
import { saveTokenRecord } from "@/lib/strava";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://maraminder.vercel.app";
    return NextResponse.redirect(`${baseUrl}/?strava=denied`);
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Strava credentials not configured" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://maraminder.vercel.app";
  const redirectUri = `${baseUrl}/api/strava/callback`;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[strava/callback] token exchange failed:", res.status, text);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  // Don't pass lastSyncEpoch — saveTokenRecord preserves the existing value via spread,
  // so reconnecting doesn't reset sync progress. Fresh connects get the sync route's default.
  await saveTokenRecord({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });

  return NextResponse.redirect(`${baseUrl}/?strava=connected`);
}
