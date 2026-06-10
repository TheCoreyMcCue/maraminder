export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import { getRecoveryWithHistory } from "@/lib/recoveryOps";
import { enrichDay } from "@/lib/recovery";
import { getActivePlanId } from "@/lib/activePlan";
import { getPersonalBaseline } from "@/lib/baselineOps";
import { getDailyLoadRec } from "@/lib/loadRecommendation";
import { computeLoadFactor } from "@/lib/loadFactor";
import WeekView from "@/components/WeekView";

export default async function Home() {
  const planId = await getActivePlanId();
  let plan;
  try {
    plan = await getPlan(planId);
  } catch {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ color: "var(--text-muted)", marginBottom: 12 }}>No plan data found</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Run <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4 }}>npm run seed</code> to load the plan.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentWeek =
    plan.weeks.find((w) => w.dateStart <= today && w.dateEnd >= today) ||
    plan.weeks.find((w) => w.dateStart > today) ||
    plan.weeks[0];

  const weekSessions = plan.sessions
    .filter((s) => s.weekNo === currentWeek.weekNo)
    .sort((a, b) => a.order - b.order);

  const [allRecovery, baseline] = await Promise.all([
    getRecoveryWithHistory(currentWeek.dateStart, planId),
    getPersonalBaseline(),
  ]);

  const recoveryDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek.dateStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return enrichDay(allRecovery, d.toISOString().slice(0, 10));
  });

  // Daily readout for today
  const todayRecovery = allRecovery.find((r) => r.date === today) ?? null;
  const todaySessions = weekSessions.filter((s) => s.date === today);
  const recent3 = allRecovery
    .filter((r) => r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const dailyRec = getDailyLoadRec(todayRecovery, baseline, todaySessions, recent3);
  const loadFactor = computeLoadFactor(today, plan.sessions, allRecovery, baseline);

  return (
    <WeekView
      week={currentWeek}
      sessions={weekSessions}
      zones={plan.currentZones}
      allWeeks={plan.weeks}
      meta={plan.meta}
      recoveryDays={recoveryDays}
      today={today}
      planId={planId}
      dailyRec={dailyRec}
      loadFactor={loadFactor}
      baseline={baseline}
      ftpW={baseline.ftpW}
    />
  );
}
