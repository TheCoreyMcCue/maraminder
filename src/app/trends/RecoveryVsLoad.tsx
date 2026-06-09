"use client";
import { useState } from "react";
import type { WeekAnalysis } from "@/lib/weeklyAnalysis";

type SeriesKey = "load" | "lifeStress" | "recovery";

const STATUS_COLOR = {
  adapting:  "#22c55e",
  watch:     "#f59e0b",
  recovering:"#3b82f6",
  neutral:   "transparent",
};

const ANN_COLOR: Record<string, string> = {
  down:          "#22c55e",
  race:          "#f97316",
  half:          "#f97316",
  "taper-start": "#06b6d4",
  recalibration: "#8b5cf6",
};

export default function RecoveryVsLoad({ weeks }: { weeks: WeekAnalysis[] }) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(["load", "lifeStress", "recovery"]));
  const toggle = (k: SeriesKey) => setVisible((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const show = (k: SeriesKey) => visible.has(k);

  const weeksWithAny = weeks.filter((w) => w.actualLoad > 0 || w.recoveryIndex != null || w.annotations.length > 0);
  if (weeksWithAny.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Log sessions and recovery data to see this chart.</p>;
  }

  // ── Geometry ──────────────────────────────────────────────
  const VW = 560, VH = 230;
  const PAD = { top: 24, right: 52, bottom: 52, left: 44 };
  const CW = VW - PAD.left - PAD.right;
  const CH = VH - PAD.top - PAD.bottom;

  const allWeeks = weeks.map((w) => w.weekNo);
  const xMin = Math.min(...allWeeks), xMax = Math.max(...allWeeks);
  const xRange = xMax === xMin ? 1 : xMax - xMin;
  const xp = (wn: number) => PAD.left + ((wn - xMin) / xRange) * CW;
  const barW = Math.max(6, (CW / weeks.length) * 0.55);

  // Load scale (left) — total load including life stress
  const allTotalLoads = weeks.map((w) => Math.max(w.totalLoad, w.plannedLoad));
  const maxLoad = Math.max(...allTotalLoads, 500);
  const yLoad = (v: number) => PAD.top + CH - (v / maxLoad) * CH;

  // Recovery index scale (right) — symmetric around 0, ±30
  const recScale = 30;
  const yRec = (v: number) => PAD.top + CH / 2 - (v / recScale) * (CH / 2);

  // Smooth path
  function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
    return pts.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = pts[i - 1];
      const cpx = (prev.x + pt.x) / 2;
      return `${acc} C ${cpx} ${prev.y}, ${cpx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, "");
  }

  const recPts = weeks
    .filter((w) => w.recoveryIndex != null)
    .map((w) => ({ x: xp(w.weekNo), y: yRec(w.recoveryIndex!) }));
  const recPath = smoothPath(recPts);

  // Load axis ticks
  const loadTickStep = maxLoad > 4000 ? 1000 : maxLoad > 2000 ? 500 : 250;
  const loadTicks: number[] = [];
  for (let v = 0; v <= maxLoad; v += loadTickStep) loadTicks.push(v);

  // Recovery ticks
  const recTicks = [-30, -20, -10, 0, 10, 20, 30];

  const watchWeeks = weeks.filter((w) => w.status === "watch" && w.verdict);

  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b7280" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6b7280" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="lifeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* "Watch" week amber background bands */}
        {weeks.map((w) => w.status === "watch" ? (
          <rect key={w.weekNo}
            x={xp(w.weekNo) - barW} y={PAD.top}
            width={barW * 2.5} height={CH}
            fill="#f59e0b0a" stroke="#f59e0b20" strokeWidth={0.5} />
        ) : null)}

        {/* Grid lines (load) */}
        {loadTicks.filter((_, i) => i % 2 === 0).map((v) => (
          <line key={v} x1={PAD.left} y1={yLoad(v)} x2={PAD.left + CW} y2={yLoad(v)}
            stroke="#2e2e36" strokeWidth={0.5} />
        ))}

        {/* Zero line for recovery index */}
        <line x1={PAD.left} y1={yRec(0)} x2={PAD.left + CW} y2={yRec(0)}
          stroke="#22c55e" strokeWidth={0.6} strokeDasharray="4 3" opacity={0.4} />

        {/* Left axis — load */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#6b728040" strokeWidth={1} />
        {loadTicks.filter((_, i) => i % 2 === 0).map((v) => (
          <text key={v} x={PAD.left - 5} y={yLoad(v)} textAnchor="end" dominantBaseline="middle"
            fill="#888896" fontSize={8.5}>{v >= 1000 ? `${v / 1000}k` : v}</text>
        ))}
        <text x={10} y={PAD.top + CH / 2} textAnchor="middle" fill="#6b7280" fontSize={8}
          transform={`rotate(-90, 10, ${PAD.top + CH / 2})`}>load</text>

        {/* Right axis — recovery index */}
        <line x1={PAD.left + CW} y1={PAD.top} x2={PAD.left + CW} y2={PAD.top + CH}
          stroke="#22c55e40" strokeWidth={1} />
        {recTicks.filter((_, i) => i % 2 === 0).map((v) => (
          <text key={v} x={PAD.left + CW + 5} y={yRec(v)} textAnchor="start" dominantBaseline="middle"
            fill="#22c55e" fontSize={8.5} opacity={0.8}>
            {v > 0 ? `+${v}` : v}%
          </text>
        ))}
        <text x={VW - 7} y={PAD.top + CH / 2} textAnchor="middle" fill="#22c55e" fontSize={8} opacity={0.7}
          transform={`rotate(90, ${VW - 7}, ${PAD.top + CH / 2})`}>recovery</text>

        {/* X axis */}
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH}
          stroke="#2e2e36" strokeWidth={1} />

        {/* Bars */}
        {show("load") && weeks.map((w) => {
          const cx = xp(w.weekNo);
          const trainH = (w.actualLoad / maxLoad) * CH;
          const lifeH = (w.lifeStressLoad / maxLoad) * CH;
          const plannedH = (w.plannedLoad / maxLoad) * CH;

          return (
            <g key={w.weekNo}>
              {/* Planned ghost outline */}
              {w.plannedLoad > 0 && (
                <rect x={cx - barW / 2} y={yLoad(w.plannedLoad)} width={barW} height={plannedH}
                  fill="none" stroke="#6b728030" strokeWidth={1} />
              )}
              {/* Training load bar */}
              {w.actualLoad > 0 && (
                <rect x={cx - barW / 2} y={yLoad(w.actualLoad)} width={barW} height={trainH}
                  fill="url(#loadGrad)" />
              )}
              {/* Life stress stacked on top */}
              {show("lifeStress") && w.lifeStressLoad > 0 && w.actualLoad > 0 && (
                <rect
                  x={cx - barW / 2}
                  y={yLoad(w.actualLoad + w.lifeStressLoad)}
                  width={barW}
                  height={lifeH}
                  fill="url(#lifeGrad)"
                />
              )}
            </g>
          );
        })}

        {/* Recovery index line */}
        {show("recovery") && (
          <>
            <path d={recPath} fill="none" stroke="#22c55e" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
            {weeks
              .filter((w) => w.recoveryIndex != null)
              .map((w) => {
                const recColor = w.recoveryIndex! >= 0 ? "#22c55e"
                  : w.recoveryIndex! > -15 ? "#f59e0b" : "#ef4444";
                return (
                  <circle key={w.weekNo}
                    cx={xp(w.weekNo)} cy={yRec(w.recoveryIndex!)} r={4}
                    fill={recColor} stroke="#22c55e" strokeWidth={1.5} />
                );
              })}
          </>
        )}

        {/* Status dots above bars (adapting/watch/recovering) */}
        {weeks.map((w) => {
          if (w.status === "neutral") return null;
          const cx = xp(w.weekNo);
          const barTop = w.totalLoad > 0 ? yLoad(w.totalLoad + w.lifeStressLoad) : PAD.top + CH - 8;
          return (
            <circle key={w.weekNo} cx={cx} cy={barTop - 7} r={3.5}
              fill={STATUS_COLOR[w.status]} opacity={0.9} />
          );
        })}

        {/* X axis labels */}
        {weeks.map((w) => (
          <text key={w.weekNo} x={xp(w.weekNo)} y={PAD.top + CH + 12}
            textAnchor="middle" fill="#888896" fontSize={9} fontWeight={600}>
            W{w.weekNo}
          </text>
        ))}

        {/* Annotations */}
        {weeks.map((w) =>
          w.annotations.map((ann, ai) => (
            <text key={`${w.weekNo}-${ai}`}
              x={xp(w.weekNo)} y={PAD.top + CH + 24 + ai * 10}
              textAnchor="middle" fill={ANN_COLOR[ann.type]} fontSize={7.5} fontWeight={700}>
              {ann.label}
            </text>
          ))
        )}
      </svg>

      {/* Verdict chips */}
      {watchWeeks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {watchWeeks.map((w) => (
            <WatchVerdict key={w.weekNo} week={w} />
          ))}
        </div>
      )}

      {/* Legend + toggles */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Toggle label="Training load" color="#6b7280" filled active={show("load")} onClick={() => toggle("load")} />
        <Toggle label="+ Life stress" color="#f97316" filled active={show("lifeStress")} onClick={() => toggle("lifeStress")} />
        <Toggle label="Recovery index" color="#22c55e" active={show("recovery")} onClick={() => toggle("recovery")} />
        <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", marginLeft: 4 }}>
          Bars = actual (ghost = planned) · ● status
        </span>
      </div>

      {/* Recovery index explainer */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, opacity: 0.65, lineHeight: 1.6 }}>
        Recovery index = HRV 60% + RHR 25% + sleep 15%, all vs personal baseline.
        Above zero = better than baseline. Tap a day badge in the week view for the full breakdown.
      </div>
    </div>
  );
}

// ── Watch verdict chip ────────────────────────────────────

function WatchVerdict({ week }: { week: WeekAnalysis }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen((v) => !v)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "9px 12px",
        background: "#f59e0b0a", border: "1px solid #f59e0b30",
        borderLeft: "3px solid #f59e0b",
        borderRadius: 8, cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 12, color: "#f59e0b", marginTop: 1 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
          {week.verdict}
        </div>
        {open && week.recoveryComponents && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {week.recoveryComponents.hrv != null && (
              <span>HRV {week.recoveryComponents.hrv > 0 ? "+" : ""}{week.recoveryComponents.hrv}% vs baseline</span>
            )}
            {week.recoveryComponents.rhr != null && (
              <span>RHR {week.recoveryComponents.rhr > 0 ? "+" : ""}{week.recoveryComponents.rhr}% (inverted)</span>
            )}
            {week.recoveryComponents.sleep != null && (
              <span>Sleep {week.recoveryComponents.sleep > 0 ? "+" : ""}{week.recoveryComponents.sleep}% vs target</span>
            )}
            {week.recoveryDays > 0 && (
              <span style={{ opacity: 0.6 }}>{week.recoveryDays} day{week.recoveryDays > 1 ? "s" : ""} of data</span>
            )}
          </div>
        )}
      </div>
      <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{open ? "▲" : "▼"}</span>
    </div>
  );
}

// ── Toggle pill ───────────────────────────────────────────

function Toggle({ label, color, filled, active, onClick }: {
  label: string; color: string; filled?: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      border: `1px solid ${active ? color + "60" : "var(--border)"}`,
      background: active ? color + "14" : "transparent",
      color: active ? "var(--text)" : "var(--text-muted)",
      fontSize: 12, cursor: "pointer", transition: "all 0.15s",
      WebkitTapHighlightColor: "transparent",
    }}>
      <svg width={10} height={10}>
        <circle cx={5} cy={5} r={4}
          fill={active && filled ? color : "transparent"}
          stroke={active ? color : "var(--text-muted)"} strokeWidth={1.5} />
      </svg>
      {label}
      {!active && <span style={{ fontSize: 10, opacity: 0.5 }}>off</span>}
    </button>
  );
}
