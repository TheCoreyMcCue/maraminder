"use client";
import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  planId: string;
  focusDate: string;
  focusDow: string;
  onClose: () => void;
}

function storageKey(planId: string, date: string) {
  return `mara-coach-${planId}-${date}`;
}

function loadThread(planId: string, date: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(planId, date));
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

export default function CoachChat({ planId, focusDate, focusDow, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadThread(planId, focusDate)
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist thread to localStorage
  useEffect(() => {
    if (messages.length === 0) {
      localStorage.removeItem(storageKey(planId, focusDate));
      return;
    }
    localStorage.setItem(storageKey(planId, focusDate), JSON.stringify(messages));
  }, [messages, planId, focusDate]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages, // route appends the new user message itself
          focusDate,
          planId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.reply) {
        setError(data.error ?? "Something went wrong. Try again.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearThread() {
    setMessages([]);
    setError(null);
  }

  return (
    <>
      <style>{`
        @keyframes coachDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="sheet-backdrop" onClick={onClose}>
        <div
          className="sheet"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 0,
            maxHeight: "88vh",
          }}
        >
          {/* Header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div className="sheet-handle" style={{ margin: "0 auto 12px" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Coach</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {focusDow} · {focusDate}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {messages.length > 0 && (
                  <button
                    onClick={clearThread}
                    style={{
                      fontSize: 12, color: "var(--text-muted)", background: "none",
                      border: "1px solid var(--border)", borderRadius: 6,
                      cursor: "pointer", padding: "3px 8px",
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={{
                    fontSize: 22, color: "var(--text-muted)", background: "none",
                    border: "none", cursor: "pointer", lineHeight: 1, padding: "2px 6px",
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* Message thread */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <div style={{
                textAlign: "center", color: "var(--text-muted)", fontSize: 13,
                padding: "32px 16px", lineHeight: 1.6,
              }}>
                Ask anything about today's session, your recovery, or how to approach the week.
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  maxWidth: "86%",
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius:
                      m.role === "user"
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                    background:
                      m.role === "user" ? "var(--accent)" : "var(--surface-2)",
                    color: m.role === "user" ? "#fff" : "var(--text)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ alignSelf: "flex-start" }}>
                <div style={{
                  padding: "12px 16px",
                  borderRadius: "16px 16px 16px 4px",
                  background: "var(--surface-2)",
                  display: "flex", gap: 5, alignItems: "center",
                }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "var(--text-muted)",
                        animation: "coachDot 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{
                alignSelf: "center", fontSize: 12, color: "#ef4444",
                background: "#ef44440f", border: "1px solid #ef444433",
                borderRadius: 8, padding: "8px 12px",
              }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "10px 12px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your coach…"
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  color: "var(--text)",
                  fontSize: 14,
                  outline: "none",
                  lineHeight: 1.45,
                  overflow: "hidden",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{
                  width: 42, height: 42, borderRadius: 12,
                  border: "none", flexShrink: 0,
                  background: input.trim() && !loading ? "var(--accent)" : "var(--surface-2)",
                  color: input.trim() && !loading ? "#fff" : "var(--text-muted)",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, lineHeight: 1,
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                ↑
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
