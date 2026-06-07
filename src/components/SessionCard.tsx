"use client";
import { useState } from "react";
import type { Session, ZoneSet, Warning } from "@/lib/types";
import { formatSessionTarget } from "@/lib/zones";
import CategoryPill, { categoryColors } from "./CategoryPill";
import LogModal from "./LogModal";
import MoveModal from "./MoveModal";
import { updateSessionStatus, unlogSession } from "@/lib/planOps";
import { useRouter } from "next/navigation";

interface Props {
  session: Session;
  zones: ZoneSet;
  weekDates: { date: string; dow: string; sessions: Session[] }[];
  warnings?: string[];
  // Drag handle props injected by the DnD wrapper in WeekView
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
}

export default function SessionCard({
  session, zones, weekDates, warnings = [],
  dragListeners, dragAttributes,
}: Props) {
  const [showLog, setShowLog] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const router = useRouter();
  const color = categoryColors[session.category];
  const isDone = session.status === "done";
  const isSkipped = session.status === "skipped";

  async function handleSkip() {
    await updateSessionStatus(session.sk, isSkipped ? "planned" : "skipped");
    router.refresh();
  }

  async function handleUnlog() {
    await unlogSession(session.sk);
    router.refresh();
  }

  function handleMoved(w: Warning[]) {
    setShowMove(false);
    router.refresh();
  }

  return (
    <>
      <div style={{
        background: "var(--surface)",
        border: `1px solid ${warnings.length > 0 ? "#f59e0b55" : "var(--border)"}`,
        borderLeft: `3px solid ${isDone ? "#22c55e" : isSkipped ? "var(--border)" : color}`,
        borderRadius: 10,
        padding: "12px 14px",
        opacity: isSkipped ? 0.45 : 1,
        position: "relative",
        transition: "opacity 0.15s",
        userSelect: "none",
      }}>
        {/* Drag handle — top-right grip */}
        {dragListeners && (
          <div
            {...dragListeners}
            {...dragAttributes}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              color: "var(--border)",
              borderRadius: 4,
              touchAction: "none",
              WebkitTapHighlightColor: "transparent",
            }}
            title="Drag to move"
          >
            <GripIcon />
          </div>
        )}

        {/* Category + anchor badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingRight: dragListeners ? 28 : 0 }}>
          <CategoryPill category={session.category} />
          {session.type === "anchor" && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em" }}>
              ANCHOR
            </span>
          )}
          {isDone && (
            <span style={{ marginLeft: "auto", fontSize: 16, color: "#22c55e" }}>✓</span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 3, lineHeight: 1.3 }}>
          {session.title}
        </div>

        {/* Zone targets */}
        {session.zoneRefs.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--accent)", marginBottom: 4, fontWeight: 500 }}>
            {formatSessionTarget(session, zones)}
          </div>
        )}

        {/* Structure */}
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {session.structure}
        </div>

        {/* Distance / duration */}
        {session.targetDistanceKm && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>
            ~{session.targetDistanceKm}km
            {session.targetDurationMin && (
              <> · {Math.floor(session.targetDurationMin / 60)}h
                {session.targetDurationMin % 60 > 0 ? `${session.targetDurationMin % 60}m` : ""}
              </>
            )}
          </div>
        )}

        {/* Logged actual */}
        {session.actual && (
          <div style={{
            marginTop: 10,
            padding: "8px 10px",
            background: "var(--surface-2)",
            borderRadius: 7,
            fontSize: 13,
          }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>Logged: </span>
            {session.actual.distanceKm}km
            {session.actual.avgPacePerKm && ` · ${session.actual.avgPacePerKm}/km`}
            {session.actual.avgHr && ` · ${session.actual.avgHr} bpm`}
            {session.actual.rpe && ` · RPE ${session.actual.rpe}`}
            {session.actual.notes && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {session.actual.notes}
              </div>
            )}
            {session.actual.stravaUrl && (
              <a
                href={session.actual.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                  fontSize: 12,
                  color: "#fc4c02",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <StravaIcon /> View on Strava
              </a>
            )}
          </div>
        )}

        {/* Guardrail warnings */}
        {warnings.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#f59e0b", lineHeight: 1.5 }}>
            ⚠ {warnings[0]}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn onClick={() => setShowLog(true)} disabled={isSkipped}>
            {isDone ? "Edit log" : "Log run"}
          </Btn>
          {isDone ? (
            <Btn onClick={handleUnlog} muted>Unlog</Btn>
          ) : (
            <Btn onClick={() => setShowMove(true)} disabled={isSkipped}>Move</Btn>
          )}
          <Btn onClick={handleSkip} muted>
            {isSkipped ? "Restore" : "Skip"}
          </Btn>
        </div>
      </div>

      {showLog && (
        <LogModal
          session={session}
          zones={zones}
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); router.refresh(); }}
        />
      )}
      {showMove && (
        <MoveModal
          session={session}
          weekDates={weekDates}
          onClose={() => setShowMove(false)}
          onMoved={handleMoved}
        />
      )}
    </>
  );
}

function Btn({ onClick, disabled, muted, children }: {
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={{
        flex: 1,
        minHeight: 36,
        padding: "0 6px",
        borderRadius: 7,
        border: "1px solid var(--border)",
        background: "transparent",
        color: muted ? "var(--text-muted)" : "var(--text)",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}

function StravaIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#fc4c02">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4" cy="3"  r="1.2" /><circle cx="10" cy="3"  r="1.2" />
      <circle cx="4" cy="7"  r="1.2" /><circle cx="10" cy="7"  r="1.2" />
      <circle cx="4" cy="11" r="1.2" /><circle cx="10" cy="11" r="1.2" />
    </svg>
  );
}
