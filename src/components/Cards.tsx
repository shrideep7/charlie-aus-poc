/**
 * Rich cards rendered inline in the conversation.
 *
 * Each card maps to a specific requirement rather than being decoration:
 *  RoomOptions   -> recommended space plus one alternative (L106)
 *  Confirmation  -> reference, routing team, next step (L28, L132)
 *  Guidance      -> static route steps, never a live map (L21, L79-80)
 *  Recommendations -> at most three options (L109, L182)
 *  Escalation    -> tier, urgency, team, hand-off summary (L30-34, L157)
 *  Itinerary     -> hero-journey finale carrying every reference (L111)
 *  Status        -> pre-seeded case state (L15, L83)
 */

import { toFriendly } from "@/config/spaces";
import type { Card } from "@/lib/types";

const shell =
  "rounded-[3px] border border-[var(--hairline)] bg-[var(--surface)] overflow-hidden";
const label =
  "font-mono text-[0.62rem] uppercase tracking-[0.13em] text-[var(--faint)]";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

function Reference({ value }: { value: string }) {
  return (
    <span className="font-mono text-[0.8rem] font-medium tracking-tight text-[var(--brass)] tabular">
      {value}
    </span>
  );
}

const rejectionCopy: Record<string, string> = {
  capacity: "Too small",
  outside_window: "Outside available hours",
  blocked: "Already booked",
  max_duration: "Exceeds maximum duration",
};

