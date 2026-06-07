import type { SessionCategory } from "@/lib/types";

const colors: Record<SessionCategory, string> = {
  easy: "var(--cat-easy)",
  steady: "var(--cat-steady)",
  mp: "var(--cat-mp)",
  threshold: "var(--cat-threshold)",
  vo2: "var(--cat-vo2)",
  long: "var(--cat-long)",
  rest: "var(--cat-rest)",
  race: "var(--cat-race)",
};

const labels: Record<SessionCategory, string> = {
  easy: "Easy",
  steady: "Steady",
  mp: "MP",
  threshold: "Threshold",
  vo2: "VO2",
  long: "Long",
  rest: "Rest",
  race: "Race",
};

export default function CategoryPill({ category }: { category: SessionCategory }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: colors[category] + "22",
        color: colors[category],
        border: `1px solid ${colors[category]}44`,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {labels[category]}
    </span>
  );
}

export { colors as categoryColors };
