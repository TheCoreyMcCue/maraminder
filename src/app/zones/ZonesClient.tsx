"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ZoneSet, ZoneKey, Zone } from "@/lib/types";
import { formatPaceRange, formatHrRange } from "@/lib/zones";
import { recalibrateZones } from "@/lib/planOps";

interface Props {
  currentZones: ZoneSet;
  allZones: ZoneSet[];
  currentWeekNo: number;
}

const ZONE_KEYS: ZoneKey[] = ["E", "S", "MP", "T", "I"];
const ZONE_COLORS: Record<ZoneKey, string> = {
  E: "var(--cat-easy)",
  S: "var(--cat-steady)",
  MP: "var(--cat-mp)",
  T: "var(--cat-threshold)",
  I: "var(--cat-vo2)",
};

export default function ZonesClient({ currentZones, allZones, currentWeekNo }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ZoneSet["zones"]>(
    JSON.parse(JSON.stringify(currentZones.zones))
  );
  const [effectiveWeek, setEffectiveWeek] = useState(currentWeekNo);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  function updateZoneField(key: ZoneKey, field: keyof Zone, value: string | number | undefined) {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSave() {
    if (!source.trim()) return;
    setSaving(true);
    await recalibrateZones(draft, effectiveWeek, source);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pace Zones</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            v{currentZones.version} · {currentZones.source} · effective from W{currentZones.effectiveWeek}
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Recalibrate
          </button>
        )}
      </div>

      {/* Current zones table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "50px 1fr 140px 160px 1fr",
          gap: 12,
          padding: "8px 16px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: "0.05em",
          borderBottom: "1px solid var(--border)",
          marginBottom: 8,
        }}>
          <span>ZONE</span>
          <span>LABEL</span>
          <span>PACE</span>
          <span>HR</span>
          <span>USE</span>
        </div>
        {ZONE_KEYS.map((key) => {
          const zone = currentZones.zones[key];
          const draftZone = draft[key];
          const color = ZONE_COLORS[key];
          return (
            <div key={key} style={{
              display: "grid",
              gridTemplateColumns: "50px 1fr 140px 160px 1fr",
              gap: 12,
              padding: "12px 16px",
              background: "var(--surface)",
              border: `1px solid var(--border)`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 8,
              marginBottom: 6,
              alignItems: "start",
            }}>
              <span style={{ fontWeight: 800, fontSize: 15, color }}>{key}</span>
              <span style={{ fontWeight: 600 }}>{zone.label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {key === "MP" ? (
                      <input
                        style={miniInput}
                        value={draftZone.pace ?? ""}
                        onChange={(e) => updateZoneField(key, "pace", e.target.value)}
                        placeholder="4:16"
                      />
                    ) : (
                      <>
                        <input style={miniInput} value={draftZone.paceLow ?? ""} onChange={(e) => updateZoneField(key, "paceLow", e.target.value)} placeholder="low" />
                        <input style={miniInput} value={draftZone.paceHigh ?? ""} onChange={(e) => updateZoneField(key, "paceHigh", e.target.value)} placeholder="high" />
                      </>
                    )}
                  </div>
                ) : formatPaceRange(zone)}
              </span>
              <span style={{ fontSize: 13 }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {key === "E" && <input style={miniInput} value={draftZone.hrMax ?? ""} onChange={(e) => updateZoneField(key, "hrMax", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="max HR" />}
                    {key === "I" && <input style={miniInput} value={draftZone.hrMin ?? ""} onChange={(e) => updateZoneField(key, "hrMin", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="min HR" />}
                    {(key === "S" || key === "MP" || key === "T") && (
                      <>
                        <input style={miniInput} value={draftZone.hrLow ?? ""} onChange={(e) => updateZoneField(key, "hrLow", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="low" />
                        <input style={miniInput} value={draftZone.hrHigh ?? ""} onChange={(e) => updateZoneField(key, "hrHigh", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="high" />
                      </>
                    )}
                  </div>
                ) : formatHrRange(zone)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {zoneDescription(key)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Edit controls */}
      {editing && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Recalibration details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>SOURCE NOTE *</span>
              <input
                style={inputStyle}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. W5 checkpoint, Sep 27 half"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>EFF. WEEK</span>
              <input
                type="number"
                style={inputStyle}
                value={effectiveWeek}
                onChange={(e) => setEffectiveWeek(parseInt(e.target.value))}
                min={1}
                max={13}
              />
            </label>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            All future planned sessions will re-price with these zones. Logged sessions keep their original snapshot.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEditing(false); setDraft(JSON.parse(JSON.stringify(currentZones.zones))); }} style={secondaryBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !source.trim()} style={{ ...primaryBtn, opacity: saving || !source.trim() ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Save new version"}
            </button>
          </div>
        </div>
      )}

      {/* Zone history */}
      {allZones.length > 1 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: "var(--text-muted)" }}>
            Zone history
          </div>
          {[...allZones].reverse().map((z) => (
            <div key={z.version} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <span style={{ fontWeight: 600 }}>v{z.version}</span>
                <span style={{ marginLeft: 12, fontSize: 13, color: "var(--text-muted)" }}>{z.source}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Effective W{z.effectiveWeek}
                {z.version === currentZones.version && (
                  <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 600 }}>current</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function zoneDescription(key: ZoneKey): string {
  const desc: Record<ZoneKey, string> = {
    E: "Most of your running. True easy — conversational.",
    S: "Moderate aerobic; long-run finishes, steady state.",
    MP: "Goal race pace. Should feel aerobic, controlled.",
    T: "Cruise intervals, tempo. Comfortably hard.",
    I: "Short reps only, by feel. Lowest priority.",
  };
  return desc[key];
}

const miniInput: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 6px",
  color: "var(--text)",
  fontSize: 12,
  width: "100%",
  outline: "none",
  fontFamily: "monospace",
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
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: 14,
  cursor: "pointer",
};
