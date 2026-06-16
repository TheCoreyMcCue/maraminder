"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionCategory, ZoneKey } from "@/lib/types";
import { addSessionAction } from "@/lib/planActions";

interface Props {
  planId: string;
  weekNo: number;
  date: string;
  existingCount: number;
  onClose: () => void;
}

const CATEGORY_OPTIONS: { value: SessionCategory; label: string }[] = [
  { value: "easy",      label: "Easy run" },
  { value: "steady",    label: "Steady" },
  { value: "long",      label: "Long run" },
  { value: "mp",        label: "Marathon pace" },
  { value: "threshold", label: "Threshold" },
  { value: "vo2",       label: "VO2 / Intervals" },
  { value: "bike",      label: "Bike" },
  { value: "brick",     label: "Brick" },
  { value: "rest",      label: "Rest" },
];

const DEFAULT_ZONE_REFS: Partial<Record<SessionCategory, ZoneKey[]>> = {
  easy:      ["E"],
  steady:    ["E", "S"],
  mp:        ["E", "MP"],
  threshold: ["E", "T"],
  vo2:       ["E", "I"],
  long:      ["E"],
  rest:      [],
  bike:      [],
  brick:     [],
};

const ALL_ZONES: { key: ZoneKey; label: string }[] = [
  { key: "E",  label: "Easy" },
  { key: "S",  label: "Steady" },
  { key: "MP", label: "Marathon" },
  { key: "T",  label: "Threshold" },
  { key: "I",  label: "Interval" },
];

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateToDow(iso: string) {
  return DOW_NAMES[new Date(iso + "T12:00:00").getDay()];
}

export default function AddSessionModal({ planId, weekNo, date, existingCount, onClose }: Props) {
  const router = useRouter();
  const dow = dateToDow(date);

  const [category, setCategory] = useState<SessionCategory>("easy");
  const [title, setTitle]       = useState("Easy run");
  const [structure, setStructure] = useState("");
  const [distKm, setDistKm]     = useState("");
  const [durMin, setDurMin]     = useState("");
  const [zoneRefs, setZoneRefs] = useState<ZoneKey[]>(["E"]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  function handleCategoryChange(cat: SessionCategory) {
    const oldLabel = CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? "";
    setCategory(cat);
    if (title === oldLabel || title === "") {
      setTitle(CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? "");
    }
    setZoneRefs(DEFAULT_ZONE_REFS[cat] ?? []);
  }

  function toggleZone(z: ZoneKey) {
    setZoneRefs((prev) => prev.includes(z) ? prev.filter((k) => k !== z) : [...prev, z]);
  }

  async function submit(allowSameDay: boolean) {
    setSaving(true);
    setError(null);
    const result = await addSessionAction(
      planId,
      {
        weekNo,
        date,
        category,
        title: title.trim() || "Session",
        structure: structure.trim() || undefined,
        zoneRefs,
        targetDistanceKm: distKm ? parseFloat(distKm.replace(",", ".")) : undefined,
        targetDurationMin: durMin ? parseInt(durMin) : undefined,
      },
      { allowSameDay }
    );
    setSaving(false);

    if (!result.ok) {
      if (result.code === "SAME_DAY_CONFLICT") {
        setNeedsConfirm(true);
      } else {
        setError(result.message);
      }
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Add session</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
          {dow} · {date} · W{weekNo}
        </div>

        {needsConfirm ? (
          // ── Same-day confirm step ─────────────────────────────────────────
          <div>
            <div style={{
              padding: "12px 14px", background: "var(--surface-2)",
              borderRadius: 8, marginBottom: 20, fontSize: 14, lineHeight: 1.6,
            }}>
              <strong>{dow}</strong> already has {existingCount} session{existingCount !== 1 ? "s" : ""}.
              Add a second session on this day?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setNeedsConfirm(false)} style={secondaryBtn}>Back</button>
              <button
                onClick={() => submit(true)}
                disabled={saving}
                style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "Adding…" : "Yes, add it"}
              </button>
            </div>
          </div>
        ) : (
          // ── Main form ─────────────────────────────────────────────────────
          <>
            {/* Category */}
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>SESSION TYPE</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleCategoryChange(opt.value)}
                    style={{
                      padding: "8px 10px", borderRadius: 8, textAlign: "left",
                      border: `1px solid ${category === opt.value ? "var(--accent)" : "var(--border)"}`,
                      background: category === opt.value ? "var(--accent)18" : "var(--surface-2)",
                      color: category === opt.value ? "var(--accent)" : "var(--text-muted)",
                      fontSize: 13, fontWeight: category === opt.value ? 600 : 400,
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              <span style={fieldLabel}>TITLE</span>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                style={inputStyle} placeholder="e.g. Easy recovery run"
              />
            </label>

            {/* Description */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              <span style={fieldLabel}>DESCRIPTION</span>
              <textarea
                value={structure} onChange={(e) => setStructure(e.target.value)}
                rows={2} style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Optional workout description"
              />
            </label>

            {/* Zone refs */}
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>ZONES</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {ALL_ZONES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleZone(key)}
                    style={{
                      padding: "5px 11px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${zoneRefs.includes(key) ? "var(--accent)" : "var(--border)"}`,
                      background: zoneRefs.includes(key) ? "var(--accent)18" : "var(--surface-2)",
                      color: zoneRefs.includes(key) ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {key} – {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Targets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={fieldLabel}>TARGET KM</span>
                <input type="number" step="0.5" inputMode="decimal"
                  value={distKm} onChange={(e) => setDistKm(e.target.value)}
                  style={inputStyle} placeholder="—" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={fieldLabel}>TARGET MIN</span>
                <input type="number" inputMode="numeric"
                  value={durMin} onChange={(e) => setDurMin(e.target.value)}
                  style={inputStyle} placeholder="—" />
              </label>
            </div>

            {error && (
              <div style={{ marginBottom: 12, fontSize: 13, color: "#ef4444", lineHeight: 1.4 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={secondaryBtn}>Cancel</button>
              <button
                onClick={() => submit(false)}
                disabled={saving}
                style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "Adding…" : "Add session"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "8px 10px", color: "var(--text)",
  fontSize: 14, outline: "none", width: "100%",
};
const primaryBtn: React.CSSProperties = {
  flex: 1, minHeight: 44, padding: "0 16px", borderRadius: 8,
  border: "none", background: "var(--accent)", color: "#fff",
  fontWeight: 600, fontSize: 15, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 14px", borderRadius: 8,
  border: "1px solid var(--border)", background: "transparent",
  color: "var(--text-muted)", fontSize: 15, cursor: "pointer",
};
