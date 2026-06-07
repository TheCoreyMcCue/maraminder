export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import Link from "next/link";
import type { Week, Session } from "@/lib/types";

const PHASE_COLORS: Record<string, string> = {
  "Base / Reload": "#22c55e",
  "Marathon-specific": "#3b82f6",
  "Down Week": "#6b7280",
  "Peak block": "#8b5cf6",
  "Peak (biggest)": "#8b5cf6",
  "Peak / Sharpen": "#8b5cf6",
  "Tune-up": "#f59e0b",
  "Taper": "#06b6d4",
  "Race Week": "#f97316",
};

export default async function OverviewPage() {
  const plan = await getPlan();
  const today = new Date().toISOString().slice(0, 10);

  const sessionsByWeek: Record<number, Session[]> = {};
  for (const s of plan.sessions) {
    if (!sessionsByWeek[s.weekNo]) sessionsByWeek[s.weekNo] = [];
    sessionsByWeek[s.weekNo].push(s);
  }

  const daysToRace = Math.ceil(
    (new Date(plan.meta.raceDate).getTime() - Date.now()) / 86_400_000
  );

  return (
    <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Season Overview</h1>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          13 weeks · Goal {plan.meta.goalTime} · {daysToRace > 0 ? `${daysToRace} days to race` : "Race complete"}
        </span>
      </div>

      {/* Race pins */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <PinCard label="Half Marathon" date={plan.meta.halfDate} icon="🏃" color="#f59e0b" />
        <PinCard label="Amsterdam Marathon" date={plan.meta.raceDate} icon="🏁" color="#f97316" />
      </div>

      {/* Week rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {plan.weeks.map((week) => {
          const wSessions = sessionsByWeek[week.weekNo] || [];
          const done = wSessions.filter((s) => s.status === "done").length;
          const total = wSessions.filter((s) => s.status !== "skipped").length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const actualKm = wSessions
            .filter((s) => s.actual?.distanceKm)
            .reduce((sum, s) => sum + (s.actual!.distanceKm || 0), 0);

          const isCurrent = week.dateStart <= today && week.dateEnd >= today;
          const isPast = week.dateEnd < today;
          const phaseColor = PHASE_COLORS[week.phase] || "#888";

          return (
            <Link key={week.weekNo} href={`/week/${week.weekNo}`}>
              <div
                style={{
                  background: isCurrent ? "var(--surface-2)" : "var(--surface)",
                  border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`,
                  borderLeft: `3px solid ${phaseColor}`,
                  borderRadius: 8,
                  padding: "10px 16px",
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 100px 120px 80px",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  opacity: isPast && pct === 0 ? 0.6 : 1,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  W{week.weekNo}
                  {isCurrent && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)" }}>NOW</span>}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: phaseColor }}>
                    {week.phase}
                    {week.isDownWeek && <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>↓ DOWN</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {formatDateShort(week.dateStart)} – {formatDateShort(week.dateEnd)}
                  </div>
                </div>

                {/* Volume bar */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                    {actualKm > 0 ? actualKm.toFixed(0) : "—"}/{week.volumeTargetKm}km
                  </div>
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, actualKm > 0 ? (actualKm / week.volumeTargetKm) * 100 : 0)}%`,
                      background: phaseColor,
                      borderRadius: 2,
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>

                {/* Completion */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                    {done}/{total} sessions
                  </div>
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct === 100 ? "#22c55e" : "var(--accent)",
                      borderRadius: 2,
                    }} />
                  </div>
                </div>

                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: pct === 100 ? "#22c55e" : isPast ? "#f59e0b" : "var(--text-muted)",
                  textAlign: "right",
                }}>
                  {pct === 100 ? "✓ Done" : isPast && pct < 100 ? `${pct}%` : "→"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PinCard({ label, date, icon, color }: { label: string; date: string; icon: string; color: string }) {
  const d = new Date(date + "T12:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return (
    <div style={{
      background: color + "11",
      border: `1px solid ${color}44`,
      borderRadius: 8,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {d.getDate()} {months[d.getMonth()]} {d.getFullYear()}
        </div>
        {days > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{days} days away</div>}
      </div>
    </div>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
