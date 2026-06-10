export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import { getActivePlanId } from "@/lib/activePlan";
import { getPersonalBaseline } from "@/lib/baselineOps";
import ZonesClient from "./ZonesClient";

export default async function ZonesPage() {
  const planId = await getActivePlanId();
  const [plan, baseline] = await Promise.all([getPlan(planId), getPersonalBaseline()]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ZonesClient
      planId={planId}
      baseline={baseline}
      currentZones={plan.currentZones}
      allZones={plan.allZones}
      currentWeekNo={plan.weeks.find((w) => w.dateStart <= today && w.dateEnd >= today)?.weekNo ?? 1}
    />
  );
}
