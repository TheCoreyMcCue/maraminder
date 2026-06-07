"use client";
import { useState } from "react";
import type { Session, ZoneSet, Actual } from "@/lib/types";
import { formatSessionTarget, computePaceFromDistTime } from "@/lib/zones";
import { logActual } from "@/lib/planOps";

interface Props {
  session: Session;
  zones: ZoneSet;
  onClose: () => void;
  onSaved: () => void;
}

export default function LogModal({ session, zones, onClose, onSaved }: Props) {
  const existing = session.actual;
  const [dist, setDist] = useState(existing?.distanceKm?.toString() ?? session.targetDistanceKm?.toString() ?? "");
  const [dur, setDur] = useState(existing?.durationMin?.toString() ?? session.targetDurationMin?.toString() ?? "");
  const [hr, setHr] = useState(existing?.avgHr?.toString() ?? "");
  const [rpe, setRpe] = useState(existing?.rpe?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const computedPace =
    dist && dur ? computePaceFromDistTime(parseFloat(dist), parseFloat(dur)) : "—";

  async function handleSave() {
    if (!dist || !dur) return;
    setSaving(true);
    const actual: Omit<Actual, "targetSnapshot"> = {
      distanceKm: parseFloat(dist),
      durationMin: parseFloat(dur),
      avgPacePerKm: computedPace !== "—" ? computedPace : undefined,
      avgHr: hr ? parseInt(hr) : undefined,
      rpe: rpe ? parseInt(rpe) : undefined,
      notes: notes || undefined,
    };
    await logActual(session.sk, actual);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{session.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          {formatSessionTarget(session, zones)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>DISTANCE (km)</span>
            <input
              type="number"
              step="0.1"
              value={dist}
              onChange={(e) => setDist(e.target.value)}
              style={inputStyle}
              placeholder={session.targetDistanceKm?.toString() ?? "0"}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>DURATION (min)</span>
            <input
              type="number"
              value={dur}
              onChange={(e) => setDur(e.target.value)}
              style={inputStyle}
              placeholder={session.targetDurationMin?.toString() ?? "0"}
            />
          </label>
        </div>

        {computedPace !== "—" && (
          <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 12, fontWeight: 600 }}>
            Avg pace: {computedPace}/km
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>AVG HR (bpm)</span>
            <input type="number" value={hr} onChange={(e) => setHr(e.target.value)} style={inputStyle} placeholder="—" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>RPE (1–10)</span>
            <input type="number" min={1} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} style={inputStyle} placeholder="—" />
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>NOTES</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="How did it feel?"
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !dist || !dur}
            style={{
              ...primaryBtn,
              opacity: saving || !dist || !dur ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  padding: "0 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: 15,
  cursor: "pointer",
};
