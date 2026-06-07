"use client";
import { useState } from "react";

export interface ChartPoint {
  weekNo: number;
  avgHr: number;
  pace?: string;
  isSegment: boolean;
  date: string;
}

type SeriesKey = "hr" | "pace" | "hrTrend" | "paceTrend";

const ALL_SERIES: SeriesKey[] = ["hr", "pace", "hrTrend", "paceTrend"];

function paceToSec(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  return m * 60 + (s || 0);
}
function secToPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  return pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return `${acc} C ${cpx} ${prev.y}, ${cpx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");
}
function regression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sx2 = xs.reduce((s, x) => s + x * x, 0);
  const d = n * sx2 - sx * sx;
  if (d === 0) return null;
  const slope = (n * sxy - sx * sy) / d;
  return { slope, intercept: (sy - slope * sx) / n };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function MPHrChart({ data, targetLow, targetHigh }: {
  data: ChartPoint[];
  targetLow: number;
  targetHigh: number;
}) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(ALL_SERIES));

  function toggle(key: SeriesKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  const show = (key: SeriesKey) => visible.has(key);

  // ── Geometry ──────────────────────────────────────────────
  const VW = 540;
  const VH = 240;
  const PAD = { top: 20, right: 52, bottom: 44, left: 42 };
  const CW = VW - PAD.left - PAD.right;
  const CH = VH - PAD.top - PAD.bottom;

  const allHr = data.map((d) => d.avgHr);
  const hrMin = Math.floor((Math.min(...allHr, targetLow) - 6) / 4) * 4;
  const hrMax = Math.ceil((Math.max(...allHr, targetHigh) + 6) / 4) * 4;

  const pacePoints = data.filter((d) => d.pace);
  const allPaceSec = pacePoints.map((d) => paceToSec(d.pace!));
  const hasPace = allPaceSec.length > 0;
  const paceSecMin = hasPace ? Math.floor((Math.min(...allPaceSec) - 8) / 5) * 5 : 240;
  const paceSecMax = hasPace ? Math.ceil((Math.max(...allPaceSec) + 8) / 5) * 5 : 280;

  const allWeeks = data.map((d) => d.weekNo);
  const xMin = Math.min(...allWeeks);
  const xMax = Math.max(...allWeeks);
  const xRange = xMax === xMin ? 1 : xMax - xMin;

  const xp = (w: number) => PAD.left + ((w - xMin) / xRange) * CW;
  const yhr = (hr: number) => PAD.top + CH - ((hr - hrMin) / (hrMax - hrMin)) * CH;
  const ypace = (sec: number) => PAD.top + CH - ((paceSecMax - sec) / (paceSecMax - paceSecMin)) * CH;

  const hrPts = data.map((d) => ({ x: xp(d.weekNo), y: yhr(d.avgHr) }));
  const hrPath = smoothPath(hrPts);
  const hrAreaPath = hrPts.length > 1
    ? `${hrPath} L ${hrPts[hrPts.length - 1].x} ${PAD.top + CH} L ${hrPts[0].x} ${PAD.top + CH} Z`
    : "";

  const pacePts = pacePoints.map((d) => ({ x: xp(d.weekNo), y: ypace(paceToSec(d.pace!)) }));
  const pacePath = smoothPath(pacePts);

  const hrReg = regression(allWeeks, allHr);
  const hrTrendPath = hrReg
    ? `M ${xp(xMin)} ${yhr(hrReg.slope * xMin + hrReg.intercept)} L ${xp(xMax)} ${yhr(hrReg.slope * xMax + hrReg.intercept)}`
    : "";

  const paceWeeks = pacePoints.map((d) => d.weekNo);
  const paceReg = regression(paceWeeks, allPaceSec);
  const paceTrendPath = paceReg && paceWeeks.length >= 2
    ? `M ${xp(Math.min(...paceWeeks))} ${ypace(paceReg.slope * Math.min(...paceWeeks) + paceReg.intercept)} L ${xp(Math.max(...paceWeeks))} ${ypace(paceReg.slope * Math.max(...paceWeeks) + paceReg.intercept)}`
    : "";

  const hrTicks: number[] = [];
  for (let h = hrMin; h <= hrMax; h += 4) hrTicks.push(h);
  const paceTicks: number[] = [];
  for (let s = paceSecMin; s <= paceSecMax; s += 10) paceTicks.push(s);

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Target zone band */}
        <rect x={PAD.left} y={yhr(targetHigh)} width={CW}
          height={yhr(targetLow) - yhr(targetHigh)}
          fill="#3b82f612" stroke="#3b82f628" strokeWidth={0.5} />

        {/* Grid */}
        {hrTicks.map((hr) => (
          <line key={hr} x1={PAD.left} y1={yhr(hr)} x2={PAD.left + CW} y2={yhr(hr)}
            stroke="#2e2e36" strokeWidth={hr % 8 === 0 ? 0.8 : 0.3} />
        ))}

        {/* Left axis labels */}
        {hrTicks.filter((h) => h % 8 === 0).map((hr) => (
          <text key={hr} x={PAD.left - 5} y={yhr(hr)} textAnchor="end"
            dominantBaseline="middle" fill="#888896" fontSize={9}>{hr}</text>
        ))}
        <text x={10} y={PAD.top + CH / 2} textAnchor="middle"
          fill="#3b82f6" fontSize={8} opacity={0.7}
          transform={`rotate(-90, 10, ${PAD.top + CH / 2})`}>bpm</text>

        {/* Right axis labels (pace) — always visible when pace data exists */}
        {hasPace && paceTicks.map((sec) => (
          <text key={sec} x={PAD.left + CW + 5} y={ypace(sec)} textAnchor="start"
            dominantBaseline="middle" fill="#22c55e" fontSize={8.5}
            opacity={show("pace") ? 0.8 : 0.3}>
            {secToPace(sec)}
          </text>
        ))}
        {hasPace && (
          <text x={VW - 8} y={PAD.top + CH / 2} textAnchor="middle"
            fill="#22c55e" fontSize={8} opacity={show("pace") ? 0.7 : 0.3}
            transform={`rotate(90, ${VW - 8}, ${PAD.top + CH / 2})`}>/km</text>
        )}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH}
          stroke="#3b82f650" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH}
          stroke="#2e2e36" strokeWidth={1} />
        {hasPace && (
          <line x1={PAD.left + CW} y1={PAD.top} x2={PAD.left + CW} y2={PAD.top + CH}
            stroke="#22c55e50" strokeWidth={1} opacity={show("pace") ? 1 : 0.3} />
        )}

        {/* HR series */}
        {show("hr") && hrAreaPath && <path d={hrAreaPath} fill="url(#hrGrad)" />}
        {show("hrTrend") && hrTrendPath && (
          <path d={hrTrendPath} fill="none" stroke="#6366f1" strokeWidth={1.2}
            strokeDasharray="5 3" opacity={0.6} />
        )}
        {show("hr") && (
          <path d={hrPath} fill="none" stroke="#3b82f6" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Pace series */}
        {show("paceTrend") && paceTrendPath && (
          <path d={paceTrendPath} fill="none" stroke="#16a34a" strokeWidth={1.2}
            strokeDasharray="5 3" opacity={0.6} />
        )}
        {show("pace") && pacePath && (
          <path d={pacePath} fill="none" stroke="#22c55e" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data points + x-axis labels */}
        {data.map((d, i) => (
          <g key={i}>
            {show("hr") && (
              <>
                <circle cx={xp(d.weekNo)} cy={yhr(d.avgHr)} r={4.5}
                  fill={d.isSegment ? "#3b82f6" : "var(--surface)"}
                  stroke="#3b82f6" strokeWidth={2} />
                <text x={xp(d.weekNo)} y={yhr(d.avgHr) - 9} textAnchor="middle"
                  fill="#e8e8ed" fontSize={8.5} fontWeight={600}>{d.avgHr}</text>
              </>
            )}
            {show("pace") && d.pace && (
              <>
                <circle cx={xp(d.weekNo)} cy={ypace(paceToSec(d.pace))} r={4}
                  fill="#22c55e" stroke="#22c55e" strokeWidth={1.5} />
                <text x={xp(d.weekNo)} y={ypace(paceToSec(d.pace)) + 11} textAnchor="middle"
                  fill="#22c55e" fontSize={8} fontWeight={600}>{d.pace}</text>
              </>
            )}
            <text x={xp(d.weekNo)} y={PAD.top + CH + 12} textAnchor="middle"
              fill="#888896" fontSize={9} fontWeight={600}>W{d.weekNo}</text>
            <text x={xp(d.weekNo)} y={PAD.top + CH + 24} textAnchor="middle"
              fill="#888896" fontSize={7.5} opacity={0.65}>{fmtDate(d.date)}</text>
          </g>
        ))}

        {/* Target zone label */}
        <text x={PAD.left + 4} y={yhr((targetLow + targetHigh) / 2)}
          dominantBaseline="middle" fill="#3b82f6" fontSize={7.5} opacity={0.55} fontStyle="italic">
          MP target
        </text>
      </svg>

      {/* Interactive legend */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <LegendItem
          label="HR" dot filled color="#3b82f6"
          active={show("hr")} onClick={() => toggle("hr")}
        />
        <LegendItem
          label="Pace" dot filled color="#22c55e"
          active={show("pace")} onClick={() => toggle("pace")}
          disabled={!hasPace}
        />
        <LegendItem
          label="HR trend" dashed color="#6366f1"
          active={show("hrTrend")} onClick={() => toggle("hrTrend")}
          disabled={!hrTrendPath}
        />
        <LegendItem
          label="Pace trend" dashed color="#16a34a"
          active={show("paceTrend")} onClick={() => toggle("paceTrend")}
          disabled={!paceTrendPath}
        />
      </div>
    </div>
  );
}

function LegendItem({ label, color, dot, filled, dashed, active, onClick, disabled }: {
  label: string;
  color: string;
  dot?: boolean;
  filled?: boolean;
  dashed?: boolean;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        border: `1px solid ${active ? color + "60" : "var(--border)"}`,
        background: active ? color + "14" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: 12,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "all 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {dashed ? (
        <svg width={16} height={8}>
          <line x1={0} y1={4} x2={16} y2={4}
            stroke={active ? color : "var(--text-muted)"}
            strokeWidth={1.5} strokeDasharray="4 2" />
        </svg>
      ) : (
        <svg width={10} height={10}>
          <circle cx={5} cy={5} r={4}
            fill={active && filled ? color : "transparent"}
            stroke={active ? color : "var(--text-muted)"}
            strokeWidth={1.5} />
        </svg>
      )}
      {label}
      {!active && <span style={{ fontSize: 10, opacity: 0.6 }}>off</span>}
    </button>
  );
}
