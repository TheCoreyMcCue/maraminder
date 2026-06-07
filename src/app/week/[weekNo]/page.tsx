export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import WeekView from "@/components/WeekView";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ weekNo: string }>;
}

export default async function WeekPage({ params }: Props) {
  const { weekNo: weekNoStr } = await params;
  const weekNo = parseInt(weekNoStr);
  if (isNaN(weekNo) || weekNo < 1 || weekNo > 13) return notFound();

  const plan = await getPlan();
  const week = plan.weeks.find((w) => w.weekNo === weekNo);
  if (!week) return notFound();

  const weekSessions = plan.sessions
    .filter((s) => s.weekNo === weekNo)
    .sort((a, b) => a.order - b.order);

  return (
    <WeekView
      week={week}
      sessions={weekSessions}
      zones={plan.currentZones}
      allWeeks={plan.weeks}
      meta={plan.meta}
    />
  );
}
