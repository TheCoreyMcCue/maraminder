"use client";
import { useState } from "react";
import type { Session, ZoneSet, Actual, ZoneKey } from "@/lib/types";
import { formatSessionTarget, computePaceFromDistTime, parseTimeToMinutes, minutesToTimeStr } from "@/lib/zones";
import { logActual } from "@/lib/planOps";

interface Props {
  session: Session;
  zones: ZoneSet;
  ftpW?: number;
  onClose: () => void;
  onSaved: () => void;
}

const QUALITY_ZONES: ZoneKey[] = ["S", "MP", "T", "I"];

// Normalise decimal separator before parsing — handles locales where "," is used instead of "."
const parseDecimal = (s: string) => parseFloat(s.replace(",", "."));

const ZONE_HR_LABELS: Record<string, string> = {
  S: "Steady HR",
  MP: "MP HR",
  T: "Threshold HR",
  I: "Interval HR",
};

// Fallback quality zones per category when zoneRefs don't specify any
const CATEGORY_QUALITY_ZONES: Partial<Record<string, ZoneKey[]>> = {
  mp:        ["MP"],
  threshold: ["T"],
  vo2:       ["I"],
  long:      ["MP"],
  steady:    ["S"],
  brick:     ["MP"],
};

export default function LogModal({ session, zones, ftpW, onClose, onSaved }: Props) {
  const existing = session.actual;

  const [dist, setDist] = useState(existing?.distanceKm?.toString() ?? session.targetDistanceKm?.toString() ?? "");
  const [dur, setDur] = useState(
    existing?.durationMin
      ? minutesToTimeStr(existing.durationMin)
      : session.targetDurationMin
      ? minutesToTimeStr(session.targetDurationMin)
      : ""
  );
  const [overallHr, setOverallHr] = useState(existing?.avgHr?.toString() ?? "");
  const [rpe, setRpe] = useState(existing?.rpe?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [stravaUrl, setStravaUrl] = useState(existing?.stravaUrl ?? "");
  const [tempC, setTempC] = useState(existing?.tempC?.toString() ?? "");
  const [wind, setWind] = useState(existing?.wind ?? "");
  const [avgPowerW, setAvgPowerW] = useState(existing?.avgPowerW?.toString() ?? "");
  const [dcHr1, setDcHr1] = useState(existing?.decoupling?.firstHalfHr?.toString() ?? "");
  const [dcHr2, setDcHr2] = useState(existing?.decoupling?.secondHalfHr?.toString() ?? "");
  const [dcPace, setDcPace] = useState(existing?.decoupling?.paceHeldKm ?? "");
  const [saving, setSaving] = useState(false);

  const isCycling = session.category === "bike" || session.category === "brick";
  const showDecoupling = ["long", "mp"].includes(session.category);

  // Quality zones to show in the block section.
  // Anchor sessions show all 4 quality zones — they often have multiple effort layers
  // (e.g. an easy run with 2km @ MP: zoneRefs only has S but user ran MP too).
  // Fill sessions use the narrower zoneRefs / category / existing-data fallback.
  const sessionQualityZones = (() => {
    if (session.type === "anchor" && !["rest", "bike"].includes(session.category)) {
      return QUALITY_ZONES;
    }
    const fromRefs = session.zoneRefs.filter((z): z is ZoneKey =>
      QUALITY_ZONES.includes(z as ZoneKey)
    );
    if (fromRefs.length > 0) return fromRefs;
    const fromCat = (CATEGORY_QUALITY_ZONES[session.category] ?? []) as ZoneKey[];
    if (fromCat.length > 0) return fromCat;
    const fromExisting = [
      ...Object.keys(existing?.segmentHr ?? {}),
      ...Object.keys(existing?.segmentPace ?? {}),
    ].filter((z): z is ZoneKey => QUALITY_ZONES.includes(z as ZoneKey));
    return [...new Set(fromExisting)];
  })();

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
    ? computePaceFromDistTime(parseDecimal(dist), parseTimeToMinutes(dur))
    : "—";

  async function handleSave() {
    if (!dist || !dur || !(parseTimeToMinutes(dur) > 0)) return;
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
      distanceKm: parseDecimal(dist),
      durationMin: parseTimeToMinutes(dur),
      avgPacePerKm: computedPace !== "—" ? computedPace : undefined,
      avgHr: overallHr ? parseInt(overallHr) : undefined,
      segmentHr: Object.keys(builtSegmentHr).length > 0 ? builtSegmentHr : undefined,
      segmentPace: Object.keys(builtSegmentPace).length > 0 ? builtSegmentPace : undefined,
      rpe: rpe ? parseInt(rpe) : undefined,
      notes: notes || undefined,
      stravaUrl: stravaUrl.trim() || undefined,
      tempC: tempC ? parseDecimal(tempC) : undefined,
      wind: wind.trim() || undefined,
      avgPowerW: avgPowerW ? parseInt(avgPowerW) : undefined,
      decoupling: (dcHr1 || dcHr2 || dcPace) ? {
        firstHalfHr: dcHr1 ? parseInt(dcHr1) : undefined,
        secondHalfHr: dcHr2 ? parseInt(dcHr2) : undefined,
        paceHeldKm: dcPace.trim() || undefined,
      } : undefined,
    };

    await logActual(session.pk, session.sk, actual);
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
            <input type="text" inputMode="decimal" value={dist}
              onChange={(e) => setDist(e.target.value)}
              style={inputStyle} placeholder={session.targetDistanceKm?.toString() ?? "0"} />
          </Field>
          <Field label="DURATION (h:mm:ss)">
            <input type="text" inputMode="numeric" value={dur}
              onChange={(e) => setDur(e.target.value)}
              style={inputStyle} placeholder="1:03:25" />
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
                    inputMode="numeric"
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
            <input type="number" inputMode="numeric" value={overallHr}
              onChange={(e) => setOverallHr(e.target.value)}
              style={inputStyle} placeholder="—" />
          </Field>
          <Field label="RPE (1–10)">
            <input type="number" inputMode="numeric" min={1} max={10} value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              style={inputStyle} placeholder="—" />
          </Field>
        </div>

        {/* Conditions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="TEMP (°C)">
            <input type="text" inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)}
              style={inputStyle} placeholder="—" />
          </Field>
          <Field label="WIND">
            <input type="text" value={wind} onChange={(e) => setWind(e.target.value)}
              style={inputStyle} placeholder="calm / light / strong" />
          </Field>
        </div>

        {/* Power — bike / brick sessions only */}
        {isCycling && (
          <PowerSection
            avgPowerW={avgPowerW}
            setAvgPowerW={setAvgPowerW}
            durationMin={dur}
            ftpW={ftpW}
            inputStyle={inputStyle}
          />
        )}

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
                <input type="number" inputMode="numeric" value={dcHr1} onChange={(e) => setDcHr1(e.target.value)}
                  style={inputStyle} placeholder="168" />
              </Field>
              <Field label="2ND HALF HR">
                <input type="number" inputMode="numeric" value={dcHr2} onChange={(e) => setDcHr2(e.target.value)}
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
          <button onClick={handleSave} disabled={saving || !dist || !(parseTimeToMinutes(dur) > 0)}
            style={{ ...primaryBtn, opacity: saving || !dist || !(parseTimeToMinutes(dur) > 0) ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Power section (bike / brick only) ────────────────────

function PowerSection({ avgPowerW, setAvgPowerW, durationMin, ftpW, inputStyle }: {
  avgPowerW: string;
  setAvgPowerW: (v: string) => void;
  durationMin: string;
  ftpW?: number;
  inputStyle: React.CSSProperties;
}) {
  const power = avgPowerW ? parseInt(avgPowerW) : null;
  const dur = durationMin ? parseTimeToMinutes(durationMin) : null;

  // TSS = (durationHours × (avgPower/FTP)²) × 100
  const tss = power && dur && ftpW
    ? Math.round((dur / 60) * Math.pow(power / ftpW, 2) * 100)
    : null;
  const IF = power && ftpW ? (power / ftpW).toFixed(2) : null;

  return (
    <div style={{
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "12px 14px", marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 10 }}>
        POWER
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>AVG POWER (W)</span>
          <input type="number" inputMode="numeric" value={avgPowerW} onChange={(e) => setAvgPowerW(e.target.value)}
            style={inputStyle} placeholder="—" />
        </label>
        {/* Live TSS + IF when FTP is set */}
        {ftpW && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TSS / IF</span>
            <div style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}>
              {tss != null && IF != null
                ? <><span style={{ fontWeight: 700 }}>{tss}</span> <span style={{ color: "var(--text-muted)", fontSize: 12 }}>TSS · IF {IF}</span></>
                : <span style={{ color: "var(--text-muted)" }}>enter power</span>
              }
            </div>
          </div>
        )}
      </div>
      {!ftpW && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Set your FTP in Zones → personal baseline to see TSS and IF.
        </div>
      )}
      {ftpW && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          vs FTP {ftpW}W · IF &lt;0.75 = recovery, 0.75–0.90 = aerobic, &gt;1.0 = above threshold
        </div>
      )}
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
