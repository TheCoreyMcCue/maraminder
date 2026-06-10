"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, SessionCategory, ZoneKey } from "@/lib/types";
import { updateSession } from "@/lib/planOps";

interface Props {
  session: Session;
  onClose: () => void;
}

// Default zone refs per category
const DEFAULT_ZONE_REFS: Partial<Record<SessionCategory, ZoneKey[]>> = {
  easy:      ["E"],
  steady:    ["E", "S"],
  mp:        ["E", "MP"],
  threshold: ["E", "T"],
  vo2:       ["E", "I"],
  long:      ["E"],
  rest:      [],
  race:      [],
  bike:      [],
  brick:     [],
};

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
  { value: "race",      label: "Race" },
];

export default function EditSessionModal({ session, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<SessionCategory>(session.category);
  const [title, setTitle] = useState(session.title);
  const [structure, setStructure] = useState(session.structure);
  const [distKm, setDistKm] = useState(session.targetDistanceKm?.toString() ?? "");
  const [durMin, setDurMin] = useState(session.targetDurationMin?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateSession(session.pk, session.sk, {
      category,
      title: title.trim() || session.title,
      structure: structure.trim() || session.structure,
      targetDistanceKm: distKm ? parseFloat(distKm) : undefined,
      targetDurationMin: durMin ? parseInt(durMin) : undefined,
      zoneRefs: DEFAULT_ZONE_REFS[category] ?? [],
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Edit session</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
          {session.dayOfWeek} · W{session.weekNo}
        </div>

        {/* Category */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>
            SESSION TYPE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setCategory(opt.value);
                  // Auto-fill title if it hasn't been manually changed
                  if (title === session.title) setTitle(opt.label);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${category === opt.value ? "var(--accent)" : "var(--border)"}`,
                  background: category === opt.value ? "var(--accent)18" : "var(--surface-2)",
                  color: category === opt.value ? "var(--accent)" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: category === opt.value ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TITLE</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Easy run with friend"
          />
        </label>

        {/* Structure */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>DESCRIPTION</span>
          <textarea
            value={structure}
            onChange={(e) => setStructure(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="What are you doing?"
          />
        </label>

        {/* Targets */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TARGET KM</span>
            <input type="number" step="0.5" inputMode="decimal" value={distKm}
              onChange={(e) => setDistKm(e.target.value)} style={inputStyle} placeholder="—" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TARGET MIN</span>
            <input type="number" inputMode="numeric" value={durMin}
              onChange={(e) => setDurMin(e.target.value)} style={inputStyle} placeholder="—" />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
