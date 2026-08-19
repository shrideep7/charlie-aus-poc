/**
 * Presenter-only trace panel (L16, L144-157).
 *
 * Hidden by default so the tenant view stays clean; revealed with ⌘⇧T / Ctrl+⇧T
 * or ?presenter=1. Shows the eight fields the brief lists for every
 * interaction, plus the three additional escalation fields.
 */

"use client";

import type { TraceRecord } from "@/lib/types";

const label =
  "font-mono text-[0.6rem] uppercase tracking-[0.13em] text-[var(--faint)]";

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 px-4 py-1.5">
      <span className={`${label} pt-0.5`}>{name}</span>
      <div className="min-w-0 text-[0.8rem] leading-relaxed text-[var(--ink)]">{children}</div>
    </div>
  );
}

function Tags({ items, tone }: { items: string[]; tone?: string }) {
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-[2px] border px-1.5 py-px font-mono text-[0.64rem]"
          style={{
            borderColor: tone ?? "var(--rule)",
            color: tone ?? "var(--muted)",
          }}
        >
          {item}
        </span>
      ))}
    </span>
  );
}

function TraceEntry({ trace }: { trace: TraceRecord }) {
  const confidenceTone =
    trace.confidence === "High"
      ? "var(--ok)"
      : trace.confidence === "Medium"
        ? "var(--warn)"
        : "var(--crit)";
  const entities = Object.entries(trace.entities);

  return (
    <details open className="border-b border-[var(--hairline)]">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 bg-[var(--sunk)] px-4 py-2">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-[var(--brass)]">
            Turn {trace.turn}
          </span>
          {trace.route && (
            <span className="font-mono text-[0.64rem] text-[var(--muted)]">{trace.route}</span>
          )}
        </span>
        <span className="font-mono text-[0.62rem] text-[var(--faint)] tabular">
          {trace.latencyMs != null ? `${(trace.latencyMs / 1000).toFixed(1)}s` : ""}
          {trace.engine === "scripted" ? " · rails" : ""}
        </span>
      </summary>
      <div className="py-1.5">
        <Field name="Asset">{trace.asset}</Field>
        <Field name="User request">
          <span className="text-[var(--muted)]">&ldquo;{trace.userRequest}&rdquo;</span>
        </Field>
        <Field name="Intent(s)">
          <Tags items={trace.intents} tone="var(--brass)" />
        </Field>
        <Field name="Entities">
          {entities.length === 0 ? (
            <span className="text-[var(--faint)]">—</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {entities.map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-[2px] border border-[var(--rule)] px-1.5 py-px font-mono text-[0.64rem]"
                >
                  <span className="text-[var(--faint)]">{k}:</span>{" "}
                  <span className="text-[var(--ink)]">{v}</span>
                </span>
              ))}
            </span>
          )}
        </Field>
        <Field name="Confidence">
          <span
            className="rounded-[2px] border px-1.5 py-px font-mono text-[0.64rem] uppercase tracking-[0.1em]"
            style={{ borderColor: confidenceTone, color: confidenceTone }}
          >
            {trace.confidence}
          </span>
        </Field>
        <Field name="Rules applied">
          <Tags items={trace.rulesApplied} />
        </Field>
        <Field name="Actions">
          <ul className="space-y-0.5">
            {trace.actions.map((a, i) => (
              <li key={i} className="text-[var(--muted)]">
                {a}
              </li>
            ))}
          </ul>
        </Field>
        <Field name="Outcome">
          <span className="font-mono text-[0.76rem] text-[var(--brass)] tabular">
            {trace.outcome}
          </span>
        </Field>
        {trace.urgency && (
          <>
            <div className="mx-4 my-1.5 border-t border-dashed border-[var(--rule)]" />
            <Field name="Urgency">
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-[var(--crit)]">
                {trace.urgency}
              </span>
            </Field>
            <Field name="Destination">{trace.destinationTeam}</Field>
            <Field name="Hand-off">
              <span className="text-[var(--muted)]">{trace.handoffSummary}</span>
            </Field>
          </>
        )}
      </div>
    </details>
  );
}

export function TracePanel({
  traces,
  open,
  onClose,
}: {
  traces: TraceRecord[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const turnsUsed = traces.length;

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-[var(--rule)] bg-[var(--ground)] lg:w-[26rem]"
      aria-label="Presenter trace panel"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <h2 className="font-display text-[1.05rem] font-semibold">Trace</h2>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--faint)]">
            Presenter only · {turnsUsed} {turnsUsed === 1 ? "turn" : "turns"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-[2px] border border-[var(--rule)] px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-[var(--muted)] transition-colors hover:border-[var(--brass)] hover:text-[var(--brass)]"
        >
          Hide
        </button>
      </header>
      <div className="scroll-thin flex-1 overflow-y-auto">
        {traces.length === 0 ? (
          <p className="px-4 py-6 text-[0.82rem] text-[var(--faint)]">
            Waiting for the first interaction.
          </p>
        ) : (
          [...traces].reverse().map((t) => <TraceEntry key={t.turn} trace={t} />)
        )}
      </div>
    </aside>
  );
}
