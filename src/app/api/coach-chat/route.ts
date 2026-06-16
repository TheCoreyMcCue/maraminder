import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "@/lib/db";
import { planPk } from "@/lib/activePlan";

export const dynamic = "force-dynamic";

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an evidence-based endurance running coach embedded in Corey's training app, Maraminder.
Your job: help him decide how to approach his upcoming session, given how he feels today and how
his recovery compares to what's scheduled. Discuss one session at a time and adapt to his input.

WHO YOU'RE COACHING
- A data-driven, fast-improving runner. Primary goal: sub-3:00 Amsterdam Marathon (4:16/km), with
  durability — holding marathon pace deep into long runs — as the limiting variable, not top speed.
  He also races triathlon (developing cyclist, novice swimmer; the run is his weapon).
- He is direct and dislikes hedging, nagging, and repeated caveats. Give the real read: acknowledge
  real wins fully AND give honest critique — both, never one buried in the other.

READING RECOVERY (apply these rules to the numbers in CONTEXT)
- Baseline-relative, not absolute. Compare HRV/RHR to his personalBaseline mean +/- SD.
- RHR has two flavours: an overnight low (~46-48, his robust recovered marker) and an all-day
  average (~53). Compare like with like; don't raise a false alarm by mixing them.
- Trends beat single readings. HRV is noisy day to day; RHR and sleep are steadier.
- Concordance is the signal: HRV-high + RHR-low + feeling fine = recovered. A high HRV sitting next
  to an ELEVATED RHR and a blunted overnight dip is discordant — a caution flag (body absorbing load
  or fighting something), NOT licence to train hard. High HRV alone is never automatically "go harder."
- Taper leg-heaviness and flatness are normal; judge by objective trend, not feel alone.

DECIDING THE SESSION (the core job)
- Weigh his feel + objective recovery against what's scheduled, then recommend clearly: proceed /
  soften / swap to easy / rest. Give a one-line reason grounded in the actual numbers in CONTEXT.
- High life-stress -> trade intensity for easy rather than forcing the hard session.
- Warmup and feel are the final arbiter on a quality day — if metrics are ambiguous, tell him to
  let the warmup decide.
- Protect specificity: marathon-pace work and long runs are where sub-3 is won; don't trade them
  away for freshness.

ILLNESS (health-adjacent — be cautious)
- Neck check: above-the-neck only (scratchy throat, sniffles) -> easy training is fine. Below the
  neck — chest, body aches, fever, systemic — -> STOP hard efforts and rest (viral myocarditis risk
  with intensity). In a taper, easy or rest costs nothing.
- Strides (~15-20s) are neuromuscular, not metabolic intensity — fine even on an easy or lightly
  compromised day.
- On worsening illness, sharp/localised/gait-altering pain, or anything you can't assess: advise
  rest and a professional. Never push him through it.

INTERPRETING TRAINING DATA
- Footwear matters: super-shoes run ~6-10s/km faster than trainers for the same effort. Account for
  the shoe when comparing paces; across mixed footwear, HR/effort is the honest through-line.
- Fueling: well-trained gut; steady drip-feeding beats front-loading. Watch for a recurring
  epigastric stitch at the start of hard efforts — likely meal timing and/or forced breathing.

HARD RULES
- Use ONLY the data in CONTEXT. If a number you need isn't there, say so — never invent an HRV, pace,
  or HR you weren't given. Verify any arithmetic before stating it.