function RoomOptions({ card }: { card: Extract<Card, { kind: "room_options" }> }) {
  const { recommended, alternative, rejected, query } = card.search;
  const window = `${toFriendly(toMinutes(query.start))}–${toFriendly(
    toMinutes(query.start) + query.durationMinutes,
  )}`;

  return (
    <div className={shell}>
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className={label}>Space availability</span>
        <span className="font-mono text-[0.68rem] text-[var(--muted)] tabular">
          {query.capacity} people · {window}
        </span>
      </div>
      <div className="divide-y divide-[var(--hairline)]">
        {[recommended, alternative].map((match, i) =>
          match === null ? null : (
            <div key={match.space.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className={label}>{i === 0 ? "Recommended" : "Alternative"}</span>
                <span className="font-display text-[1.05rem] font-semibold">
                  {match.space.name}
                </span>
                <span className="font-mono text-[0.7rem] text-[var(--muted)] tabular">
                  seats {match.space.capacity}
                </span>
                {match.requiresApproval && (
                  <span className="rounded-[2px] border border-[var(--warn)] px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--warn)]">
                    Approval
                  </span>
                )}
              </div>
              <p className="mt-1 text-[0.84rem] leading-relaxed text-[var(--muted)]">
                {match.space.equipment.length > 0
                  ? match.space.equipment.join(", ")
                  : "No equipment"}
                {" · "}
                {match.space.bookingRule}
                {" · "}
                {match.space.availabilityLabel}
              </p>
            </div>
          ),
        )}
        {rejected.length > 0 && (
          <div className="px-4 py-3">
            <span className={label}>Not available</span>
            <ul className="mt-1.5 space-y-1">
              {rejected.map((r) => (
                <li
                  key={r.space.id}
                  className="flex flex-wrap items-baseline gap-x-2 text-[0.8rem] text-[var(--faint)]"
                >
                  <span className="text-[var(--muted)]">{r.space.name}</span>
                  <span className="font-mono text-[0.68rem] tabular">
                    seats {r.space.capacity}
                  </span>
                  <span>— {rejectionCopy[r.reason ?? ""] ?? "Unavailable"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Confirmation({ card }: { card: Extract<Card, { kind: "confirmation" }> }) {
  return (
    <div className={shell}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className="font-display text-[1.02rem] font-semibold">{card.title}</span>
        <Reference value={card.reference} />
      </div>
      <dl className="divide-y divide-[var(--hairline)]">
        {card.details.map((d) => (
          <div key={d.label} className="flex gap-4 px-4 py-2">
            <dt className={`${label} w-28 shrink-0 pt-0.5`}>{d.label}</dt>
            <dd className="text-[0.86rem] text-[var(--ink)]">{d.value}</dd>
          </div>
        ))}
        <div className="flex gap-4 px-4 py-2">
          <dt className={`${label} w-28 shrink-0 pt-0.5`}>Routed to</dt>
          <dd className="text-[0.86rem] text-[var(--ink)]">{card.team}</dd>
        </div>
      </dl>
      <p className="border-t border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5 text-[0.82rem] text-[var(--muted)]">
        {card.nextStep}
      </p>
    </div>
  );
}

function Guidance({ card }: { card: Extract<Card, { kind: "guidance" }> }) {
  return (
    <div className={shell}>
      <div className="border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className="font-display text-[1.02rem] font-semibold">{card.card.title}</span>
      </div>
      <ol className="space-y-2 px-4 py-3">
        {card.card.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[0.86rem] leading-relaxed">
            <span className="mt-px font-mono text-[0.7rem] text-[var(--brass)] tabular">
              {i + 1}
            </span>
            <span className="text-[var(--ink)]">{step}</span>
          </li>
        ))}
      </ol>
      {card.card.note && (
        <p className="border-t border-[var(--hairline)] px-4 py-2.5 text-[0.8rem] text-[var(--faint)]">
          {card.card.note}
        </p>
      )}
    </div>
  );
}

function Recommendations({ card }: { card: Extract<Card, { kind: "recommendations" }> }) {
  return (
    <div className={shell}>
      <div className="border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className={label}>{card.label}</span>
      </div>
      <div className="divide-y divide-[var(--hairline)]">
        {card.items.map((item) => (
          <div key={item.name} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="font-display text-[1.02rem] font-semibold">{item.name}</span>
              <span className="font-mono text-[0.68rem] text-[var(--brass)]">{item.walk}</span>
            </div>
            <p className="mt-0.5 text-[0.84rem] leading-relaxed text-[var(--muted)]">
              {item.descriptor}. {item.bestFor}.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Escalation({ card }: { card: Extract<Card, { kind: "escalation" }> }) {
  const tone =
    card.tier === "emergency"
      ? "var(--crit)"
      : card.tier === "security" || card.tier === "urgent_building"
        ? "var(--warn)"
        : "var(--brass)";
  return (
    <div className={shell} style={{ borderLeft: `3px solid ${tone}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className="font-display text-[1.02rem] font-semibold" style={{ color: tone }}>
          {card.label}
        </span>
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: tone }}>
          {card.urgency}
        </span>
      </div>
      <dl className="divide-y divide-[var(--hairline)]">
        <div className="flex gap-4 px-4 py-2">
          <dt className={`${label} w-28 shrink-0 pt-0.5`}>Routed to</dt>
          <dd className="text-[0.86rem]">{card.team}</dd>
        </div>
        {card.reference && (
          <div className="flex gap-4 px-4 py-2">
            <dt className={`${label} w-28 shrink-0 pt-0.5`}>Reference</dt>
            <dd>
              <Reference value={card.reference} />
            </dd>
          </div>
        )}
        <div className="flex gap-4 px-4 py-2">
          <dt className={`${label} w-28 shrink-0 pt-0.5`}>Hand-off</dt>
          <dd className="text-[0.84rem] text-[var(--muted)]">{card.handoffSummary}</dd>
        </div>
      </dl>
    </div>
  );
}

function Itinerary({ card }: { card: Extract<Card, { kind: "itinerary" }> }) {
  return (
    <div className={shell} style={{ borderColor: "var(--brass-dim)" }}>
      <div className="border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className="font-display text-[1.08rem] font-semibold">{card.title}</span>
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {card.lines.map((line, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="w-24 shrink-0 font-mono text-[0.72rem] text-[var(--brass)] tabular">
              {line.label}
            </span>
            <span className="flex-1 text-[0.86rem]">{line.value}</span>
            {line.reference && <Reference value={line.reference} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Status({ card }: { card: Extract<Card, { kind: "status" }> }) {
  return (
    <div className={shell}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--sunk)] px-4 py-2.5">
        <span className="font-display text-[1.02rem] font-semibold">{card.service}</span>
        <Reference value={card.reference} />
      </div>
      <dl className="divide-y divide-[var(--hairline)]">
        {[
          ["Status", card.status],
          ["Raised", card.raised],
          ["Owner", card.team],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-2">
            <dt className={`${label} w-28 shrink-0 pt-0.5`}>{k}</dt>
            <dd className="text-[0.86rem]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CardView({ card }: { card: Card }) {
  switch (card.kind) {
    case "room_options":
      return <RoomOptions card={card} />;
    case "confirmation":
      return <Confirmation card={card} />;
    case "guidance":
      return <Guidance card={card} />;
    case "recommendations":
      return <Recommendations card={card} />;
    case "escalation":
      return <Escalation card={card} />;
    case "itinerary":
      return <Itinerary card={card} />;
    case "status":
      return <Status card={card} />;
  }
}
