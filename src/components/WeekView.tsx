"use client";
import { useState, useOptimistic, startTransition, useEffect, useRef } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import type { Session, ZoneSet, Week, PlanMeta, Warning } from "@/lib/types";
import { evaluateWeek } from "@/lib/rules";
import { moveSession } from "@/lib/planOps";
import SessionCard from "./SessionCard";
import CategoryPill from "./CategoryPill";

interface Props {
  week: Week;
  sessions: Session[];
  zones: ZoneSet;
  allWeeks: Week[];
  meta: PlanMeta;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateToDow(iso: string) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(iso + "T12:00:00").getDay()];
}

export default function WeekView({ week, sessions, zones, allWeeks, meta }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const activeNavRef = useRef<HTMLAnchorElement>(null);

  // Keep the active week pill centered in the nav strip
  useEffect(() => {
    const container = navScrollRef.current;
    const active = activeNavRef.current;
    if (!container || !active) return;
    const offset = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
    container.scrollTo({ left: offset, behavior: "smooth" });
  }, [week.weekNo]);
  const [postMoveWarnings, setPostMoveWarnings] = useState<Warning[]>([]);

  // Optimistic session positions — reverts automatically after router.refresh()
  const [optimisticSessions, shiftSession] = useOptimistic(
    sessions,
    (state, { sk, date, dow }: { sk: string; date: string; dow: string }) =>
      state.map((s) => (s.sk === sk ? { ...s, date, dayOfWeek: dow } : s))
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const session = optimisticSessions.find((s) => s.sk === String(active.id));
    const toDate = String(over.id);
    if (!session || toDate === session.date) return;

    const dow = dateToDow(toDate);
    startTransition(async () => {
      shiftSession({ sk: session.sk, date: toDate, dow });
      const { warnings } = await moveSession(session.sk, toDate);
      setPostMoveWarnings(warnings);
      router.refresh();
    });
  }

  // Build week dates from Monday
  const weekDates = DAYS.map((dow, i) => {
    const date = addDays(week.dateStart, i);
    return { date, dow, sessions: optimisticSessions.filter((s) => s.date === date) };
  });

  // Guardrail warnings
  const warnings = evaluateWeek(optimisticSessions, week);
  const allWarnings = [...warnings, ...postMoveWarnings];
  const warnMap: Record<string, string[]> = {};
  for (const w of allWarnings) {
    for (const sk of w.sessionIds || []) {
      warnMap[sk] = [...(warnMap[sk] || []), w.message];
    }
  }

  // Stats
  const actualKm = optimisticSessions
    .filter((s) => s.actual?.distanceKm)
    .reduce((sum, s) => sum + (s.actual!.distanceKm || 0), 0);
  const plannedKm = optimisticSessions
    .filter((s) => s.status !== "skipped" && s.targetDistanceKm)
    .reduce((sum, s) => sum + (s.targetDistanceKm || 0), 0);
  const doneCount = optimisticSessions.filter((s) => s.status === "done").length;
  const totalCount = optimisticSessions.filter((s) => s.status !== "skipped").length;
  const daysToRace = Math.ceil((new Date(meta.raceDate).getTime() - Date.now()) / 86_400_000);

  const activeSession = activeId ? optimisticSessions.find((s) => s.sk === activeId) : null;

  return (
    <div className="week-page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Page header ── */}
      <div style={{ padding: "16px 16px 0" }}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                W{week.weekNo} — {week.phase}
              </h1>
              {week.isDownWeek && (
                <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "#22c55e1a", color: "#22c55e", border: "1px solid #22c55e40", fontWeight: 600 }}>
                  DOWN
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {formatRange(week.dateStart, week.dateEnd)}
            </div>
          </div>

          {/* Stats chips */}
          <div style={{ display: "flex", gap: 8 }}>
            <StatChip label="Volume" value={`${actualKm > 0 ? actualKm.toFixed(1) : plannedKm.toFixed(0)}/${week.volumeTargetKm}km`} />
            <StatChip label="Done" value={`${doneCount}/${totalCount}`} />
            {daysToRace > 0 && <StatChip label="Race" value={`${daysToRace}d`} color="#f97316" />}
          </div>
        </div>

        {/* Notes */}
        {week.notes && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12 }}>
            {week.notes}
          </div>
        )}

        {/* Week nav strip */}
        <div ref={navScrollRef} style={{
          display: "flex", gap: 5, overflowX: "auto", paddingBottom: 10,
          marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16,
          scrollbarWidth: "none",
        }}>
          {allWeeks.map((w) => {
            const active = w.weekNo === week.weekNo;
            return (
              <Link key={w.weekNo} ref={active ? activeNavRef : undefined} href={w.weekNo === 1 ? "/" : `/week/${w.weekNo}`} style={{ flexShrink: 0 }}>
                <div style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  whiteSpace: "nowrap",
                  minWidth: 34, textAlign: "center",
                }}>
                  W{w.weekNo}{w.isDownWeek ? "↓" : ""}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Guardrail warnings */}
        {allWarnings.length > 0 && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: "#f59e0b0a", border: "1px solid #f59e0b30", borderRadius: 8 }}>
            {allWarnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.7 }}>⚠ {w.message}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── Day grid with DnD ── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="week-grid" style={{ padding: "0 0" }}>
          {weekDates.map(({ date, dow, sessions: daySessions }) => {
            const dateObj = new Date(date + "T12:00:00");
            const isToday = date === new Date().toISOString().slice(0, 10);
            const sorted = [...daySessions].sort((a, b) => a.order - b.order);

            return (
              <DroppableDay key={date} id={date}>
                {/* Day header */}
                <div className="day-header">
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: isToday ? "var(--accent)" : "var(--text-muted)",
                  }}>
                    {dow}
                  </span>
                  <span className="day-date" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {dateObj.getDate()} {MONTHS[dateObj.getMonth()]}
                  </span>
                  {isToday && (
                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 99, background: "var(--accent)", color: "#fff", fontWeight: 600, marginLeft: 2 }}>
                      TODAY
                    </span>
                  )}
                </div>

                {/* Sessions */}
                <div className="day-sessions">
                  {sorted.length === 0 ? (
                    <div className="day-empty">—</div>
                  ) : (
                    sorted.map((s) => (
                      <DraggableCard key={s.sk} session={s}>
                        <SessionCard
                          session={s}
                          zones={zones}
                          weekDates={weekDates}
                          warnings={warnMap[s.sk]}
                        />
                      </DraggableCard>
                    ))
                  )}
                </div>
              </DroppableDay>
            );
          })}
        </div>

        {/* Floating drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeSession ? (
            <div style={{ opacity: 0.92, transform: "rotate(1.5deg) scale(1.03)", pointerEvents: "none" }}>
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--accent)",
                borderRadius: 10,
                padding: "12px 14px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                minWidth: 180,
              }}>
                <CategoryPill category={activeSession.category} />
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>
                  {activeSession.title}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Droppable day column ──────────────────────────────────

function DroppableDay({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`day-col${isOver ? " day-col--over" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Draggable card wrapper ────────────────────────────────

function DraggableCard({ session, children }: { session: Session; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: session.sk });

  // Clone children (SessionCard) passing drag handle props
  const child = children as React.ReactElement<{
    dragListeners?: Record<string, unknown>;
    dragAttributes?: Record<string, unknown>;
  }>;

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.15 : 1, transition: "opacity 0.1s" }}>
      {isDragging ? null : (
        // Pass drag handle listeners only — buttons inside handle their own events
        <child.type
          {...child.props}
          dragListeners={listeners as unknown as Record<string, unknown>}
          dragAttributes={attributes as unknown as Record<string, unknown>}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: color ? color + "18" : "var(--surface)",
      border: `1px solid ${color ? color + "40" : "var(--border)"}`,
      borderRadius: 8,
      padding: "5px 10px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: color ?? "var(--text-muted)", letterSpacing: "0.04em" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

function formatRange(start: string, end: string) {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}
