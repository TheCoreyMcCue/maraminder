import { cookies } from "next/headers";

export const PLANS = [
  { id: "amsterdam26", name: "Amsterdam Marathon Block", short: "AMS Block" },
  { id: "bridge-2026",  name: "70.3 → Pre-Block Bridge",  short: "Bridge" },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

const DEFAULT: PlanId = "amsterdam26";
const COOKIE = "mara-plan";

export async function getActivePlanId(): Promise<PlanId> {
  const store = await cookies();
  const val = store.get(COOKIE)?.value;
  return val === "bridge-2026" ? "bridge-2026" : DEFAULT;
}

export function planPk(planId: string): string {
  return `PLAN#${planId}`;
}
