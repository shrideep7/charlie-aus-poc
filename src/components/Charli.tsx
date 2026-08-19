/**
 * The Charli tenant experience.
 *
 * One conversational front door (L127). Service-menu chips are grouped by the
 * brief's three categories; the chip marked inactive is display only (L183).
 * The presenter trace panel is hidden until deliberately revealed (L16).
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asset } from "@/config/asset";
import { categoryLabels, menuChips, type ServiceCategory } from "@/config/services";
import { CardView } from "./Cards";
import { TracePanel } from "./TracePanel";
import { emptySession, type Card, type ChatMessage, type SessionState, type TraceRecord } from "@/lib/types";

const OPENING: ChatMessage = {
  id: "opening",
  role: "charli",
  text: `Good evening. I'm ${asset.agentName}, here for ${asset.name} while the concierge desk is unattended. I can arrange rooms, guests, access and anything you need for tomorrow morning — what can I do for you?`,
};

const HERO_PROMPT =
  "I have six interstate clients arriving at 8am tomorrow. Please arrange a room, organise guest passes, recommend breakfast nearby, and book a taxi to the airport for one guest after the meeting.";

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function Charli({ initialRails }: { initialRails: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING]);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [session, setSession] = useState<SessionState>(emptySession());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [rails, setRails] = useState(initialRails);
  const [category, setCategory] = useState<ServiceCategory>("meetings_guests");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // Presenter shortcut: ⌘⇧T / Ctrl+⇧T reveals the trace panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setShowTrace((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.id !== "opening")
        .map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", text: m.text })),
    [messages],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setError(null);
      setBusy(true);
      setInput("");

      const userMessage: ChatMessage = { id: nextId(), role: "user", text };
      const replyId = nextId();
      setMessages((prev) => [...prev, userMessage, { id: replyId, role: "charli", text: "" }]);

      try {
        const response = await fetch("/api/charli", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history, session, rails }),
        });
        if (!response.ok || !response.body) {
          throw new Error(`Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyFrame = (frame: string) => {
          if (!frame.startsWith("data: ")) return;
          const payload = JSON.parse(frame.slice(6)) as
            | { type: "text"; delta: string }
            | { type: "card"; card: Card }
            | { type: "trace"; trace: TraceRecord }
            | { type: "done"; turn: number; session: SessionState }
            | { type: "error"; message: string };

          switch (payload.type) {
            case "text":
              setMessages((prev) =>
                prev.map((m) => (m.id === replyId ? { ...m, text: m.text + payload.delta } : m)),
              );
              break;
            case "card":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === replyId ? { ...m, cards: [...(m.cards ?? []), payload.card] } : m,
                ),
              );
              break;
            case "trace":
              setTraces((prev) => [
                ...prev.filter((t) => t.turn !== payload.trace.turn),
                payload.trace,
              ]);
              setMessages((prev) =>
                prev.map((m) => (m.id === replyId ? { ...m, traceTurn: payload.trace.turn } : m)),
              );
              break;
            case "done":
              setSession(payload.session);
              break;
            case "error":
              setError(payload.message);
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) applyFrame(frame.trim());
        }
        if (buffer.trim()) applyFrame(buffer.trim());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId && m.text === ""
              ? { ...m, text: "One moment — let me try that again." }
              : m,
          ),
        );
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, history, session, rails],
  );

  const reset = () => {
    setMessages([OPENING]);
    setTraces([]);
    setSession(emptySession());
    setInput("");
    setError(null);
  };

  const chips = menuChips.filter((c) => c.category === category);

  return (
    <div className="flex h-dvh flex-col bg-[var(--ground)]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[1.35rem] font-semibold leading-none">
            {asset.agentName}
          </span>
          <span className="hidden font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--muted)] sm:inline">
            {asset.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--brass-dim)] px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[var(--brass)]">
              {asset.modeLabel}
            </span>
          </span>
          <button
            onClick={() => setShowTrace((v) => !v)}
            title="Presenter trace panel (⌘⇧T)"
            className="rounded-[2px] border border-[var(--rule)] px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[var(--faint)] transition-colors hover:border-[var(--brass)] hover:text-[var(--brass)]"
          >
            Trace
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Conversation ─────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex max-w-[44rem] flex-col gap-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="rise flex justify-end">
                    <p className="max-w-[85%] rounded-[3px] bg-[var(--raised)] px-3.5 py-2.5 text-[0.92rem] leading-relaxed">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="rise flex flex-col gap-3">
                    {m.text && (
                      <p className="max-w-[46rem] whitespace-pre-wrap text-[0.98rem] leading-[1.65]">
                        {m.text}
                      </p>
                    )}
                    {(m.cards ?? []).map((card, i) => (
                      <div key={i} className="rise max-w-[34rem]">
                        <CardView card={card} />
                      </div>
                    ))}
                  </div>
                ),
              )}
              {busy && (
                <div className="flex gap-1.5 pl-0.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="dot h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
                  ))}
                </div>
              )}
              {error && (
                <p className="rounded-[3px] border border-[var(--crit)] px-3 py-2 font-mono text-[0.72rem] text-[var(--crit)]">
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* ── Composer ──────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-[var(--rule)] px-4 py-3 sm:px-6">
            <div className="mx-auto max-w-[44rem]">
              {/* Service menu chips, grouped by the brief's three categories */}
              <div className="mb-2.5 flex flex-wrap gap-1">
                {(Object.keys(categoryLabels) as ServiceCategory[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="rounded-[2px] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.11em] transition-colors"
                    style={{
                      color: c === category ? "var(--brass)" : "var(--faint)",
                      borderBottom: `1px solid ${c === category ? "var(--brass)" : "transparent"}`,
                    }}
                  >
                    {categoryLabels[c]}
                  </button>
                ))}
              </div>
              <div className="scroll-thin mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {chips.map((chip) =>
                  chip.active ? (
                    <button
                      key={chip.label}
                      onClick={() => send(chip.prompt)}
                      disabled={busy}
                      className="shrink-0 rounded-full border border-[var(--rule)] px-3 py-1.5 text-[0.78rem] text-[var(--muted)] transition-colors hover:border-[var(--brass)] hover:text-[var(--brass)] disabled:opacity-40"
                    >
                      {chip.label}
                    </button>
                  ) : (
                    <span
                      key={chip.label}
                      title="Listed in the service menu, not enabled in this configuration"
                      className="shrink-0 cursor-default rounded-full border border-dashed border-[var(--rule)] px-3 py-1.5 text-[0.78rem] text-[var(--faint)]"
                    >
                      {chip.label}
                    </span>
                  ),
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask Charli anything…"
                  className="scroll-thin max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-[3px] border border-[var(--rule)] bg-[var(--surface)] px-3.5 py-2.5 text-[0.94rem] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--brass)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || input.trim() === ""}
                  className="h-[2.75rem] shrink-0 rounded-[3px] border border-[var(--brass-dim)] bg-[var(--brass-dim)] px-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ink)] transition-opacity hover:opacity-90 disabled:opacity-35"
                >
                  Send
                </button>
              </form>

              {/* Discreet demonstration footer (L36) + presenter controls */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.62rem] tracking-[0.06em] text-[var(--faint)]">
                  {asset.footer}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => send(HERO_PROMPT)}
                    disabled={busy}
                    className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--faint)] transition-colors hover:text-[var(--brass)] disabled:opacity-40"
                  >
                    Hero journey
                  </button>
                  <span className="text-[var(--rule)]">·</span>
                  <button
                    onClick={() => setRails((v) => !v)}
                    title="Deterministic playback — stage insurance if the network drops"
                    className="font-mono text-[0.6rem] uppercase tracking-[0.1em] transition-colors"
                    style={{ color: rails ? "var(--brass)" : "var(--faint)" }}
                  >
                    Rails {rails ? "on" : "off"}
                  </button>
                  <span className="text-[var(--rule)]">·</span>
                  <button
                    onClick={reset}
                    className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--faint)] transition-colors hover:text-[var(--brass)]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Presenter trace panel ─────────────────────────────────────── */}
        <div className={showTrace ? "hidden lg:block" : "hidden"}>
          <TracePanel traces={traces} open={showTrace} onClose={() => setShowTrace(false)} />
        </div>
      </div>

      {/* Mobile: trace panel as a full-screen overlay */}
      {showTrace && (
        <div className="fixed inset-0 z-20 bg-[var(--ground)] lg:hidden">
          <TracePanel traces={traces} open onClose={() => setShowTrace(false)} />
        </div>
      )}
    </div>
  );
}
