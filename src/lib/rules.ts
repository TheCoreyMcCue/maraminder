import type { Session, Warning, Week } from "./types";

const HARD_CATEGORIES = new Set(["threshold", "vo2", "mp", "long", "race"]);

function isHard(session: Session): boolean {
  return (
    session.type === "anchor" && HARD_CATEGORIES.has(session.category)
  );
}

function sessionsByDay(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return map;
}

function sortedDates(sessions: Session[]): string[] {
  return [...new Set(sessions.map((s) => s.date))].sort();
}

export function evaluateWeek(sessions: Session[], week?: Week): Warning[] {
  const warnings: Warning[] = [];
  const active = sessions.filter((s) => s.status !== "skipped");
  const byDay = sessionsByDay(active);
  const dates = sortedDates(active);

  // Rule 1: No back-to-back hard days
  for (let i = 0; i < dates.length - 1; i++) {
    const day1 = byDay.get(dates[i]) || [];
    const day2 = byDay.get(dates[i + 1]) || [];
    const hard1 = day1.some(isHard);
    const hard2 = day2.some(isHard);

    const d1 = new Date(dates[i]);
    const d2 = new Date(dates[i + 1]);
    const diffDays = (d2.getTime() - d1.getTime()) / 86_400_000;

    if (hard1 && hard2 && diffDays === 1) {
      warnings.push({
        code: "BACK_TO_BACK_HARD",
        message: `Back-to-back hard sessions on ${dates[i]} and ${dates[i + 1]}. Consider an easy day between them.`,
        severity: "warn",
        sessionIds: [
          ...day1.filter(isHard).map((s) => s.sk),
          ...day2.filter(isHard).map((s) => s.sk),
        ],
      });
    }
  }

  // Rule 2: Easy/rest before long run
  const longSessions = active.filter((s) => s.category === "long");
  for (const longRun of longSessions) {
    const longDate = new Date(longRun.date);
    const prevDate = new Date(longDate.getTime() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const prevDay = byDay.get(prevDate) || [];
    const hasHardPrev = prevDay.some(isHard);
    if (hasHardPrev) {
      warnings.push({
        code: "HARD_BEFORE_LONG",
        message: `Hard session on ${prevDate} — day before the long run. Try to keep the day before easy or rest.`,
        severity: "warn",
        sessionIds: [longRun.sk, ...prevDay.filter(isHard).map((s) => s.sk)],
      });
    }
  }

  // Rule 3: Long run present
  const hasLong = active.some((s) => s.category === "long" || s.category === "race");
  if (!hasLong && sessions.length > 0) {
    warnings.push({
      code: "MISSING_LONG_RUN",
      message: "No long run or race session this week. Consider keeping the long run anchor.",
      severity: "warn",
    });
  }

  // Rule 4: Quality spacing — 3+ hard days in any rolling 7 with no rest
  const hardDates = dates.filter((d) => (byDay.get(d) || []).some(isHard));
  if (hardDates.length >= 3) {
    const hasRestOrEasy = active.some(
      (s) => s.category === "rest" || s.category === "easy"
    );
    if (!hasRestOrEasy) {
      warnings.push({
        code: "INTENSITY_CLUSTER",
        message: `${hardDates.length} hard sessions this week with no easy/rest day. Add recovery before the next quality session.`,
        severity: "warn",
      });
    }
  }

  // Rule 5: Volume sanity
  if (week) {
    const plannedKm = active
      .filter((s) => s.targetDistanceKm)
      .reduce((sum, s) => sum + (s.targetDistanceKm || 0), 0);
    const actualKm = active
      .filter((s) => s.actual?.distanceKm)
      .reduce((sum, s) => sum + (s.actual?.distanceKm || 0), 0);
    const loggedKm = actualKm > 0 ? actualKm : plannedKm;

    if (loggedKm > week.volumeTargetKm * 1.1) {
      warnings.push({
        code: "VOLUME_HIGH",
        message: `Week volume ${loggedKm.toFixed(0)}km is >10% over target ${week.volumeTargetKm}km. Extra load → easy volume only.`,
        severity: "warn",
      });
    }
  }

  return warnings;
}

export function evaluateMove(
  session: Session,
  toDate: string,
  weekSessions: Session[]
): Warning[] {
  const hypothetical = weekSessions.map((s) =>
    s.sk === session.sk ? { ...s, date: toDate } : s
  );
  const found = hypothetical.find((s) => s.sk === session.sk);
  if (!found) return [];
  return evaluateWeek(hypothetical);
}