- Be concise and direct. Lead with the answer. No filler, no repeated disclaimers.
- Do not encourage overtraining or training through real illness or injury, however keen he is.
- You are a coach, not a doctor — for medical concerns, point him to a professional.`;

// ── Types ─────────────────────────────────────────────────────────────────────

type RawItem = Record<string, unknown>;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Context assembly ──────────────────────────────────────────────────────────

async function assembleContext(planId: string, today: string, focusDate: string) {
  const [planItems, baselineResult] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": planPk(planId) },
    })).then((r) => (r.Items ?? []) as RawItem[]),
    docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: "USER#default", sk: "RECOVERY_BASELINE" },
    })),
  ]);

  let meta: RawItem | null = null;
  const zones: RawItem[] = [];
  const weeks: RawItem[] = [];
  const sessions: RawItem[] = [];
  const recoveryItems: RawItem[] = [];

  for (const item of planItems) {
    const sk = item.sk as string;
    if (sk === "META") meta = item;
    else if (sk.startsWith("ZONES#")) zones.push(item);
    else if (/^WEEK#\d+$/.test(sk)) weeks.push(item);
    else if (/^WEEK#\d+#SES#/.test(sk)) sessions.push(item);
    else if (sk.startsWith("RECOVERY#")) recoveryItems.push(item);
  }

  // Current zone version
  const currentVersion = meta?.currentZoneVersion as number | undefined;
  const currentZone = zones.find((z) => z.version === currentVersion) ?? zones[zones.length - 1];

  // Current week (based on focusDate)
  const currentWeek = weeks.find(
    (w) => (w.dateStart as string) <= focusDate && focusDate <= (w.dateEnd as string)
  );

  // Upcoming sessions: focusDate + next 2 days
  const upcomingDates = [0, 1, 2].map((n) => {
    const d = new Date(focusDate + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  });
  const upcomingSessions = sessions
    .filter((s) => upcomingDates.includes(s.date as string))
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))
    .map((s) => ({
      date: s.date,
      dayOfWeek: s.dayOfWeek,
      category: s.category,
      title: s.title,
      status: s.status,
      target: {
        km: s.targetDistanceKm ?? null,
        min: s.targetDurationMin ?? null,
        structure: s.structure ?? null,
        zoneRefs: s.zoneRefs ?? [],
      },
    }));

  // Recent completed sessions: last 10 before today
  const recentCompleted = sessions
    .filter((s) => s.status === "done" && (s.date as string) <= today)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string))
    .slice(0, 10)
    .map((s) => {
      const actual = s.actual as RawItem | null;
      return {
        date: s.date,
        dayOfWeek: s.dayOfWeek,
        category: s.category,
        title: s.title,
        target: {
          km: s.targetDistanceKm ?? null,
          min: s.targetDurationMin ?? null,
        },
        actual: actual
          ? {
              km: actual.distanceKm ?? null,
              min: actual.durationMin ?? null,
              pace: actual.avgPacePerKm ?? null,
              hr: actual.avgHr ?? null,
              rpe: actual.rpe ?? null,
              notes: actual.notes ?? null,
            }
          : null,
      };
    });

  // Recent recovery: last 14 days up to and including today
  const cutoffDate = new Date(today + "T12:00:00");
  cutoffDate.setDate(cutoffDate.getDate() - 14);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  const recentRecovery = recoveryItems
    .filter((r) => (r.date as string) >= cutoff && (r.date as string) <= today)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string))
    .map((r) => ({
      date: r.date,
      hrv: r.hrvMs ?? null,
      rhr: r.rhrBpm ?? null,
      sleep: r.sleepHours ?? null,
      sleepScore: r.sleepScore ?? null,
      lifeStress: r.lifeStress ?? null,
      legFatigue: r.legFatigue ?? null,
      note: r.note ?? null,
    }));

  const bl = baselineResult.Item as RawItem | undefined;

  return {
    today,
    focusDate,
    planId,
    personalBaseline: bl
      ? {
          hrv: bl.hrv,
          rhr: bl.rhr,
          sleepTargetHours: bl.sleepTargetHours,
          ftpW: bl.ftpW,
        }
      : null,
    currentZone: currentZone
      ? { version: currentZone.version, zones: currentZone.zones }
      : null,
    currentWeek: currentWeek
      ? {
          weekNo: currentWeek.weekNo,
          phase: currentWeek.phase,
          volumeTargetKm: currentWeek.volumeTargetKm,
          notes: currentWeek.notes ?? null,
        }
      : null,
    upcomingSessions,
    recentCompleted,
    recentRecovery,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: {
    message: string;
    history?: ChatMessage[];
    focusDate?: string;
    planId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history = [], focusDate, planId = "amsterdam26" } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const resolvedFocusDate = focusDate ?? today;

  let context: Awaited<ReturnType<typeof assembleContext>>;
  try {
    context = await assembleContext(planId, today, resolvedFocusDate);
  } catch (err) {
    console.error("[coach-chat] context assembly failed:", err);
    return NextResponse.json(
      { error: "Failed to load training data" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const client = new Anthropic({ apiKey });
  const systemWithContext =
    SYSTEM_PROMPT + "\n\nCONTEXT:\n" + JSON.stringify(context, null, 2);

  // Cap history to last 20 messages to stay within token budget
  const trimmedHistory = history.slice(-20);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemWithContext,
      messages: [
        ...trimmedHistory,
        { role: "user", content: message },
      ],
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(
      { reply },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[coach-chat] Anthropic API error:", err);
    return NextResponse.json(
      { error: "Coach unavailable — try again" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
