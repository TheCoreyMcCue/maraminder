"use server";
import { addSession, splitSession, deleteSession, SameDayConflict } from "./planMutations";
import type { NewSessionData, SplitPart } from "./planMutations";

export type AddSessionResult =
  | { ok: true; sk: string }
  | { ok: false; code: string; message: string };

export async function addSessionAction(
  planId: string,
  data: NewSessionData,
  opts?: { allowSameDay?: boolean }
): Promise<AddSessionResult> {
  try {
    const { sk } = await addSession(planId, data, opts);
    return { ok: true, sk };
  } catch (e) {
    if (e instanceof SameDayConflict) {
      return { ok: false, code: e.code, message: e.message };
    }
    return { ok: false, code: "ERROR", message: String(e) };
  }
}

export type SplitSessionResult =
  | { ok: true; sk1: string; sk2: string }
  | { ok: false; message: string };

export async function splitSessionAction(
  planId: string,
  sessionSk: string,
  parts: { part1: SplitPart; part2: SplitPart }
): Promise<SplitSessionResult> {
  try {
    const result = await splitSession(planId, sessionSk, parts);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export type DeleteSessionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteSessionAction(
  planId: string,
  sessionSk: string
): Promise<DeleteSessionResult> {
  try {
    await deleteSession(planId, sessionSk);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
