"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types";
import { splitSessionAction } from "@/lib/planActions";
import { minutesToTimeStr } from "@/lib/zones";

interface WeekDate {
  date: string;
  dow: string;
}

interface Props {
  session: Session;
  planId: string;
  weekDates: WeekDate[];
  onClose: () => void;
}

function half(n: number) {
  return Math.round((n / 2) * 10) / 10;
}
function parseDist(s: string) {
  return parseFloat(s.replace(",", ".")) || 0;
}
function parseDur(s: string) {
  return parseInt(s) || 0;
}

export default function SplitSessionModal({
  session,
  planId,
  weekDates,
  onClose,
}: Props) {
  const router = useRouter();

  const totalDur = session.targetDurationMin ?? 0;
  const totalDist = session.targetDistanceKm ?? 0;

  const [p1Title, setP1Title] = useState(session.title + " (Part 1)");
  const [p1Dist, setP1Dist] = useState(
    totalDist ? String(half(totalDist)) : "",
  );
  const [p1Dur, setP1Dur] = useState(
    totalDur ? String(Math.round(totalDur / 2)) : "",
  );

  const [p2Title, setP2Title] = useState(session.title + " (Part 2)");
  const [p2Dist, setP2Dist] = useState(
    totalDist ? String(totalDist - half(totalDist)) : "",
  );
  const [p2Dur, setP2Dur] = useState(
    totalDur ? String(totalDur - Math.round(totalDur / 2)) : "",
  );
  const [p2Date, setP2Date] = useState(session.date);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview values
  const p1DistN = parseDist(p1Dist);
  const p1DurN = parseDur(p1Dur);
  const p2DistN = parseDist(p2Dist);
  const p2DurN = parseDur(p2Dur);
  const p2Dow =
    weekDates.find((d) => d.date === p2Date)?.dow ?? session.dayOfWeek;

  async function handleSplit() {
    setSaving(true);
    setError(null);
    const result = await splitSessionAction(planId, session.sk, {
      part1: {
        title: p1Title.trim() || session.title,
        targetDurationMin: p1DurN > 0 ? p1DurN : undefined,
        targetDistanceKm: p1DistN > 0 ? p1DistN : undefined,
      },
      part2: {
        title: p2Title.trim() || session.title,
        targetDurationMin: p2DurN > 0 ? p2DurN : undefined,
        targetDistanceKm: p2DistN > 0 ? p2DistN : undefined,
        date: p2Date,
      },
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Split session
        </div>
        <div
          style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}
        >
          {session.dayOfWeek} · {session.title}
        </div>

        {/* Live preview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 20,
            padding: "10px 12px",
            background: "var(--surface-2)",
            borderRadius: 8,
          }}
        >
          {[
            {
              label: "PART 1",
              title: p1Title,
              distN: p1DistN,
              durN: p1DurN,
              dow: session.dayOfWeek,
            },
            {
              label: "PART 2",
              title: p2Title,
              distN: p2DistN,
              durN: p2DurN,
              dow: p2Dow,
              moved: p2Date !== session.date,
            },
          ].map(({ label, title, distN, durN, dow, moved }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  lineHeight: 1.3,
                }}
              >
                {title || "—"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 3,
                }}
              >
                {distN > 0 && `${distN}km`}
                {distN > 0 && durN > 0 && " · "}
                {durN > 0 && minutesToTimeStr(durN)}
                {moved && ` · ${dow}`}
              </div>
            </div>
          ))}
        </div>

        {/* Part 1 */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>PART 1</div>
          <input
            type="text"
            value={p1Title}
            onChange={(e) => setP1Title(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Part 1 title"
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>KM</span>
              <input
                type="number"
                step="0.5"
                inputMode="decimal"
                value={p1Dist}
                onChange={(e) => setP1Dist(e.target.value)}
                style={inputStyle}
                placeholder="—"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>MIN</span>
              <input
                type="number"
                inputMode="numeric"
                value={p1Dur}
                onChange={(e) => setP1Dur(e.target.value)}
                style={inputStyle}
                placeholder="—"
              />
            </label>
          </div>
        </div>

        {/* Part 2 */}
        <div style={{ marginBottom: 20 }}>
          <div style={sectionLabel}>PART 2</div>
          <input
            type="text"
            value={p2Title}
            onChange={(e) => setP2Title(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Part 2 title"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>KM</span>
              <input
                type="number"
                step="0.5"
                inputMode="decimal"
                value={p2Dist}
                onChange={(e) => setP2Dist(e.target.value)}
                style={inputStyle}
                placeholder="—"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>MIN</span>
              <input
                type="number"
                inputMode="numeric"
                value={p2Dur}
                onChange={(e) => setP2Dur(e.target.value)}
                style={inputStyle}
                placeholder="—"
              />
            </label>
          </div>

          {/* Day picker for Part 2 */}
          <div style={{ ...fieldLabel, marginBottom: 6 }}>DATE FOR PART 2</div>
          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}
          >
            {weekDates.map(({ date, dow }) => (
              <button
                key={date}
                onClick={() => setP2Date(date)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  border: `1px solid ${p2Date === date ? "var(--accent)" : "var(--border)"}`,
                  background:
                    p2Date === date ? "var(--accent)18" : "var(--surface-2)",
                  color:
                    p2Date === date ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: p2Date === date ? 600 : 400,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {dow}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, fontSize: 13, color: "#ef4444" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}
          >
            {saving ? "Splitting…" : "Split session"}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  letterSpacing: "0.05em",
  marginBottom: 8,
};
const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  width: "100%",
};
const primaryBtn: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: 15,
  cursor: "pointer",
};
