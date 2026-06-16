"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { StravaUnmatched } from "@/lib/strava";

interface Status {
  connected: boolean;
  lastSyncAt: string | null;
  unmatchedCount: number;
}

interface SyncResult {
  matched: number;
  unmatched: number;
  skipped: number;
  total: number;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtPace(p: string | null | undefined) {
  return p ? `${p}/km` : "—";
}

// ── Unmatched review sheet ────────────────────────────────────────────────────

function UnmatchedSheet({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [items, setItems] = useState<StravaUnmatched[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [dismissingAll, setDismissingAll] = useState(false);

  useEffect(() => {
    fetch("/api/strava/unmatched")
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function dismissAll() {
    setDismissingAll(true);
    try {
      await Promise.all(
        items.map((item) =>
          fetch("/api/strava/unmatched", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "dismiss", activityId: item.activityId }),
          })
        )
      );
      setItems([]);
      onApplied();
    } finally {
      setDismissingAll(false);
    }
  }

  async function handleAction(
    activityId: number,
    action: "dismiss" | "match",
    planId?: string,
    sessionSk?: string
  ) {
    setWorking(activityId);
    try {
      await fetch("/api/strava/unmatched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, activityId, planId, sessionSk }),
      });
      setItems((prev) => prev.filter((i) => i.activityId !== activityId));
      onApplied();
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", padding: 0, maxHeight: "88vh" }}
      >
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div className="sheet-handle" style={{ margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Unmatched imports</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {items.length > 0 && (
                <button
                  onClick={dismissAll}
                  disabled={dismissingAll}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--border)", color: "var(--text-muted)",
                    background: "none", cursor: dismissingAll ? "not-allowed" : "pointer",
                  }}
                >
                  {dismissingAll ? "Dismissing…" : "Dismiss all"}
                </button>
              )}
              <button
                onClick={onClose}
                style={{ fontSize: 22, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 32 }}>
              Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 32 }}>
              No unmatched imports.
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.activityId}
              style={{
                background: "var(--surface-2)",
                borderRadius: 12,
                padding: "12px 14px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{item.activityName}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.date}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                {item.sportType} · {item.distanceKm.toFixed(2)} km · {Math.round(item.durationMin)} min
                {item.avgHr ? ` · ${Math.round(item.avgHr)} bpm` : ""}
                {item.avgPacePerKm ? ` · ${fmtPace(item.avgPacePerKm)}` : ""}
              </div>

              {item.candidateSessions.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Match to session
                  </div>
                  {item.candidateSessions.map((c) => (
                    <div key={c.sk} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 13 }}>
                        {c.title} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({c.category})</span>
                      </span>
                      <button
                        disabled={working === item.activityId}
                        onClick={() => handleAction(item.activityId, "match", c.planId, c.sk)}
                        style={{
                          fontSize: 12, padding: "4px 10px", borderRadius: 6,
                          border: "1px solid var(--accent)", color: "var(--accent)",
                          background: "none", cursor: "pointer",
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  No matching planned session found.
                </div>
              )}

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  disabled={working === item.activityId}
                  onClick={() => handleAction(item.activityId, "dismiss")}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--border)", color: "var(--text-muted)",
                    background: "none", cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StravaSync() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/strava/status");
      const data = await r.json() as Status;
      setStatus(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const r = await fetch("/api/strava/sync", { method: "POST" });
      const data = await r.json() as SyncResult & { error?: string };
      if (!r.ok || data.error) {
        setError(data.error ?? "Sync failed");
      } else {
        setSyncResult(data);
        await loadStatus();
        if (data.matched > 0) router.refresh();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setSyncing(false);
    }
  }

  if (!status) return null;

  // Strava orange
  const ORANGE = "#FC4C02";

  if (!status.connected) {
    return (
      <div style={{
        position: "fixed", bottom: 80, right: 16, zIndex: 110,
        background: "var(--surface)", border: `1px solid ${ORANGE}33`,
        borderRadius: 12, padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 12px #0003",
      }}>
        <StravaLogo />
        <a
          href="/api/strava/connect"
          style={{ fontSize: 13, color: ORANGE, fontWeight: 600, textDecoration: "none" }}
        >
          Connect Strava
        </a>
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: "fixed", bottom: 80, right: 16, zIndex: 110,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 2px 12px #0003",
        maxWidth: 280,
      }}>
        <StravaLogo />
        <div style={{ flex: 1, minWidth: 0 }}>
          {status.lastSyncAt ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
              Synced {fmtDate(status.lastSyncAt)}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
              Never synced
            </div>
          )}
          {syncResult && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {syncResult.matched} matched, {syncResult.unmatched} queued
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 2 }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {status.unmatchedCount > 0 && (
              <button
                onClick={() => setShowUnmatched(true)}
                style={{
                  fontSize: 11, color: ORANGE, background: "none", border: "none",
                  cursor: "pointer", padding: 0, textDecoration: "underline",
                }}
              >
                {status.unmatchedCount} unmatched →
              </button>
            )}
            <a
              href="/api/strava/connect"
              style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "underline" }}
            >
              Reconnect
            </a>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            fontSize: 12, fontWeight: 600,
            background: syncing ? "var(--surface-2)" : ORANGE,
            color: "#fff",
            border: "none", borderRadius: 8,
            padding: "5px 10px", cursor: syncing ? "not-allowed" : "pointer",
            flexShrink: 0, transition: "background 0.12s",
          }}
        >
          {syncing ? "…" : "Sync"}
        </button>
      </div>

      {showUnmatched && (
        <UnmatchedSheet
          onClose={() => setShowUnmatched(false)}
          onApplied={loadStatus}
        />
      )}
    </>
  );
}

function StravaLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#FC4C02" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
