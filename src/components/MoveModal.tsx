"use client";
import { useState } from "react";
import type { Session, Warning } from "@/lib/types";
import { moveSession } from "@/lib/planOps";

interface Props {
  session: Session;
  weekDates: { date: string; dow: string; sessions: Session[] }[];
  onClose: () => void;
  onMoved: (warnings: Warning[]) => void;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MoveModal({ session, weekDates, onClose, onMoved }: Props) {
  const [moving, setMoving] = useState<string | null>(null);

  async function handleMove(toDate: string) {
    if (toDate === session.date) { onClose(); return; }
    setMoving(toDate);
    const { warnings } = await moveSession(session.sk, toDate);
    setMoving(null);
    onMoved(warnings);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Move session</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          {session.title} — currently {session.dayOfWeek}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {weekDates.map(({ date, dow, sessions: daySessions }) => {
            const isCurrentDay = date === session.date;
            const otherSessions = daySessions.filter((s) => s.sk !== session.sk);
            const hasAnchor = otherSessions.some((s) => s.type === "anchor");
            const d = new Date(date + "T12:00:00");

            return (
              <button
                key={date}
                onClick={() => !moving && handleMove(date)}
                disabled={!!moving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${isCurrentDay ? "var(--accent)" : "var(--border)"}`,
                  background: isCurrentDay ? "var(--accent)18" : "var(--surface-2)",
                  cursor: moving ? "not-allowed" : "pointer",
                  opacity: moving && moving !== date ? 0.5 : 1,
                  textAlign: "left",
                  width: "100%",
                  transition: "opacity 0.15s",
                }}
              >
                {/* Day label */}
                <div style={{ minWidth: 44 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isCurrentDay ? "var(--accent)" : "var(--text)",
                  }}>
                    {dow}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {d.getDate()} {MONTHS[d.getMonth()]}
                  </div>
                </div>

                {/* Existing sessions on this day */}
                <div style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
                  {otherSessions.length === 0
                    ? <span style={{ opacity: 0.5 }}>Empty</span>
                    : otherSessions.map((s) => (
                        <span key={s.sk} style={{
                          display: "inline-block",
                          marginRight: 6,
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          background: "var(--border)",
                          color: s.type === "anchor" ? "#f59e0b" : "var(--text-muted)",
                          fontWeight: s.type === "anchor" ? 600 : 400,
                        }}>
                          {s.category}
                        </span>
                      ))
                  }
                </div>

                {/* Status */}
                <div style={{ fontSize: 12, minWidth: 60, textAlign: "right" }}>
                  {isCurrentDay && (
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>current</span>
                  )}
                  {moving === date && (
                    <span style={{ color: "var(--text-muted)" }}>moving…</span>
                  )}
                  {!isCurrentDay && moving !== date && hasAnchor && (
                    <span style={{ color: "#f59e0b", fontSize: 11 }}>⚠ anchor</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
