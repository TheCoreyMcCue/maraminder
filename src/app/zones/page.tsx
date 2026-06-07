export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import ZonesClient from "./ZonesClient";

export default async function ZonesPage() {
  const plan = await getPlan();
  return (
    <ZonesClient
      currentZones={plan.currentZones}
      allZones={plan.allZones}
      currentWeekNo={
        plan.weeks.find((w) => {
          const today = new Date().toISOString().slice(0, 10);
          return w.dateStart <= today && w.dateEnd >= today;
        })?.weekNo ?? 1
      }
    />
  );
}
