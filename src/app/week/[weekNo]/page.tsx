export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import { getRecoveryWithHistory } from "@/lib/recoveryOps";
import { enrichDay } from "@/lib/recovery";
import { getActivePlanId } from "@/lib/activePlan";
import { getPersonalBaseline } from "@/lib/baselineOps";
import { getDailyLoadRec } from "@/lib/loadRecommendation";
import { computeLoadFactor } from "@/lib/loadFactor";
import WeekView from "@/components/WeekView";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ weekNo: string }>;
}

export default async function WeekPage({ params }: Props) {
  const { weekNo: weekNoStr } = await params;
  const weekNo = parseInt(weekNoStr);
  if (isNaN(weekNo) || weekNo < 1 || weekNo > 99) return notFound();

  const planId = await getActivePlanId();
  const plan = await getPlan(planId);
  const week = plan.weeks.find((w) => w.weekNo === weekNo);
  if (!week) return notFound();

  const weekSessions = plan.sessions
    .filter((s) => s.weekNo === weekNo)
    .sort((a, b) => a.order - b.order);

  const today = new Date().toISOString().slice(0, 10);
  const isCurrentWeek = week.dateStart <= today && week.dateEnd >= today;

  const [allRecovery, baseline] = await Promise.all([
    getRecoveryWithHistory(week.dateStart, planId),
    getPersonalBaseline(),
  ]);

  const recoveryDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week.dateStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return enrichDay(allRecovery, d.toISOString().slice(0, 10));
  });

  // Only compute daily readout when viewing the current week
  const dailyRec = isCurrentWeek ? (() => {
    const todayRecovery = allRecovery.find((r) => r.date === today) ?? null;
    const todaySessions = weekSessions.filter((s) => s.date === today);
    const recent3 = allRecovery
      .filter((r) => r.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    return getDailyLoadRec(todayRecovery, baseline, todaySessions, recent3);
  })() : undefined;

  const loadFactor = isCurrentWeek
    ? computeLoadFactor(today, plan.sessions, allRecovery, baseline)
    : undefined;

  return (
    <WeekView
      week={week}
      sessions={weekSessions}
      zones={plan.currentZones}
      allWeeks={plan.weeks}
      meta={plan.meta}
      recoveryDays={recoveryDays}
      today={today}
      planId={planId}
      dailyRec={dailyRec}
      loadFactor={loadFactor}
      baseline={isCurrentWeek ? baseline : undefined}
    />
  );
}
