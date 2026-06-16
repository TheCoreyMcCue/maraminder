"use client";
import { useState } from "react";
import type { Session, ZoneSet, Warning } from "@/lib/types";
import { formatSessionTarget, minutesToTimeStr } from "@/lib/zones";
import CategoryPill, { categoryColors } from "./CategoryPill";
import LogModal from "./LogModal";
import MoveModal from "./MoveModal";
import { updateSessionStatus, unlogSession, logRestDay } from "@/lib/planOps";
import EditSessionModal from "./EditSessionModal";
import SplitSessionModal from "./SplitSessionModal";
import { deleteSessionAction } from "@/lib/planActions";
import { useRouter } from "next/navigation";

interface Props {
  session: Session;
  zones: ZoneSet;
  weekDates: { date: string; dow: string; sessions: Session[] }[];
  warnings?: string[];
  ftpW?: number;
  planId?: string;
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
}

const LOG_LABEL: Partial<Record<import("@/lib/types").SessionCategory, string>> = {
  easy:      "Log run",
  steady:    "Log run",
  mp:        "Log run",
  threshold: "Log run",
  vo2:       "Log run",
  long:      "Log run",
  race:      "Log race",
  bike:      "Log ride",
  brick:     "Log brick",
  rest:      "Log",
};

export default function SessionCard({
  session, zones, weekDates, warnings = [], ftpW, planId,
  dragListeners, dragAttributes,
}: Props) {
  const [showLog, setShowLog] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const color = categoryColors[session.category];
  const isDone = session.status === "done";
  const isSkipped = session.status === "skipped";
  const isSplittable = !isDone && !isSkipped && session.category !== "rest";

  async function handleDelete() {
    if (!planId) return;
    setDeleting(true);
    await deleteSessionAction(planId, session.sk);
    router.refresh();
  }

  async function handleSkip() {
    await updateSessionStatus(session.pk, session.sk, isSkipped ? "planned" : "skipped");
    router.refresh();
  }

  async function handleUnlog() {
    await unlogSession(session.pk, session.sk);
    router.refresh();
  }

  async function handleRestDay() {
    await logRestDay(session.pk, session.sk);
    router.refresh();
  }

  const isRestable = session.type === "fill" &&
    ["easy", "rest", "bike", "steady"].includes(session.category) &&
    !isDone && !isSkipped;

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
            {session.targetDurationMin && ` · ${minutesToTimeStr(session.targetDurationMin)}`}
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
            {session.actual.restTaken ? (
              <span style={{ color: "#22c55e", fontWeight: 700 }}>✦ Full rest — recovery investment</span>
            ) : (
              <>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>Logged: </span>
                {session.actual.distanceKm}km
                {session.actual.avgPacePerKm && ` · ${session.actual.avgPacePerKm}/km`}
                {session.actual.avgPowerW && ` · ${session.actual.avgPowerW}W`}
                {session.actual.avgPowerW && ftpW && (
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {" "}(IF {(session.actual.avgPowerW / ftpW).toFixed(2)})
                  </span>
                )}
                {session.actual.avgHr && ` · ${session.actual.avgHr} bpm`}
                {session.actual.rpe && ` · RPE ${session.actual.rpe}`}
                {session.actual.notes && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {session.actual.notes}
                  </div>
                )}
              </>
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
        {confirmDelete ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 12 }}>
            <Btn onClick={() => setConfirmDelete(false)} muted>Cancel</Btn>
            <Btn
              onClick={handleDelete}
              disabled={deleting}
              style={{ color: "#ef4444", borderColor: "#ef444455" }}
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </Btn>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 12 }}>
            {isDone ? (
              <>
                <Btn onClick={() => setShowLog(true)}>Edit</Btn>
                <Btn onClick={handleUnlog} muted>Unlog</Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => setShowLog(true)} disabled={isSkipped}>
                  {LOG_LABEL[session.category] ?? "Log"}
                </Btn>
                <Btn onClick={() => setShowEdit(true)} disabled={isSkipped}>Change</Btn>
                {isRestable ? (
                  <Btn onClick={handleRestDay} accent>Rest day</Btn>
                ) : (
                  <Btn onClick={() => setShowMove(true)} disabled={isSkipped}>Move</Btn>
                )}
                <Btn onClick={handleSkip} muted>
                  {isSkipped ? "Restore" : "Skip"}
                </Btn>
                {planId && isSplittable && (
                  <Btn onClick={() => setShowSplit(true)} style={{ gridColumn: "span 2" }}>
                    Split
                  </Btn>
                )}
              </>
            )}
            {planId && (
              <Btn
                onClick={() => setConfirmDelete(true)}
                muted
                style={{ gridColumn: "span 2", color: "#ef444488" }}
              >
                Delete
              </Btn>
            )}
          </div>
        )}
      </div>

      {showLog && (
        <LogModal
          session={session}
          zones={zones}
          ftpW={ftpW}
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); router.refresh(); }}
        />
      )}
      {showEdit && (
        <EditSessionModal
          session={session}
          onClose={() => setShowEdit(false)}
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
      {showSplit && planId && (
        <SplitSessionModal
          session={session}
          planId={planId}
          weekDates={weekDates}
          onClose={() => setShowSplit(false)}
        />
      )}
    </>
  );
}

function Btn({ onClick, disabled, muted, accent, style, children }: {
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
  accent?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 34,
        padding: "0 4px",
        borderRadius: 7,
        border: `1px solid ${accent ? "#22c55e55" : "var(--border)"}`,
        background: accent ? "#22c55e14" : "transparent",
        color: accent ? "#22c55e" : muted ? "var(--text-muted)" : "var(--text)",
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        ...style,
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
