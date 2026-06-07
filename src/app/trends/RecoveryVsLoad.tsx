"use client";
import { useState } from "react";
import type { WeeklyRecovery } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/recovery";

interface WeekPoint {
  weekNo: number;
  targetKm: number;
  actualKm: number;
  recovery: WeeklyRecovery;
}

type SeriesKey = "volume" | "hrv" | "rhr" | "sleep";

export default function RecoveryVsLoad({ weeks }: { weeks: WeekPoint[] }) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(
    new Set(["volume", "hrv", "rhr", "sleep"])
  );

  function toggle(k: SeriesKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }
  const show = (k: SeriesKey) => visible.has(k);

  const weeksWithData = weeks.filter((w) => w.actualKm > 0 || w.recovery.status !== "unknown");

  if (weeksWithData.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Log sessions and recovery data to see this chart.</p>;
  }

  // ── Geometry ──────────────────────────────────────────────
  const VW = 540;
  const VH = 220;
  const PAD = { top: 16, right: 50, bottom: 32, left: 42 };
  const CW = VW - PAD.left - PAD.right;
  const CH = VH - PAD.top - PAD.bottom;

  const allWeekNos = weeks.map((w) => w.weekNo);
  const xMin = Math.min(...allWeekNos);
  const xMax = Math.max(...allWeekNos);
  const xRange = xMax === xMin ? 1 : xMax - xMin;
  const xp = (w: number) => PAD.left + ((w - xMin) / xRange) * CW;
  const barW = Math.max(4, (CW / weeks.length) * 0.55);

  // Volume scale (left)
  const maxVol = Math.max(...weeks.map((w) => Math.max(w.targetKm, w.actualKm)), 10);
  const yVol = (km: number) => PAD.top + CH - (km / maxVol) * CH;

  // HRV deviation scale (right, centred at 0)
  const hrvVals = weeks.map((w) => w.recovery.avgHrvDevPct).filter((v): v is number => v != null);
  const hrvAbsMax = Math.max(...hrvVals.map(Math.abs), 15);
  const yHrv = (pct: number) => PAD.top + CH / 2 - (pct / hrvAbsMax) * (CH / 2);

  // RHR scale (secondary right axis, normalized)
  const rhrVals = weeks.map((w) => w.recovery.avgRhr).filter((v): v is number => v != null);
  const rhrMin = rhrVals.length ? Math.min(...rhrVals) - 3 : 40;
  const rhrMax = rhrVals.length ? Math.max(...rhrVals) + 3 : 60;
  const yRhr = (bpm: number) => PAD.top + CH - ((bpm - rhrMin) / (rhrMax - rhrMin)) * CH;

  // Sleep scale (0–9h)
  const ySlp = (h: number) => PAD.top + CH - (h / 9) * CH;

  function smoothPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
    return pts.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = pts[i - 1];
      const cpx = (prev.x + pt.x) / 2;
      return `${acc} C ${cpx} ${prev.y}, ${cpx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, "");
  }

  const hrvPts = weeks
    .filter((w) => w.recovery.avgHrvDevPct != null)
    .map((w) => ({ x: xp(w.weekNo), y: yHrv(w.recovery.avgHrvDevPct!) }));
  const rhrPts = weeks
    .filter((w) => w.recovery.avgRhr != null)
    .map((w) => ({ x: xp(w.weekNo), y: yRhr(w.recovery.avgRhr!) }));
  const sleepPts = weeks
    .filter((w) => w.recovery.avgSleep != null)
    .map((w) => ({ x: xp(w.weekNo), y: ySlp(w.recovery.avgSleep!) }));

  // Volume ticks
  const volTicks = [0, 25, 50, 75, 100].filter((t) => t <= maxVol + 10);

  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Grid */}
        {volTicks.map((t) => (
          <line key={t} x1={PAD.left} y1={yVol(t)} x2={PAD.left + CW} y2={yVol(t)}
            stroke="#2e2e36" strokeWidth={0.5} />
        ))}
        {/* Zero line for HRV deviation */}
        {show("hrv") && (
          <line x1={PAD.left} y1={yHrv(0)} x2={PAD.left + CW} y2={yHrv(0)}
            stroke="#22c55e" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.4} />
        )}

        {/* Left axis — volume */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH}
          stroke="#6b728050" strokeWidth={1} />
        {volTicks.map((t) => (
          <text key={t} x={PAD.left - 5} y={yVol(t)} textAnchor="end"
            dominantBaseline="middle" fill="#888896" fontSize={8.5}>{t}</text>
        ))}
        <text x={10} y={PAD.top + CH / 2} textAnchor="middle" fill="#6b7280"
          fontSize={8} transform={`rotate(-90, 10, ${PAD.top + CH / 2})`}>km</text>

        {/* Right axis — HRV % */}
        {show("hrv") && (
          <>
            <line x1={PAD.left + CW} y1={PAD.top} x2={PAD.left + CW} y2={PAD.top + CH}
              stroke="#22c55e40" strokeWidth={1} />
            {[-20, -10, 0, 10, 20].filter((v) => Math.abs(v) <= hrvAbsMax + 5).map((v) => (
              <text key={v} x={PAD.left + CW + 4} y={yHrv(v)} textAnchor="start"
                dominantBaseline="middle" fill="#22c55e" fontSize={7.5} opacity={0.7}>
                {v > 0 ? `+${v}` : v}%
              </text>
            ))}
          </>
        )}

        {/* Volume bars */}
        {show("volume") && weeks.map((w) => {
          const cx = xp(w.weekNo);
          const targetH = CH - (yVol(w.targetKm) - PAD.top);
          const actualH = w.actualKm > 0 ? CH - (yVol(w.actualKm) - PAD.top) : 0;
          const statusColor = w.recovery.status !== "unknown" ? STATUS_COLOR[w.recovery.status] : "var(--border)";
          return (
            <g key={w.weekNo}>
              {/* Target bar (outline) */}
              <rect x={cx - barW / 2} y={yVol(w.targetKm)} width={barW} height={targetH}
                fill="none" stroke="#6b728030" strokeWidth={1} />
              {/* Actual bar */}
              {w.actualKm > 0 && (
                <rect x={cx - barW / 2} y={yVol(w.actualKm)} width={barW} height={actualH}
                  fill="#6b728040" />
              )}
              {/* Recovery status dot above bar */}
              {w.recovery.status !== "unknown" && (
                <circle cx={cx} cy={yVol(Math.max(w.targetKm, w.actualKm)) - 6} r={3}
                  fill={statusColor} />
              )}
            </g>
          );
        })}

        {/* HRV deviation line */}
        {show("hrv") && (
          <>
            <path d={smoothPath(hrvPts)} fill="none" stroke="#22c55e" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
            {hrvPts.map((pt, i) => {
              const w = weeks.filter((w) => w.recovery.avgHrvDevPct != null)[i];
              return (
                <circle key={i} cx={pt.x} cy={pt.y} r={3.5}
                  fill={w.recovery.avgHrvDevPct! >= 0 ? "#22c55e" : "#ef4444"}
                  stroke="#22c55e" strokeWidth={1.5} />
              );
            })}
          </>
        )}

        {/* RHR line */}
        {show("rhr") && rhrPts.length > 0 && (
          <>
            <path d={smoothPath(rhrPts)} fill="none" stroke="#f97316" strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
            {rhrPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3} fill="#f97316" />
            ))}
          </>
        )}

        {/* Sleep line */}
        {show("sleep") && sleepPts.length > 0 && (
          <>
            <path d={smoothPath(sleepPts)} fill="none" stroke="#8b5cf6" strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 3" />
            {sleepPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3} fill="#8b5cf6" />
            ))}
          </>
        )}

        {/* X axis labels */}
        {weeks.map((w) => (
          <text key={w.weekNo} x={xp(w.weekNo)} y={PAD.top + CH + 12}
            textAnchor="middle" fill="#888896" fontSize={8.5}>W{w.weekNo}</text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <ToggleItem label="Volume" color="#6b7280" filled active={show("volume")} onClick={() => toggle("volume")} />
        <ToggleItem label="HRV dev" color="#22c55e" active={show("hrv")} onClick={() => toggle("hrv")} />
        <ToggleItem label="RHR" color="#f97316" dashed active={show("rhr")} onClick={() => toggle("rhr")} />
        <ToggleItem label="Sleep" color="#8b5cf6" dashed active={show("sleep")} onClick={() => toggle("sleep")} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
        Coloured dots above bars = weekly recovery status. HRV line above zero = better than baseline.
      </div>
    </div>
  );
}

function ToggleItem({ label, color, filled, dashed, active, onClick }: {
  label: string; color: string; filled?: boolean; dashed?: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 20,
        border: `1px solid ${active ? color + "60" : "var(--border)"}`,
        background: active ? color + "14" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: 12, cursor: "pointer",
        transition: "all 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {dashed ? (
        <svg width={16} height={8}>
          <line x1={0} y1={4} x2={16} y2={4} stroke={active ? color : "var(--text-muted)"}
            strokeWidth={1.5} strokeDasharray="4 2" />
        </svg>
      ) : (
        <svg width={10} height={10}>
          <circle cx={5} cy={5} r={4}
            fill={active ? color + "60" : "transparent"}
            stroke={active ? color : "var(--text-muted)"} strokeWidth={1.5} />
        </svg>
      )}
      {label}
      {!active && <span style={{ fontSize: 10, opacity: 0.5 }}>off</span>}
    </button>
  );
}
