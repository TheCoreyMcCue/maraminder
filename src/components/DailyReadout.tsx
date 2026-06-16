"use client";
import { useState } from "react";
import type { DailyLoadRec, LoadLevel } from "@/lib/loadRecommendation";
import type { LoadFactorResult } from "@/lib/loadFactor";
import type { PersonalBaseline } from "@/lib/types";

interface Props {
  rec: DailyLoadRec;
  loadFactor?: LoadFactorResult;
  baseline: PersonalBaseline;
  date: string;
  onLogRecovery: () => void;
}

const LEVEL_COLOR: Record<LoadLevel, string> = {
  green:   "#22c55e",
  amber:   "#f59e0b",
  red:     "#ef4444",
  unknown: "var(--text-muted)",
};

const LEVEL_BG: Record<LoadLevel, string> = {
  green:   "#22c55e12",
  amber:   "#f59e0b12",
  red:     "#ef444412",
  unknown: "var(--surface-2)",
};

const LEVEL_LABEL: Record<LoadLevel, string> = {
  green:   "Green",
  amber:   "Amber",
  red:     "Red",
  unknown: "No data",
};

export default function DailyReadout({ rec, loadFactor, baseline, date, onLogRecovery }: Props) {
  const [expanded, setExpanded] = useState(true);
  const color  = LEVEL_COLOR[rec.level];
  const bg     = LEVEL_BG[rec.level];

  const d = new Date(date + "T12:00:00");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      {/* Header row — always visible */}
      <div
        onClick={() => setExpanded((v) => !v)}
        role="button"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "12px 14px",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Status dot */}
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color }}>
              {LEVEL_LABEL[rec.level]}
            </span>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
              {rec.headline}
            </span>
          </div>
          {/* Inline metrics summary */}
          {rec.level !== "unknown" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {rec.hrv   && <MetricChip label="HRV"   value={`${rec.hrv.value}ms`}    dev={rec.hrv.devPct}   higherBetter color={color} />}
              {rec.rhr   && <MetricChip label="RHR"   value={`${rec.rhr.value}bpm`}   dev={rec.rhr.devPct}   higherBetter={false} color={color} />}
              {rec.sleep && <MetricChip label="Sleep" value={`${rec.sleep.hours.toFixed(1)}h`} dev={null} ok={rec.sleep.ok} color={color} />}
            </div>
          )}
        </div>

        {rec.level === "unknown" && (
          <button
            onClick={(e) => { e.stopPropagation(); onLogRecovery(); }}
            style={{
              flexShrink: 0, padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${color}40`, background: bg,
              color, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            + Log
          </button>
        )}

        {rec.level !== "unknown" && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && rec.level !== "unknown" && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${color}20` }}>
          {/* Rationale */}
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: "10px 0 12px" }}>
            {rec.rationale}
          </p>

          {/* Session advice */}
          {rec.sessionAdvice.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                TODAY'S SESSIONS
              </div>
              {rec.sessionAdvice.map((a) => (
                <div key={a.sk} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "9px 12px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{a.advice}</div>
                </div>
              ))}
            </div>
          )}

          {/* Load factor gauge */}
          {loadFactor && <LoadFactorGauge lf={loadFactor} />}

          {/* Baseline footnote */}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, opacity: 0.6 }}>
            vs personal baseline · HRV {baseline.hrv.mean}±{baseline.hrv.sd}ms · RHR {baseline.rhr.mean}±{baseline.rhr.sd}bpm
          </div>
        </div>
      )}
    </div>
  );
}

