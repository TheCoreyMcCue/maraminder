export const dynamic = "force-dynamic";
import { getTrends, getPlan } from "@/lib/planOps";
import MPHrChart from "./MPHrChart";

export default async function TrendsPage() {
  const [trends, plan] = await Promise.all([getTrends(), getPlan()]);
  const mpZone = plan.currentZones.zones.MP;
  const mpTargetLow = mpZone.hrLow ?? 168;
  const mpTargetHigh = mpZone.hrHigh ?? 176;

  return (
    <div className="main-content" style={{ padding: "16px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Trends</h1>

      {/* MP HR + Pace chart */}
      <Section title="MP Heart Rate & Pace Over Time">
        {trends.mpHrHistory.length === 0 ? (
          <EmptyState msg="Log MP sessions and enter block HR + pace to plot here." />
        ) : (
          <>
            <MPHrChart
              data={trends.mpHrHistory}
              targetLow={mpTargetLow}
              targetHigh={mpTargetHigh}
            />
            {trends.mpHrHistory.some((r) => !r.isSegment) && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                ◯ hollow dot = whole-run avg HR. Use "MP HR" + "MP Pace" fields when logging for accurate block data.
              </div>
            )}
          </>
        )}
      </Section>

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
                <div key={w.weekNo} style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>W{w.weekNo}</span>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 4, position: "relative" }}>
                    <div style={{ position: "absolute", right: 0, top: -2, width: 1, height: 12, background: "var(--text-muted)", opacity: 0.4 }} />
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, pct)}%`,
                      background: over ? "#ef4444" : w.actualKm > 0 ? "#22c55e" : "var(--border)",
                      borderRadius: 4,
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

      {/* Easy pace history */}
      <Section title="Easy Pace History">
        {trends.easyPaceHistory.length === 0 ? (
          <EmptyState msg="Log easy runs to see pace history." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trends.easyPaceHistory.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "center" }}>
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
      padding: "18px 20px",
      marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg}</p>;
}
