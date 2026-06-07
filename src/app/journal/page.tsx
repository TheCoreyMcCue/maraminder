export const dynamic = "force-dynamic";
import { getPlan } from "@/lib/planOps";
import { getRecoveryWithHistory } from "@/lib/recoveryOps";
import { enrichDay, STATUS_COLOR, fmtDevPct, devColor } from "@/lib/recovery";
import type { Session, Week, DailyRecovery } from "@/lib/types";

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const CAT_COLORS: Record<string, string> = {
  easy: "var(--cat-easy)", steady: "var(--cat-steady)",
  mp: "var(--cat-mp)", threshold: "var(--cat-threshold)",
  vo2: "var(--cat-vo2)", long: "var(--cat-long)",
  rest: "var(--cat-rest)", race: "var(--cat-race)",
};

export default async function JournalPage() {
  const plan = await getPlan();

  const logged = plan.sessions
    .filter((s) => s.status === "done" && s.actual)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  const weekMap = Object.fromEntries(plan.weeks.map((w) => [w.weekNo, w]));

  // Fetch recovery with history for baseline computation
  const allRecovery = logged.length > 0
    ? await getRecoveryWithHistory(logged[logged.length - 1].date)
    : [];

  // Pre-enrich each unique date that has a logged session
  const uniqueDates = [...new Set(logged.map((s) => s.date))];
  const recoveryByDate = Object.fromEntries(
    uniqueDates.map((date) => [date, enrichDay(allRecovery, date)])
  );

  // Group by week
  const byWeek: Map<number, Session[]> = new Map();
  for (const s of logged) {
    if (!byWeek.has(s.weekNo)) byWeek.set(s.weekNo, []);
    byWeek.get(s.weekNo)!.push(s);
  }
  const sortedWeeks = [...byWeek.keys()].sort((a, b) => b - a);

  return (
    <div className="main-content" style={{ padding: "16px", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Training Journal</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          {logged.length} {logged.length === 1 ? "run" : "runs"} logged
        </div>
      </div>

      {logged.length === 0 ? (
        <div style={{
          padding: "40px 24px", textAlign: "center",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No entries yet</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Log a session from the Week view and your journal will start filling up here.
          </div>
        </div>
      ) : (
        sortedWeeks.map((weekNo) => {
          const week = weekMap[weekNo];
          const sessions = byWeek.get(weekNo)!;
          return (
            <WeekGroup key={weekNo} week={week} sessions={sessions} recoveryByDate={recoveryByDate} />
          );
        })
      )}
    </div>
  );
}

function WeekGroup({ week, sessions, recoveryByDate }: {
  week: Week;
  sessions: Session[];
  recoveryByDate: Record<string, DailyRecovery>;
}) {
  const totalKm = sessions.reduce((s, r) => s + (r.actual?.distanceKm || 0), 0);

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Week header */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 12, paddingBottom: 8,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>W{week.weekNo}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{week.phase}</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {totalKm.toFixed(1)} km logged
        </span>
      </div>

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sessions.map((s) => (
          <JournalEntry key={s.sk} session={s} recovery={recoveryByDate[s.date] ?? null} />
        ))}
      </div>
    </div>
  );
}

function JournalEntry({ session, recovery }: { session: Session; recovery: DailyRecovery | null }) {
  const a = session.actual!;
  const d = new Date(session.date + "T12:00:00");
  const color = CAT_COLORS[session.category] ?? "var(--text-muted)";

  const stats = [
    a.distanceKm && `${a.distanceKm}km`,
    a.avgPacePerKm && `${a.avgPacePerKm}/km`,
    a.avgHr && `${a.avgHr} bpm`,
    a.rpe && `RPE ${a.rpe}`,
  ].filter(Boolean).join(" · ");

  const segStats = [
    a.segmentHr?.MP && `MP HR ${a.segmentHr.MP} bpm`,
    a.segmentPace?.MP && `MP pace ${a.segmentPace.MP}/km`,
    a.segmentHr?.T && `T HR ${a.segmentHr.T} bpm`,
    a.segmentPace?.T && `T pace ${a.segmentPace.T}/km`,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Entry header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        padding: "12px 14px 10px", gap: 12,
      }}>
        {/* Date badge */}
        <div style={{
          flexShrink: 0, textAlign: "center",
          background: "var(--surface-2)", borderRadius: 8,
          padding: "6px 10px", minWidth: 48,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color }}>
            {d.getDate()}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
            {MONTHS_SHORT[d.getMonth()].toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {DAYS[d.getDay()]}
          </div>
        </div>

        {/* Title + stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 4 }}>
            {session.title}
          </div>
          {stats && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: segStats ? 3 : 0 }}>
              {stats}
            </div>
          )}
          {segStats && (
            <div style={{ fontSize: 12, color, opacity: 0.85 }}>
              {segStats}
            </div>
          )}
        </div>
      </div>

      {/* Recovery context */}
      {recovery?.reading && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "6px 14px 8px",
          borderTop: "1px solid var(--border)",
          fontSize: 12,
        }}>
          {/* Status dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: STATUS_COLOR[recovery.status],
              flexShrink: 0,
            }} />
            <span style={{ color: STATUS_COLOR[recovery.status], fontWeight: 600 }}>
              {{ green: "Recovered", amber: "Moderate", red: "Fatigued", unknown: "—" }[recovery.status]}
            </span>
          </div>
          {recovery.hrv7d && recovery.reading.hrvMs && (
            <span style={{ color: devColor(recovery.hrv7d, true) }}>
              HRV {recovery.reading.hrvMs}ms ({fmtDevPct(recovery.hrv7d, true)} vs 7d)
            </span>
          )}
          {recovery.reading.rhrBpm && (
            <span style={{ color: recovery.rhr7d ? devColor(recovery.rhr7d, false) : "var(--text-muted)" }}>
              RHR {recovery.reading.rhrBpm}bpm
              {recovery.rhr7d && ` (${fmtDevPct(recovery.rhr7d, false)} vs 7d)`}
            </span>
          )}
          {recovery.reading.sleepHours && (
            <span style={{ color: recovery.sleepOk ? "var(--text-muted)" : "#f59e0b" }}>
              Sleep {recovery.reading.sleepHours.toFixed(1)}h
            </span>
          )}
          {recovery.reading.note && (
            <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
              "{recovery.reading.note}"
            </span>
          )}
        </div>
      )}

      {/* Notes — the journal entry body */}
      {a.notes && (
        <div style={{
          padding: "10px 14px 12px",
          borderTop: "1px solid var(--border)",
          fontSize: 14,
          lineHeight: 1.7,
          color: "var(--text)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {a.notes}
        </div>
      )}

      {/* Strava link */}
      {a.stravaUrl && (
        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}>
          <a
            href={a.stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "#fc4c02", fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <StravaIcon />
            View on Strava
          </a>
        </div>
      )}
    </div>
  );
}

function StravaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fc4c02">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
