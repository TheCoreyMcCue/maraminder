import { NextRequest, NextResponse } from "next/server";
import { upsertRecovery, getRecovery } from "@/lib/recoveryOps";

const SECRET = process.env.RECOVERY_SECRET;

function checkSecret(req: NextRequest): boolean {
  if (!SECRET) return true; // secret not set → open (local dev)
  return req.headers.get("x-recovery-secret") === SECRET;
}

// iOS Shortcuts / automation POST
export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const date = body.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
  }

  const planId = (body.plan as string | undefined) ?? "amsterdam26";

  await upsertRecovery(planId, {
    date,
    hrvMs:      num(body.hrvMs),
    rhrBpm:     num(body.rhrBpm),
    sleepHours: num(body.sleepHours),
    sleepScore: num(body.sleepScore),
    lifeStress: num(body.lifeStress),
    legFatigue: num(body.legFatigue),
    source: (body.source as "shortcuts" | "manual" | "export-tool") ?? "shortcuts",
    note: (body.note as string | undefined) || undefined,
  });

  return NextResponse.json({ ok: true, date });
}

// Full history export (for debugging / backup)
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const planId = req.nextUrl.searchParams.get("plan") ?? "amsterdam26";
  const readings = await getRecovery(planId);
  return NextResponse.json(readings);
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(v as string);
  return isFinite(n) ? n : undefined;
}
