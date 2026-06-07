"use client";
import { useState } from "react";
import type { Session, ZoneSet, Actual, ZoneKey } from "@/lib/types";
import { formatSessionTarget, computePaceFromDistTime } from "@/lib/zones";
import { logActual } from "@/lib/planOps";

interface Props {
  session: Session;
  zones: ZoneSet;
  onClose: () => void;
  onSaved: () => void;
}

const QUALITY_ZONES: ZoneKey[] = ["S", "MP", "T", "I"];

const ZONE_HR_LABELS: Record<string, string> = {
  S: "Steady HR",
  MP: "MP HR",
  T: "Threshold HR",
  I: "Interval HR",
};

export default function LogModal({ session, zones, onClose, onSaved }: Props) {
  const existing = session.actual;

  const [dist, setDist] = useState(existing?.distanceKm?.toString() ?? session.targetDistanceKm?.toString() ?? "");
  const [dur, setDur] = useState(existing?.durationMin?.toString() ?? session.targetDurationMin?.toString() ?? "");
  const [overallHr, setOverallHr] = useState(existing?.avgHr?.toString() ?? "");
  const [rpe, setRpe] = useState(existing?.rpe?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [stravaUrl, setStravaUrl] = useState(existing?.stravaUrl ?? "");
  const [tempC, setTempC] = useState(existing?.tempC?.toString() ?? "");
  const [wind, setWind] = useState(existing?.wind ?? "");
  const [dcHr1, setDcHr1] = useState(existing?.decoupling?.firstHalfHr?.toString() ?? "");
  const [dcHr2, setDcHr2] = useState(existing?.decoupling?.secondHalfHr?.toString() ?? "");
  const [dcPace, setDcPace] = useState(existing?.decoupling?.paceHeldKm ?? "");
  const [saving, setSaving] = useState(false);

  const showDecoupling = ["long", "mp"].includes(session.category);

  // Per-zone HR state — only for quality zones present in this session
  const sessionQualityZones = session.zoneRefs.filter((z): z is ZoneKey =>
    QUALITY_ZONES.includes(z as ZoneKey)
  );
  const [segmentHr, setSegmentHr] = useState<Partial<Record<ZoneKey, string>>>(
    () => Object.fromEntries(
      sessionQualityZones.map((z) => [z, existing?.segmentHr?.[z]?.toString() ?? ""])
    )
  );
  const [segmentPace, setSegmentPace] = useState<Partial<Record<ZoneKey, string>>>(
    () => Object.fromEntries(
      sessionQualityZones.map((z) => [z, existing?.segmentPace?.[z] ?? ""])
    )
  );

  const computedPace = dist && dur
    ? computePaceFromDistTime(parseFloat(dist), parseFloat(dur))
    : "—";

  async function handleSave() {
    if (!dist || !dur) return;
    setSaving(true);

    const builtSegmentHr: Partial<Record<ZoneKey, number>> = {};
    for (const [k, v] of Object.entries(segmentHr)) {
      if (v) builtSegmentHr[k as ZoneKey] = parseInt(v);
    }

    const builtSegmentPace: Partial<Record<ZoneKey, string>> = {};
    for (const [k, v] of Object.entries(segmentPace)) {
      if (v.trim()) builtSegmentPace[k as ZoneKey] = v.trim();
    }

    const actual: Omit<Actual, "targetSnapshot"> = {
      distanceKm: parseFloat(dist),
      durationMin: parseFloat(dur),
      avgPacePerKm: computedPace !== "—" ? computedPace : undefined,
      avgHr: overallHr ? parseInt(overallHr) : undefined,
      segmentHr: Object.keys(builtSegmentHr).length > 0 ? builtSegmentHr : undefined,
      segmentPace: Object.keys(builtSegmentPace).length > 0 ? builtSegmentPace : undefined,
      rpe: rpe ? parseInt(rpe) : undefined,
      notes: notes || undefined,
      stravaUrl: stravaUrl.trim() || undefined,
      tempC: tempC ? parseFloat(tempC) : undefined,
      wind: wind.trim() || undefined,
      decoupling: (dcHr1 || dcHr2 || dcPace) ? {
        firstHalfHr: dcHr1 ? parseInt(dcHr1) : undefined,
        secondHalfHr: dcHr2 ? parseInt(dcHr2) : undefined,
        paceHeldKm: dcPace.trim() || undefined,
      } : undefined,
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
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
          {formatSessionTarget(session, zones)}
        </div>

        {/* Distance + duration */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="DISTANCE (km)">
            <input type="number" step="0.1" value={dist}
              onChange={(e) => setDist(e.target.value)}
              style={inputStyle} placeholder={session.targetDistanceKm?.toString() ?? "0"} />
          </Field>
          <Field label="DURATION (min)">
            <input type="number" value={dur}
              onChange={(e) => setDur(e.target.value)}
              style={inputStyle} placeholder={session.targetDurationMin?.toString() ?? "0"} />
          </Field>
        </div>

        {computedPace !== "—" && (
          <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 14, fontWeight: 600 }}>
            Avg pace: {computedPace}/km
          </div>
        )}

        {/* Quality zone HR fields — shown when session has MP/T/I/S blocks */}
        {sessionQualityZones.length > 0 && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 10 }}>
              QUALITY BLOCK HR
            </div>
            {sessionQualityZones.map((z) => (
              <div key={z} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <Field label={`${ZONE_HR_LABELS[z] ?? z} HR (bpm)`}>
                  <input
                    type="number"
                    value={segmentHr[z] ?? ""}
                    onChange={(e) => setSegmentHr((prev) => ({ ...prev, [z]: e.target.value }))}
                    style={inputStyle}
                    placeholder="—"
                  />
                </Field>
                <Field label={`${ZONE_HR_LABELS[z] ?? z} Pace (/km)`}>
                  <input
                    type="text"
                    value={segmentPace[z] ?? ""}
                    onChange={(e) => setSegmentPace((prev) => ({ ...prev, [z]: e.target.value }))}
                    style={inputStyle}
                    placeholder="4:16"
                  />
                </Field>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              HR + pace during the quality blocks only — used for trend tracking.
            </div>
          </div>
        )}

        {/* Overall HR + RPE */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="OVERALL AVG HR (bpm)">
            <input type="number" value={overallHr}
              onChange={(e) => setOverallHr(e.target.value)}
              style={inputStyle} placeholder="—" />
          </Field>
          <Field label="RPE (1–10)">
            <input type="number" min={1} max={10} value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              style={inputStyle} placeholder="—" />
          </Field>
        </div>

        {/* Conditions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="TEMP (°C)">
            <input type="number" step="0.5" value={tempC} onChange={(e) => setTempC(e.target.value)}
              style={inputStyle} placeholder="—" />
          </Field>
          <Field label="WIND">
            <input type="text" value={wind} onChange={(e) => setWind(e.target.value)}
              style={inputStyle} placeholder="calm / light / strong" />
          </Field>
        </div>

        {/* Cardiac decoupling — long runs + MP sessions only */}
        {showDecoupling && (
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 10 }}>
              CARDIAC DECOUPLING
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Field label="1ST HALF HR">
                <input type="number" value={dcHr1} onChange={(e) => setDcHr1(e.target.value)}
                  style={inputStyle} placeholder="168" />
              </Field>
              <Field label="2ND HALF HR">
                <input type="number" value={dcHr2} onChange={(e) => setDcHr2(e.target.value)}
                  style={inputStyle} placeholder="175" />
              </Field>
              <Field label="PACE HELD">
                <input type="text" value={dcPace} onChange={(e) => setDcPace(e.target.value)}
                  style={inputStyle} placeholder="4:16" />
              </Field>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Durability signal — HR drift at constant pace.
            </div>
          </div>
        )}

        {/* Notes */}
        <Field label="NOTES" style={{ marginBottom: 12 }}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: "vertical" }}
            placeholder="How did it feel?" />
        </Field>

        {/* Strava link */}
        <Field label="STRAVA LINK" style={{ marginBottom: 20 }}>
          <input
            type="url"
            value={stravaUrl}
            onChange={(e) => setStravaUrl(e.target.value)}
            style={inputStyle}
            placeholder="https://www.strava.com/activities/..."
            inputMode="url"
            autoCapitalize="none"
          />
        </Field>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !dist || !dur}
            style={{ ...primaryBtn, opacity: saving || !dist || !dur ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
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