function LoadFactorGauge({ lf }: { lf: LoadFactorResult }) {
  const LEVEL_COLORS: Record<string, string> = {
    green: "#22c55e", amber: "#f59e0b", red: "#ef4444", critical: "#dc2626",
  };
  const color = LEVEL_COLORS[lf.level];

  // Zones on the gauge (cumulative %): 0-35 green, 35-55 amber, 55-75 red, 75-100 critical
  const zones = [
    { pct: 35, color: "#22c55e22" },
    { pct: 20, color: "#f59e0b22" },
    { pct: 20, color: "#ef444422" },
    { pct: 25, color: "#dc262622" },
  ];

  const components = [
    {
      label: "Training",
      score: lf.training.score,
      max: 40,
      detail: lf.training.insufficient
        ? "building history…"
        : lf.training.taperCapped
          ? `ACWR ${lf.training.ratio.toFixed(2)} · taper`
          : `ACWR ${lf.training.ratio.toFixed(2)}`,
      muted: lf.training.insufficient,
      barColor: lf.training.insufficient ? undefined
        : lf.training.taperCapped ? "#22c55e"
        : lf.training.acwrColor,
    },
    {
      label: "Recovery",
      score: lf.recoveryDeficit.score,
      max: 40,
      detail: lf.recoveryDeficit.hrvZ != null
        ? `HRV ${lf.recoveryDeficit.hrvZ.toFixed(1)}σ`
        : "no data",
      muted: false,
    },
    {
      label: "Leg fatigue",
      score: lf.legFatigue.score,
      max: 10,
      detail: lf.legFatigue.value != null ? `${lf.legFatigue.value}/10` : "not logged",
      muted: lf.legFatigue.value == null,
    },
    {
      label: "Life",
      score: lf.lifeStress.score,
      max: 10,
      detail: lf.lifeStress.avg != null ? `${lf.lifeStress.avg.toFixed(1)}/10` : "not logged",
      muted: false,
    },
  ];

  return (
    <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
          TOTAL LOAD INDEX
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color }}>{lf.score}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/100</span>
        </div>
      </div>

      {/* Gauge bar */}
      <div style={{ position: "relative", height: 10, borderRadius: 5, overflow: "hidden", display: "flex", marginBottom: 6 }}>
        {zones.map((z, i) => (
          <div key={i} style={{ width: `${z.pct}%`, background: z.color, height: "100%" }} />
        ))}
        {/* Score needle */}
        <div style={{
          position: "absolute",
          left: `${Math.min(98, lf.score)}%`,
          top: -2, width: 3, height: 14,
          background: color,
          borderRadius: 2,
          transform: "translateX(-50%)",
          boxShadow: `0 0 4px ${color}`,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", opacity: 0.5, marginBottom: 10 }}>
        <span>0</span><span>35</span><span>55</span><span>75</span><span>100</span>
      </div>

      {/* Component breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {components.map((c) => {
          const barCol = c.muted ? "var(--text-muted)" : ("barColor" in c && c.barColor) ? c.barColor : color;
          return (
          <div key={c.label} style={{ display: "grid", gridTemplateColumns: "64px 1fr 32px 80px", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.label}</span>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
              <div style={{
                height: "100%",
                width: `${(c.score / c.max) * 100}%`,
                background: barCol,
                borderRadius: 2,
                transition: "width 0.3s",
                opacity: c.muted ? 0.4 : 1,
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.muted ? "var(--text-muted)" : barCol, textAlign: "right" }}>
              {c.score}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7, fontStyle: c.muted ? "italic" : "normal" }}>
              {c.detail}
            </span>
          </div>
        );})}
      </div>

      {/* Rest bonus */}
      {lf.restBonus > 0 && (
        <div style={{
          marginTop: 10, padding: "6px 10px",
          background: "#22c55e12", border: "1px solid #22c55e30",
          borderRadius: 6, fontSize: 12, color: "#22c55e",
        }}>
          ✦ Full rest taken · −{lf.restBonus} pts recovery bonus applied
        </div>
      )}

      {/* Insight */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
        {lf.insight}
      </div>
    </div>
  );
}

function MetricChip({ label, value, dev, ok, higherBetter, color }: {
  label: string;
  value: string;
  dev: number | null;
  ok?: boolean;
  higherBetter?: boolean;
  color: string;
}) {
  const devStr = dev != null
    ? `${dev > 0 ? "+" : ""}${dev.toFixed(0)}%`
    : null;

  return (
    <span>
      <span style={{ color: "var(--text-muted)" }}>{label} </span>
      <span style={{ fontWeight: 600, color: "var(--text)" }}>{value}</span>
      {devStr && (
        <span style={{ marginLeft: 3, color, fontSize: 11 }}>({devStr})</span>
      )}
      {ok != null && !ok && (
        <span style={{ marginLeft: 3, color: "#f59e0b", fontSize: 11 }}>↓</span>
      )}
    </span>
  );
}
