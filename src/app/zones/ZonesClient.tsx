"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ZoneSet, ZoneKey, Zone, PersonalBaseline } from "@/lib/types";
import { formatPaceRange, formatHrRange } from "@/lib/zones";
import { recalibrateZones } from "@/lib/planOps";
import { savePersonalBaseline } from "@/lib/baselineOps";

interface Props {
  currentZones: ZoneSet;
  allZones: ZoneSet[];
  currentWeekNo: number;
  planId: string;
  baseline: PersonalBaseline;
}

const ZONE_KEYS: ZoneKey[] = ["E", "S", "MP", "T", "I"];
const ZONE_COLORS: Record<ZoneKey, string> = {
  E: "var(--cat-easy)",
  S: "var(--cat-steady)",
  MP: "var(--cat-mp)",
  T: "var(--cat-threshold)",
  I: "var(--cat-vo2)",
};

const ZONE_DESC: Record<ZoneKey, string> = {
  E: "Most of your running. True easy — conversational.",
  S: "Moderate aerobic; long-run finishes, steady state.",
  MP: "Goal race pace. Should feel aerobic, controlled.",
  T: "Cruise intervals, tempo. Comfortably hard.",
  I: "Short reps only, by feel. Lowest priority.",
};

export default function ZonesClient({ currentZones, allZones, currentWeekNo, planId, baseline }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ZoneSet["zones"]>(
    JSON.parse(JSON.stringify(currentZones.zones))
  );
  const [effectiveWeek, setEffectiveWeek] = useState(currentWeekNo);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [ftp, setFtp] = useState(baseline.ftpW?.toString() ?? "");
  const [typicalHours, setTypicalHours] = useState(baseline.typicalWeeklyHours?.toString() ?? "");
  const [baselineSaving, setBaselineSaving] = useState(false);

  async function handleSaveBaseline() {
    setBaselineSaving(true);
    await savePersonalBaseline({
      hrv: baseline.hrv, rhr: baseline.rhr,
      sleepTargetHours: baseline.sleepTargetHours,
      ftpW: ftp ? parseInt(ftp) : undefined,
      typicalWeeklyHours: typicalHours ? parseFloat(typicalHours.replace(",", ".")) : undefined,
      note: baseline.note,
    });
    setBaselineSaving(false);
    router.refresh();
  }

  function updateZoneField(key: ZoneKey, field: keyof Zone, value: string | number | undefined) {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave() {
    if (!source.trim()) return;
    setSaving(true);
    await recalibrateZones(planId, draft, effectiveWeek, source);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="main-content" style={{ padding: "16px 16px 0", maxWidth: 700, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Pace Zones</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            v{currentZones.version} · {currentZones.source} · from W{currentZones.effectiveWeek}
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              minHeight: 36,
            }}
          >
            Recalibrate
          </button>
        )}
      </div>

      {/* Zone cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {ZONE_KEYS.map((key) => {
          const zone = currentZones.zones[key];
          const draftZone = draft[key];
          const color = ZONE_COLORS[key];
          return (
            <div key={key} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${color}`,
              borderRadius: 10,
              padding: "14px 16px",
            }}>
              {/* Top row: letter + label + pace + HR */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 18, color, minWidth: 24 }}>{key}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{zone.label}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {editing ? (
                    <PaceInputs zoneKey={key} draftZone={draftZone} updateZoneField={updateZoneField} />
                  ) : (
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text)" }}>
                      {formatPaceRange(zone)}
                    </span>
                  )}
                  {editing ? (
                    <HrInputs zoneKey={key} draftZone={draftZone} updateZoneField={updateZoneField} />
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {formatHrRange(zone)}
                    </span>
                  )}
                </span>
              </div>
              {/* Description */}
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {ZONE_DESC[key]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recalibrate form */}
      {editing && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 18,
          marginBottom: 24,
        }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Save new version</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>SOURCE NOTE *</span>
              <input
                style={inputStyle}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. W5 checkpoint, Sep 27 half"
              />
            </label>
            <label style={{ width: 90, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>EFF. WEEK</span>
              <input
                type="number"
                style={inputStyle}
                value={effectiveWeek}
                onChange={(e) => setEffectiveWeek(parseInt(e.target.value))}
                min={1} max={13}
              />
            </label>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
            Future planned sessions re-price automatically. Logged sessions keep their snapshot.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setEditing(false); setDraft(JSON.parse(JSON.stringify(currentZones.zones))); }}
              style={secondaryBtn}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !source.trim()}
              style={{ ...primaryBtn, opacity: saving || !source.trim() ? 0.5 : 1 }}
            >
              {saving ? "Saving…" : "Save version"}
            </button>
          </div>
        </div>
      )}

      {/* Personal training baseline */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderLeft: "3px solid #0ea5e9", borderRadius: 10, padding: "14px 16px", marginBottom: 24,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Personal Training Baseline</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Seeds the load index with your known training history so it's accurate from day 1, not after 4 weeks of logging.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TYPICAL WEEKLY HOURS</span>
            <input type="text" inputMode="decimal" value={typicalHours} onChange={(e) => setTypicalHours(e.target.value)}
              style={inputStyle} placeholder="e.g. 8" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>CYCLING FTP (WATTS)</span>
            <input type="number" inputMode="numeric" value={ftp} onChange={(e) => setFtp(e.target.value)}
              style={inputStyle} placeholder="e.g. 250" />
          </label>
        </div>
        <button
          onClick={handleSaveBaseline}
          disabled={baselineSaving}
          style={{ ...primaryBtn, minHeight: 40, fontSize: 13, opacity: baselineSaving ? 0.5 : 1 }}
        >
          {baselineSaving ? "Saving…" : "Save baseline"}
        </button>
        {(baseline.typicalWeeklyHours || baseline.ftpW) && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
            {baseline.typicalWeeklyHours && `Seeded chronic load: ~${baseline.typicalWeeklyHours}h/week`}
            {baseline.ftpW && baseline.typicalWeeklyHours && " · "}
            {baseline.ftpW && `FTP ${baseline.ftpW}W · Zone 2 ≈ ${Math.round(baseline.ftpW * 0.56)}–${Math.round(baseline.ftpW * 0.75)}W`}
          </div>
        )}
      </div>

      {/* Zone history */}
      {allZones.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.04em" }}>
            HISTORY
          </div>
          {[...allZones].reverse().map((z) => (
            <div key={z.version} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>v{z.version}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {z.source}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                W{z.effectiveWeek}
                {z.version === currentZones.version && (
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>current</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline edit sub-components ────────────────────────────

function PaceInputs({ zoneKey, draftZone, updateZoneField }: {
  zoneKey: ZoneKey;
  draftZone: Zone;
  updateZoneField: (k: ZoneKey, f: keyof Zone, v: string | number | undefined) => void;
}) {
  if (zoneKey === "MP") {
    return (
      <input style={miniInput} value={draftZone.pace ?? ""} placeholder="4:16"
        onChange={(e) => updateZoneField(zoneKey, "pace", e.target.value)} />
    );
  }
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <input style={{ ...miniInput, width: 54 }} value={draftZone.paceLow ?? ""} placeholder="low"
        onChange={(e) => updateZoneField(zoneKey, "paceLow", e.target.value)} />
      <input style={{ ...miniInput, width: 54 }} value={draftZone.paceHigh ?? ""} placeholder="high"
        onChange={(e) => updateZoneField(zoneKey, "paceHigh", e.target.value)} />
    </div>
  );
}

function HrInputs({ zoneKey, draftZone, updateZoneField }: {
  zoneKey: ZoneKey;
  draftZone: Zone;
  updateZoneField: (k: ZoneKey, f: keyof Zone, v: string | number | undefined) => void;
}) {
  if (zoneKey === "E") {
    return (
      <input style={{ ...miniInput, width: 60 }} value={draftZone.hrMax ?? ""} placeholder="max"
        onChange={(e) => updateZoneField(zoneKey, "hrMax", e.target.value ? parseInt(e.target.value) : undefined)} />
    );
  }
  if (zoneKey === "I") {
    return (
      <input style={{ ...miniInput, width: 60 }} value={draftZone.hrMin ?? ""} placeholder="min"
        onChange={(e) => updateZoneField(zoneKey, "hrMin", e.target.value ? parseInt(e.target.value) : undefined)} />
    );
  }
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <input style={{ ...miniInput, width: 50 }} value={draftZone.hrLow ?? ""} placeholder="low"
        onChange={(e) => updateZoneField(zoneKey, "hrLow", e.target.value ? parseInt(e.target.value) : undefined)} />
      <input style={{ ...miniInput, width: 50 }} value={draftZone.hrHigh ?? ""} placeholder="high"
        onChange={(e) => updateZoneField(zoneKey, "hrHigh", e.target.value ? parseInt(e.target.value) : undefined)} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const miniInput: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "4px 6px",
  color: "var(--text)",
  fontSize: 12,
  outline: "none",
  fontFamily: "monospace",
  width: 64,
};

const inputStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "9px 11px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: 14,
  cursor: "pointer",
};
