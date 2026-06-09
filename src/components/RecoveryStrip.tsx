"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyRecovery, RecoveryReading, RecoveryStatus } from "@/lib/types";
import { STATUS_COLOR, fmtDevPct, devColor } from "@/lib/recovery";
import { upsertRecovery } from "@/lib/recoveryOps";

interface Props {
  days: DailyRecovery[];
  today: string;
  planId: string;
}

export default function RecoveryStrip({ days, today, planId }: Props) {
  const [detail, setDetail] = useState<DailyRecovery | null>(null);
  const [showEntry, setShowEntry] = useState<string | null>(null); // date for manual entry

  const hasAnyData = days.some((d) => d.reading);

  return (
    <>
      <div style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
        padding: "0 0 4px",
      }}>
        {days.map((day) => (
          <DayBadge
            key={day.date}
            day={day}
            isToday={day.date === today}
            onClick={() => day.reading ? setDetail(day) : setShowEntry(day.date)}
            onAdd={() => setShowEntry(day.date)}
          />
        ))}
        {!hasAnyData && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "6px 0", alignSelf: "center" }}>
            No recovery data — tap a day to add, or set up the Shortcuts automation.
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <RecoveryDetailModal
          day={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setDetail(null); setShowEntry(detail.date); }}
        />
      )}

      {/* Manual entry modal */}
      {showEntry && (
        <ManualEntryModal
          date={showEntry}
          planId={planId}
          existing={days.find((d) => d.date === showEntry)?.reading ?? null}
          onClose={() => setShowEntry(null)}
          onSaved={() => setShowEntry(null)}
        />
      )}
    </>
  );
}

// ── Day badge ─────────────────────────────────────────────

