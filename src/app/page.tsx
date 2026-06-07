export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import WeekView from "@/components/WeekView";

export default async function Home() {
  let plan;
  try {
    plan = await getPlan();
  } catch {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ color: "var(--text-muted)", marginBottom: 12 }}>No plan data found</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Run{" "}
          <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4 }}>
            npm run seed
          </code>{" "}
          to load the plan into DynamoDB.
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

  return (
    <WeekView
      week={currentWeek}
      sessions={weekSessions}
      zones={plan.currentZones}
      allWeeks={plan.weeks}
      meta={plan.meta}
    />
  );
}
