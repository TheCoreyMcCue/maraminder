"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function switchPlan(formData: FormData) {
  const planId = (formData.get("planId") as string) ?? "amsterdam26";
  const store = await cookies();
  store.set("mara-plan", planId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}
