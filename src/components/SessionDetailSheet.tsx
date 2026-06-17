"use client";
import { useState } from "react";
import type { Session, ZoneSet, Lap } from "@/lib/types";
import { formatSessionTarget, minutesToTimeStr } from "@/lib/zones";
import CategoryPill from "./CategoryPill";
import { targetPaceSecForZone, parsePaceSec, fmtPace, parseRepTarget, fmtDuration } from "@/lib/lapUtils";

function InlineMd({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {paragraphs.map((para, pi) => {
        const parts = para.split(/(\*\*[^*]+\*\*)/g);
        const nodes = parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        });
        return (
          <p key={pi} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
            {nodes}
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  session: Session;
  zones: ZoneSet;
  ftpW?: number;
  onClose: () => void;
}

// ── Lap breakdown ─────────────────────────────────────────────────────────────

function LapTable({ laps, workSummary, zones, structure }: {
  laps: Lap[];
  workSummary?: Session["actual"] extends null | undefined ? never : NonNullable<Session["actual"]>["workSummary"];
  zones: ZoneSet;
  structure?: string;
}) {
  const [showSupport, setShowSupport] = useState(false);
  const workLaps    = laps.filter((l) => l.label === "rep");
  const supportLaps = laps.filter((l) => l.label !== "rep");

  // Target pace for the primary work zone (for Δ column)
  const targetZone = workSummary?.zone ?? workLaps[0]?.zone;
  const targetSec  = targetZone ? targetPaceSecForZone(targetZone, zones) : null;

  // Prescribed rep dimension (time or distance) — drives the completion check column
  const repTarget = structure ? parseRepTarget(structure) : null;

  function deltaSec(lap: Lap): number | null {
    if (!targetSec || lap.avgPace === "—") return null;
    return parsePaceSec(lap.avgPace) - targetSec;
  }

  function fmtDelta(d: number | null): string {
    if (d == null) return "";
    const sign = d > 0 ? "+" : "";
    return `${sign}${Math.round(d)}s`;
  }

  function deltaColor(d: number | null): string {
    if (d == null) return "var(--text-muted)";
    if (Math.abs(d) <= 2) return "#22c55e";
    if (Math.abs(d) <= 8) return "#f59e0b";
    return "#ef4444";
  }

  // Recovery trend: flag if last recovery is >30s longer than first
  const recoveryLaps = supportLaps.filter((l) => l.label === "recovery");
  const recoveryFading =
    recoveryLaps.length >= 2 &&
    recoveryLaps[recoveryLaps.length - 1].durationSec - recoveryLaps[0].durationSec > 30;

  const gridCols = repTarget ? "28px 1fr 1fr 40px 68px" : "36px 1fr 1fr 44px";
  const headers  = repTarget ? ["#", "Pace", "HR", "Δ", "Done"] : ["Rep", "Pace", "HR", "Δ"];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
        Rep breakdown
      </div>

      {/* Work summary banner */}
      {workSummary && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 8, padding: "8px 12px",
          marginBottom: 8, fontSize: 12, display: "flex", flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ fontWeight: 600 }}>avg {workSummary.avgPace}/km</span>
          {workSummary.avgHr && <span>@ {workSummary.avgHr} bpm</span>}
          <span style={{
            color: workSummary.fadeSecPerKm <= 2 ? "#22c55e"
                 : workSummary.fadeSecPerKm <= 6 ? "#f59e0b"
                 : "#ef4444",
          }}>
            fade {workSummary.fadeSecPerKm > 0 ? "+" : ""}{workSummary.fadeSecPerKm}s/km
          </span>
          {workSummary.hrDriftBpm != null && (
            <span style={{ color: workSummary.hrDriftBpm <= 4 ? "#22c55e" : "#f59e0b" }}>
              HR drift {workSummary.hrDriftBpm > 0 ? "+" : ""}{workSummary.hrDriftBpm} bpm
            </span>
          )}
        </div>
      )}

      {/* Rep table */}
      <div style={{ background: "var(--surface-2)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 0, padding: "6px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          {headers.map((h) => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{h}</span>
          ))}
        </div>

        {/* Work reps */}
        {workLaps.map((lap, i) => {
          const d = deltaSec(lap);
          // Completion check cell: actual dimension vs target
          let doneCell: React.ReactNode = null;
          if (repTarget) {
            const isTime = repTarget.type === "time";
            const actual = isTime
              ? (lap.durationSec > 0 ? fmtDuration(lap.durationSec) : "—")
              : (lap.distanceKm  > 0 ? `${lap.distanceKm.toFixed(2)}k` : "—");
            const check = lap.completedAsPrescribed === true  ? " ✓"
                        : lap.completedAsPrescribed === false ? " ⚠"
                        : "";
            const color = lap.completedAsPrescribed === true  ? "#22c55e"
                        : lap.completedAsPrescribed === false ? "#f59e0b"
                        : "var(--text-muted)";
            doneCell = (
              <span style={{ fontSize: 11, fontWeight: 600, color }}>{actual}{check}</span>
            );
          }
          return (
            <div
              key={lap.lapIndex}
              style={{
                display: "grid", gridTemplateColumns: gridCols,
                padding: "7px 12px",
                borderBottom: i < workLaps.length - 1 ? "1px solid var(--border)" : "none",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                {lap.repNo ?? i + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{lap.avgPace}</span>
              <span style={{ fontSize: 13 }}>{lap.avgHr ? `${lap.avgHr} bpm` : "—"}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: deltaColor(d) }}>{fmtDelta(d)}</span>
              {doneCell}
            </div>
          );
        })}

        {/* Support laps toggle */}
        {supportLaps.length > 0 && (
          <>
            <button
              onClick={() => setShowSupport((v) => !v)}
              style={{
                width: "100%", padding: "6px 12px", background: "var(--surface)", border: "none",
                borderTop: "1px solid var(--border)", cursor: "pointer",
                fontSize: 11, color: "var(--text-muted)", textAlign: "left",
                display: "flex", justifyContent: "space-between",
              }}
            >
              <span>Warmup / recovery / cooldown ({supportLaps.length} laps)</span>
              <span>{showSupport ? "▲" : "▼"}</span>
            </button>
            {showSupport && (
              <>
                {supportLaps.map((lap) => {
                  const isRec = lap.label === "recovery";
                  return (
                    <div
                      key={lap.lapIndex}
                      style={{
                        display: "grid", gridTemplateColumns: "64px 1fr 1fr 56px",
                        padding: "6px 12px",
                        borderTop: "1px solid var(--border)",
                        alignItems: "center",
                        opacity: isRec ? 1 : 0.65,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {lap.label}
                      </span>
                      <span style={{ fontSize: 12 }}>{lap.avgPace}</span>
                      <span style={{ fontSize: 12 }}>{lap.avgHr ? `${lap.avgHr} bpm` : "—"}</span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: isRec ? 600 : 400,
                        color: isRec ? "var(--text)" : "var(--text-muted)",
                      }}>
                        {lap.durationSec > 0 ? fmtDuration(lap.durationSec) : "—"}
                      </span>
                    </div>
                  );
                })}
                {recoveryFading && (
                  <div style={{ padding: "4px 12px 6px", fontSize: 11, color: "#f59e0b", borderTop: "1px solid var(--border)" }}>
                    ↑ Recovery lengthening — possible fading
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
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

          {/* Breakdown */}
          {session.targetDetail && (
            <Section title="Breakdown">
              <InlineMd text={session.targetDetail} />
            </Section>
          )}

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
          {a && !a.restTaken && session.category === "strength" && (
            <Section title="Actual">
              {a.rpe != null && <Row label="RPE" value={`${a.rpe} / 10`} />}
              {a.topSets && a.topSets.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {a.topSets.map((ts, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ts.exercise}</span>
                      <span style={{ fontSize: 13, color: "var(--text)" }}>{ts.weightKg}kg × {ts.reps}</span>
                    </div>
                  ))}
                </div>
              )}
              {a.notes && <Row label="Notes" value={a.notes} />}
            </Section>
          )}

          {a && !a.restTaken && session.category !== "strength" && (
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

          {/* Lap breakdown */}
          {a?.laps && a.laps.length > 0 && (
            <LapTable laps={a.laps} workSummary={a.workSummary} zones={zones} structure={session.structure} />
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
