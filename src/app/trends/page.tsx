export const dynamic = "force-dynamic";
import { getTrends } from "@/lib/planOps";

export default async function TrendsPage() {
  const trends = await getTrends();

  return (
    <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Trends</h1>

      {/* Weekly volume */}
      <Section title="Weekly Volume vs Target">
        {trends.weeklyVolume.every((w) => w.actualKm === 0) ? (
          <EmptyState msg="No logged sessions yet — start logging your runs." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trends.weeklyVolume.map((w) => {
              const pct = w.targetKm > 0 ? (w.actualKm / w.targetKm) * 100 : 0;
              const over = pct > 110;
              return (
                <div key={w.weekNo} style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>W{w.weekNo}</span>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 4, position: "relative" }}>
                    {/* Target line */}
                    <div style={{ position: "absolute", right: 0, top: -2, width: 1, height: 12, background: "var(--text-muted)", opacity: 0.5 }} />
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, pct)}%`,
                      background: over ? "#ef4444" : w.actualKm > 0 ? "#22c55e" : "var(--border)",
                      borderRadius: 4,
                      transition: "width 0.3s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: over ? "#ef4444" : w.actualKm > 0 ? "var(--text)" : "var(--text-muted)" }}>
                    {w.actualKm > 0 ? `${w.actualKm.toFixed(0)}/${w.targetKm}km` : `—/${w.targetKm}km`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* MP HR over time */}
      <Section title="MP Heart Rate Over Time">
        {trends.mpHrHistory.length === 0 ? (
          <EmptyState msg="Log sessions with HR data from MP-zone workouts to see trend." />
        ) : (
          <TrendTable
            rows={trends.mpHrHistory.map((r) => ({
              label: `W${r.weekNo} · ${r.date}`,
              value: `${r.avgHr} bpm`,
              raw: r.avgHr,
            }))}
            min={140}
            max={200}
            color="#3b82f6"
          />
        )}
      </Section>

      {/* Easy pace @ HR */}
      <Section title="Easy Pace History">
        {trends.easyPaceHistory.length === 0 ? (
          <EmptyState msg="Log easy runs with pace data to see trend." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trends.easyPaceHistory.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>W{r.weekNo} · {r.date}</span>
                <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>{r.pace}/km</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 20,
      marginBottom: 20,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg}</p>;
}

function TrendTable({ rows, min, max, color }: {
  rows: { label: string; value: string; raw: number }[];
  min: number;
  max: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => {
        const pct = ((r.raw - min) / (max - min)) * 100;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.label}</span>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, Math.max(0, pct))}%`,
                background: color,
                borderRadius: 3,
              }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}
