export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import { getRecoveryWithHistory } from "@/lib/recoveryOps";
import { enrichDay } from "@/lib/recovery";
import { getActivePlanId } from "@/lib/activePlan";
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

  const allRecovery = await getRecoveryWithHistory(week.dateStart, planId);
  const recoveryDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week.dateStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return enrichDay(allRecovery, d.toISOString().slice(0, 10));
  });

  const today = new Date().toISOString().slice(0, 10);

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
    />
  );
}