function DayBadge({ day, isToday, onClick, onAdd }: {
  day: DailyRecovery;
  isToday: boolean;
  onClick: () => void;
  onAdd: () => void;
}) {
  const color = STATUS_COLOR[day.status];
  const hasData = !!day.reading;
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dow = DAYS[new Date(day.date + "T12:00:00").getDay()];

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${isToday ? color : "var(--border)"}`,
        background: isToday ? color + "12" : "var(--surface-2)",
        cursor: "pointer",
        minWidth: 54,
        WebkitTapHighlightColor: "transparent",
        transition: "border-color 0.15s",
      }}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, color: isToday ? color : "var(--text-muted)",
        letterSpacing: "0.05em",
      }}>
        {dow.toUpperCase()}
      </span>

      {/* Status dot */}
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: hasData ? color : "transparent",
        border: `1.5px solid ${hasData ? color : "var(--border)"}`,
      }} />

      {/* HRV deviation */}
      {day.hrv7d ? (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: devColor(day.hrv7d, true),
        }}>
          {fmtDevPct(day.hrv7d, true)}
        </span>
      ) : (
        <span style={{ fontSize: 10, color: "var(--border)" }}>—</span>
      )}

      {/* Sleep */}
      {day.reading?.sleepHours ? (
        <span style={{
          fontSize: 9,
          color: day.sleepOk ? "var(--text-muted)" : "#f59e0b",
        }}>
          {day.reading.sleepHours.toFixed(1)}h
        </span>
      ) : (
        <span style={{ fontSize: 9, color: "var(--border)" }}>—</span>
      )}
    </button>
  );
}

// ── Detail modal ──────────────────────────────────────────

function RecoveryDetailModal({ day, onClose, onEdit }: {
  day: DailyRecovery;
  onClose: () => void;
  onEdit: () => void;
}) {
  const r = day.reading!;
  const color = STATUS_COLOR[day.status];
  const d = new Date(day.date + "T12:00:00");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {d.getDate()} {MONTHS[d.getMonth()]}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Source: {r.source}
            </div>
          </div>
          <StatusBadge status={day.status} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {r.hrvMs != null && (
            <MetricRow
              label="HRV"
              value={`${r.hrvMs} ms`}
              dev7={day.hrv7d}
              dev30={day.hrv30d}
              higherBetter
            />
          )}
          {r.rhrBpm != null && (
            <MetricRow
              label="RHR"
              value={`${r.rhrBpm} bpm`}
              dev7={day.rhr7d}
              higherBetter={false}
            />
          )}
          {r.sleepHours != null && (
            <MetricRow
              label="Sleep"
              value={`${r.sleepHours.toFixed(1)}h${r.sleepScore ? ` · score ${r.sleepScore}` : ""}`}
              higherBetter
            />
          )}
          {r.readiness != null && (
            <MetricRow label="Readiness" value={`${r.readiness}`} higherBetter />
          )}
        </div>

        {r.note && (
          <div style={{
            padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8,
            fontSize: 13, lineHeight: 1.6, marginBottom: 16, color: "var(--text-muted)",
          }}>
            {r.note}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>Close</button>
          <button onClick={onEdit} style={primaryBtn}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, dev7, dev30, higherBetter }: {
  label: string;
  value: string;
  dev7?: { pct: number; z: number } | null;
  dev30?: { pct: number; z: number } | null;
  higherBetter: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8,
    }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>
          {label.toUpperCase()}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        {dev7 && (
          <div style={{ fontSize: 12, fontWeight: 600, color: devColor(dev7, higherBetter) }}>
            {fmtDevPct(dev7, higherBetter)} <span style={{ fontWeight: 400, opacity: 0.7 }}>vs 7d</span>
          </div>
        )}
        {dev30 && (
          <div style={{ fontSize: 11, color: devColor(dev30, higherBetter), opacity: 0.8 }}>
            {fmtDevPct(dev30, higherBetter)} vs 30d
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RecoveryStatus }) {
  const labels: Record<RecoveryStatus, string> = {
    green: "Recovered", amber: "Moderate", red: "Fatigued", unknown: "No data",
  };
  const color = STATUS_COLOR[status];
  return (
    <div style={{
      padding: "4px 10px", borderRadius: 99,
      background: color + "22", border: `1px solid ${color}55`,
      color, fontSize: 12, fontWeight: 700,
    }}>
      {labels[status]}
    </div>
  );
}

// ── Manual entry modal ────────────────────────────────────

function ManualEntryModal({ date, planId, existing, onClose, onSaved }: {
  planId: string;
  date: string;
  existing: RecoveryReading | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [hrv, setHrv] = useState(existing?.hrvMs?.toString() ?? "");
  const [rhr, setRhr] = useState(existing?.rhrBpm?.toString() ?? "");
  const [sleep, setSleep] = useState(existing?.sleepHours?.toString() ?? "");
  const [sleepScore, setSleepScore] = useState(existing?.sleepScore?.toString() ?? "");
  const [lifeStress, setLifeStress] = useState<number | null>(existing?.lifeStress ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!hrv && !rhr && !sleep) return;
    setSaving(true);
    await upsertRecovery(planId, {
      date,
      hrvMs: hrv ? parseFloat(hrv) : undefined,
      rhrBpm: rhr ? parseFloat(rhr) : undefined,
      sleepHours: sleep ? parseFloat(sleep) : undefined,
      sleepScore: sleepScore ? parseInt(sleepScore) : undefined,
      lifeStress: lifeStress ?? undefined,
      source: "manual",
      note: note.trim() || undefined,
    });
    setSaving(false);
    onSaved();
    router.refresh();
  }

  const d = new Date(date + "T12:00:00");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Recovery — {d.getDate()} {MONTHS[d.getMonth()]}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
          Manual entry · prefer Shortcuts for automated ingestion
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <EntryField label="HRV (ms)" value={hrv} onChange={setHrv} placeholder="79" />
          <EntryField label="RHR (bpm)" value={rhr} onChange={setRhr} placeholder="48" />
          <EntryField label="Sleep (h)" value={sleep} onChange={setSleep} placeholder="7.5" step="0.1" />
          <EntryField label="Sleep score" value={sleepScore} onChange={setSleepScore} placeholder="85" />
        </div>

        {/* Life stress picker */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>
            LIFE STRESS
            {lifeStress && (
              <span style={{ marginLeft: 8, fontWeight: 400, color: lifeStressColor(lifeStress) }}>
                {lifeStress}/10 — {lifeStressLabel(lifeStress)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                key={n}
                onClick={() => setLifeStress(lifeStress === n ? null : n)}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 6,
                  border: `1px solid ${lifeStress === n ? lifeStressColor(n) : "var(--border)"}`,
                  background: lifeStress === n ? lifeStressColor(n) + "33" : "var(--surface-2)",
                  color: lifeStress === n ? lifeStressColor(n) : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: lifeStress === n ? 700 : 400,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4, opacity: 0.6 }}>
            <span>Low</span><span>Moderate</span><span>High</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>NOTE</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", width: "100%" }}
            placeholder="How you felt on waking…"
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || (!hrv && !rhr && !sleep)}
            style={{ ...primaryBtn, opacity: saving || (!hrv && !rhr && !sleep) ? 0.5 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function lifeStressColor(n: number): string {
  if (n <= 3) return "#22c55e";
  if (n <= 6) return "#f59e0b";
  return "#ef4444";
}

function lifeStressLabel(n: number): string {
  if (n <= 3) return "low";
  if (n <= 6) return "moderate";
  if (n <= 8) return "high";
  return "very high";
}

function EntryField({ label, value, onChange, placeholder, step }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; step?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
      <input
        type="number" step={step ?? "1"} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

// ── Styles ────────────────────────────────────────────────

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
  flex: 1, minHeight: 44, padding: "0 16px",
  borderRadius: 8, border: "none",
  background: "var(--accent)", color: "#fff",
  fontWeight: 600, fontSize: 15, cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 14px",
  borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--text-muted)",
  fontSize: 15, cursor: "pointer",
};
