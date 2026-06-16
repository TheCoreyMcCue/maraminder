"use client";
import type { Session, ZoneSet } from "@/lib/types";
import { formatSessionTarget, minutesToTimeStr } from "@/lib/zones";
import CategoryPill from "./CategoryPill";

interface Props {
  session: Session;
  zones: ZoneSet;
  ftpW?: number;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--text-muted)", marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{
        background: "var(--surface-2)", borderRadius: 10,
        padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7,
      }}>
        {children}
      </div>
    </div>
  );
}

function delta(actual: number, target: number | undefined, unit: string, invert = false) {
  if (!target) return null;
  const diff = actual - target;
  if (Math.abs(diff) < 0.01) return null;
  const sign = diff > 0 ? "+" : "";
  const color = (diff > 0) !== invert ? "#22c55e" : "#f87171";
  return <span style={{ fontSize: 11, color }}>({sign}{diff.toFixed(2)}{unit})</span>;
}

export default function SessionDetailSheet({ session, zones, ftpW, onClose }: Props) {
  const a = session.actual;
  const isDone = session.status === "done";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", padding: 0, maxHeight: "88vh" }}
      >
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div className="sheet-handle" style={{ margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <CategoryPill category={session.category} />
                {isDone && <span style={{ fontSize: 14, color: "#22c55e" }}>✓</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{session.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                {session.dayOfWeek} · {session.date}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ fontSize: 22, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Target */}
          <Section title="Target">
            {session.zoneRefs.length > 0 && (
              <Row label="Zones" value={formatSessionTarget(session, zones)} />
            )}
            {session.targetDistanceKm && (
              <Row label="Distance" value={`~${session.targetDistanceKm} km`} />
            )}
            {session.targetDurationMin && (
              <Row label="Duration" value={minutesToTimeStr(session.targetDurationMin)} />
            )}
            {session.structure && (
              <Row label="Structure" value={
                <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{session.structure}</span>
              } />
            )}
          </Section>

          {/* Actual */}
          {a && !a.restTaken && (
            <Section title="Actual">
              <Row
                label="Distance"
                value={<>{a.distanceKm.toFixed(2)} km {delta(a.distanceKm, session.targetDistanceKm, "km")}</>}
              />
              <Row
                label="Duration"
                value={<>{minutesToTimeStr(a.durationMin)} {delta(a.durationMin, session.targetDurationMin, "min")}</>}
              />
              {a.avgPacePerKm && <Row label="Avg pace" value={`${a.avgPacePerKm}/km`} />}
              {a.avgHr && <Row label="Avg HR" value={`${Math.round(a.avgHr)} bpm`} />}
              {a.avgPowerW && <Row label="Avg power" value={`${a.avgPowerW} W`} />}
              {a.avgPowerW && ftpW && (
                <Row label="Intensity factor" value={(a.avgPowerW / ftpW).toFixed(2)} />
              )}
              {a.rpe != null && <Row label="RPE" value={`${a.rpe} / 10`} />}
              {a.tempC != null && <Row label="Temp" value={`${a.tempC}°C`} />}
              {a.wind && <Row label="Wind" value={a.wind} />}
            </Section>
          )}

          {a?.restTaken && (
            <Section title="Actual">
              <Row label="Session" value="Full rest day" />
            </Section>
          )}

          {/* Decoupling */}
          {a?.decoupling && (a.decoupling.firstHalfHr || a.decoupling.secondHalfHr) && (
            <Section title="Cardiac decoupling">
              {a.decoupling.firstHalfHr && <Row label="First half HR" value={`${a.decoupling.firstHalfHr} bpm`} />}
              {a.decoupling.secondHalfHr && <Row label="Second half HR" value={`${a.decoupling.secondHalfHr} bpm`} />}
              {a.decoupling.firstHalfHr && a.decoupling.secondHalfHr && (
                <Row
                  label="Drift"
                  value={
                    <span style={{ color: a.decoupling.secondHalfHr - a.decoupling.firstHalfHr > 5 ? "#f87171" : "#22c55e" }}>
                      +{a.decoupling.secondHalfHr - a.decoupling.firstHalfHr} bpm
                    </span>
                  }
                />
              )}
              {a.decoupling.paceHeldKm && <Row label="Pace held" value={`${a.decoupling.paceHeldKm} km`} />}
            </Section>
          )}

          {/* Segment data */}
          {a?.segmentHr && Object.keys(a.segmentHr).length > 0 && (
            <Section title="Zone segments — HR">
              {Object.entries(a.segmentHr).map(([zone, hr]) => (
                <Row key={zone} label={zone} value={`${hr} bpm`} />
              ))}
            </Section>
          )}

          {a?.segmentPace && Object.keys(a.segmentPace).length > 0 && (
            <Section title="Zone segments — pace">
              {Object.entries(a.segmentPace).map(([zone, pace]) => (
                <Row key={zone} label={zone} value={`${pace}/km`} />
              ))}
            </Section>
          )}

          {/* Notes */}
          {a?.notes && (
            <Section title="Notes">
              <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {a.notes}
              </span>
            </Section>
          )}

          {/* Strava */}
          {a?.stravaUrl && (
            <a
              href={a.stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px", borderRadius: 10,
                background: "#fc4c0215", border: "1px solid #fc4c0230",
                color: "#fc4c02", fontWeight: 600, fontSize: 14,
                textDecoration: "none", marginBottom: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              View on Strava
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
