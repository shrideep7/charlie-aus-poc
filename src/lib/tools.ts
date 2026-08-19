/**
 * Charli's tool surface — six tools, deliberately small.
 *
 * 1. record_trace           forced first call every turn, so the presenter
 *                           trace panel can never be empty (L145)
 * 2. find_spaces            real availability logic over the catalogue (L106)
 * 3. create_booking         issues BK-MP-#### after confirmation (L107)
 * 4. submit_service_request THE one generic handler for all non-booking
 *                           requests, as mandated by L180
 * 5. lookup_request_status  pre-seeded case lookup (L15, L175)
 * 6. escalate               returns the brief's safety copy verbatim (L31-34)
 *
 * The executors are shared by the live engine and the scripted engine, so both
 * produce identical references, routing and card payloads.
 */

import Anthropic from "@anthropic-ai/sdk";
import { asset, escalationTiers, type EscalationTier, type Team } from "@/config/asset";
import { findCase } from "@/config/cases";
import { findSpaces, toFriendly, type SpaceSearchResult } from "@/config/spaces";
import { serviceById, services } from "@/config/services";
import { allocateReference } from "./references";
import type { Card, Confidence, TraceRecord } from "./types";

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

// ── Tool definitions ───────────────────────────────────────────────────────

const serviceIds = services.filter((s) => s.meta.active).map((s) => s.service_id);

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "record_trace",
    description:
      "Record what you understood about the tenant's request. You MUST call this first, before any other tool and before replying, on every single turn. It populates the presenter trace panel.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        intents: {
          type: "array",
          items: { type: "string" },
          description:
            "Every intent in this request, e.g. ['Space booking', 'Guest-pass request']. List all of them for a multi-part request.",
        },
        entities: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
            "Entities you extracted, e.g. {date: 'Tomorrow', time: '08:00', attendees: 'six'}.",
        },
        confidence: { type: "string", enum: ["High", "Medium", "Low"] },
        rules_applied: {
          type: "array",
          items: { type: "string" },
          description:
            "Configuration rules that applied, e.g. ['After-hours mode', 'Standard room booking'].",
        },
        route: {
          type: "string",
          description:
            "The simulated route: Space booking, Visitor Services, Access support, Access approval, Amenity guidance, Building Support, After-Hours Building Support, Concierge Services, or Status update.",
        },
      },
      required: ["intents", "entities", "confidence", "rules_applied", "route"],
    },
    strict: true,
  },
  {
    name: "find_spaces",
    description:
      "Search the room catalogue by capacity, start time and duration. Returns a recommended space and one alternative, with capacity, equipment, booking rules and availability. Call this before proposing any room.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        capacity: { type: "integer", description: "Number of people who need to fit." },
        start: { type: "string", description: "Start time as 24-hour HH:MM, e.g. '08:00'." },
        duration_minutes: { type: "integer", description: "Duration in minutes." },
        external_guests: {
          type: "boolean",
          description: "True when external visitors will attend — triggers approval rules.",
        },
      },
      required: ["capacity", "start", "duration_minutes", "external_guests"],
    },
    strict: true,
  },
  {
    name: "create_booking",
    description:
      "Create a simulated room booking. Only call this after the tenant has confirmed which space they want.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        space_id: { type: "string", description: "The space id returned by find_spaces." },
        start: { type: "string", description: "Start time as 24-hour HH:MM." },
        duration_minutes: { type: "integer" },
        attendees: { type: "integer" },
        external_guests: { type: "boolean" },
      },
      required: ["space_id", "start", "duration_minutes", "attendees", "external_guests"],
    },
    strict: true,
  },
  {
    name: "submit_service_request",
    description:
      "The single handler for every non-booking request: guest passes, contractor access, building tours, access support, building or amenity issues, taxis, restaurant reservations, charger and umbrella loans, luggage storage and event support. Pass whatever fields you have; the tool tells you which required fields are still missing. It only creates a request — and returns a reference — once every required field is supplied.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        service_id: { type: "string", enum: serviceIds },
        fields: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Values you have collected, keyed by required field name.",
        },
      },
      required: ["service_id", "fields"],
    },
    strict: true,
  },
  {
    name: "lookup_request_status",
    description:
      "Look up the status of a request the tenant raised earlier. Accepts a reference number or a plain-language description such as 'my lighting request'.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "A reference number or a description." },
      },
      required: ["query"],
    },
    strict: true,
  },
  {
    name: "escalate",
    description:
      "Route a safety or approval matter to the right team. Returns the exact wording you must use — reply with the returned `message` verbatim, with nothing added before it. Tiers: emergency (fire, smoke, medical, immediate danger), security (suspicious person or incident), urgent_building (water ingress, lighting failure, lift entrapment, anything needing priority attendance), approval (a request that needs Building Support approval before it can be granted).",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        tier: {
          type: "string",
          enum: ["emergency", "security", "urgent_building", "approval"],
        },
        location: {
          type: "string",
          description: "Where the tenant is, e.g. 'Level 17'. Empty string if unknown.",
        },
        required_details: {
          type: "string",
          description:
            "For the approval tier only: the details you need, e.g. 'the company, contact name, purpose of visit and expected arrival time'. Empty string otherwise.",
        },
        summary: { type: "string", description: "One line describing the matter." },
      },
      required: ["tier", "location", "required_details", "summary"],
    },
    strict: true,
  },
];

// ── Executor ───────────────────────────────────────────────────────────────

export interface ToolContext {
  referenceCursor: Record<string, number>;
  issued: { reference: string; label: string }[];
  /** Search results cached within a turn so create_booking can resolve a space. */
  lastSearch?: SpaceSearchResult;
  trace: Partial<TraceRecord>;
  /** Accumulated by executeTool, so the trace reports what actually ran. */
  actions: string[];
  outcomes: string[];
}

export interface ToolOutcome {
  /** JSON handed back to the model as the tool_result. */
  result: unknown;
  /** Card to render in the conversation, if any. */
  card?: Card;
  /** Human-readable action for the trace "Actions" field. */
  action: string;
  /** Outcome fragment for the trace "Outcome" field. */
  outcome?: string;
}

export function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolOutcome {
  const outcome = dispatch(name, input, ctx);
  // record_trace is observability, not an action Charli took.
  if (name !== "record_trace") {
    ctx.actions.push(outcome.action);
    if (outcome.outcome) ctx.outcomes.push(outcome.outcome);
  }
  return outcome;
}

function dispatch(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolOutcome {
  switch (name) {
    case "record_trace":
      return execRecordTrace(input, ctx);
    case "find_spaces":
      return execFindSpaces(input, ctx);
    case "create_booking":
      return execCreateBooking(input, ctx);
    case "submit_service_request":
      return execSubmitServiceRequest(input, ctx);
    case "lookup_request_status":
      return execLookupStatus(input);
    case "escalate":
      return execEscalate(input, ctx);
    default:
      return { result: { error: `Unknown tool: ${name}` }, action: `Unknown tool ${name}` };
  }
}

function execRecordTrace(input: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  ctx.trace.intents = (input.intents as string[]) ?? [];
  ctx.trace.entities = (input.entities as Record<string, string>) ?? {};
  ctx.trace.confidence = (input.confidence as Confidence) ?? "Medium";
  ctx.trace.rulesApplied = (input.rules_applied as string[]) ?? [];
  ctx.trace.route = (input.route as string) ?? undefined;
  return { result: { recorded: true }, action: "Recorded intent and entities" };
}

function execFindSpaces(input: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const search = findSpaces({
    capacity: Number(input.capacity) || 1,
    start: String(input.start ?? "08:00"),
    durationMinutes: Number(input.duration_minutes) || 60,
    externalGuests: Boolean(input.external_guests),
  });
  ctx.lastSearch = search;
  ctx.trace.rulesApplied = Array.from(
    new Set([...(ctx.trace.rulesApplied ?? []), ...search.rulesApplied]),
  );

  const describe = (m: typeof search.recommended) =>
    m === null
      ? null
      : {
          space_id: m.space.id,
          name: m.space.name,
          capacity: m.space.capacity,
          equipment: m.space.equipment,
          booking_rule: m.space.bookingRule,
          window: `${toFriendly(toMinutes(m.start))}–${toFriendly(toMinutes(m.end))}`,
          requires_approval: m.requiresApproval,
          approval_reason: m.approvalReason ?? null,
        };

  return {
    result: {
      recommended: describe(search.recommended),
      alternative: describe(search.alternative),
      unavailable: search.rejected.map((r) => ({
        name: r.space.name,
        capacity: r.space.capacity,
        reason: r.reason,
        availability: r.space.availabilityLabel,
      })),
    },
    card: { kind: "room_options", search },
    action: "Searched space catalogue",
  };
}

function execCreateBooking(input: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const spaceId = String(input.space_id ?? "");
  const match =
    ctx.lastSearch?.recommended?.space.id === spaceId
      ? ctx.lastSearch.recommended
      : ctx.lastSearch?.alternative?.space.id === spaceId
        ? ctx.lastSearch.alternative
        : undefined;

  const start = String(input.start ?? match?.start ?? "08:00");
  const duration = Number(input.duration_minutes) || 90;
  const startM = toMinutes(start);
  const endM = startM + duration;

  const space = match?.space ?? findSpaces({ capacity: 1, start, durationMinutes: duration }).recommended?.space;
  if (!space) {
    return { result: { error: "No such space" }, action: "Booking failed — unknown space" };
  }

  const { reference, cursor } = allocateReference("booking", ctx.referenceCursor);
  ctx.referenceCursor = cursor;
  const window = `${toFriendly(startM)}–${toFriendly(endM)}`;
  ctx.issued.push({ reference, label: `${space.name}, ${window}` });

  const requiresApproval =
    space.approvalRequired || (Boolean(input.external_guests) && space.externalGuestApproval);

  return {
    result: {
      reference,
      space: space.name,
      window,
      routing_team: "Concierge Services",
      approval_note: requiresApproval
        ? "Submitted to Building Support for approval as the booking rule requires."
        : null,
    },
    card: {
      kind: "confirmation",
      reference,
      title: `${space.name} reserved`,
      team: "Concierge Services",
      details: [
        { label: "Space", value: space.name },
        { label: "When", value: `Tomorrow, ${window}` },
        { label: "Attendees", value: String(input.attendees ?? "—") },
        { label: "Equipment", value: space.equipment.join(", ") || "None" },
        { label: "Booking rule", value: space.bookingRule },
      ],
      nextStep: requiresApproval
        ? "Submitted to Building Support for approval — I'll confirm as soon as it's granted."
        : "The room will be unlocked and set up before you arrive.",
    },
    action: `Created simulated booking for ${space.name}`,
    outcome: reference,
  };
}

function execSubmitServiceRequest(
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolOutcome {
  const serviceId = String(input.service_id ?? "");
  const service = serviceById(serviceId);
  if (!service) {
    return { result: { error: `Unknown service_id: ${serviceId}` }, action: "Unknown service" };
  }
  if (!service.meta.active) {
    return {
      result: {
        error: "This service is listed in the menu but is not enabled in this configuration.",
      },
      action: `${service.service_name} is display only`,
    };
  }

  const fields = (input.fields as Record<string, string>) ?? {};
  const missing = service.required_fields.filter(
    (f) => !fields[f] || String(fields[f]).trim() === "",
  );

  if (missing.length > 0) {
    // Data-driven slot filling: ask for one missing detail at a time (L130).
    return {
      result: {
        status: "incomplete",
        missing_fields: missing,
        ask_next: service.meta.fieldPrompts[missing[0]] ?? missing[0],
        collected: fields,
      },
      action: `Loaded required details for ${service.service_name}`,
    };
  }

  const { reference, cursor } = allocateReference(service.meta.family, ctx.referenceCursor);
  ctx.referenceCursor = cursor;
  ctx.issued.push({ reference, label: service.service_name });

  const details = service.required_fields.map((f) => ({
    label: f.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    value: fields[f],
  }));

  return {
    result: {
      status: "created",
      reference,
      service_name: service.service_name,
      routing_team: service.routing_team,
      requires_approval: service.meta.approval,
      follow_up: service.meta.followUp,
    },
    card: {
      kind: "confirmation",
      reference,
      title: service.service_name,
      team: service.routing_team,
      details,
      nextStep: service.meta.approval
        ? `Submitted to ${service.routing_team} for approval — I'll confirm as soon as it's granted.`
        : `${service.routing_team} has this now.`,
    },
    action: `Created ${service.service_name} via generic service handler`,
    outcome: reference,
  };
}

function execLookupStatus(input: Record<string, unknown>): ToolOutcome {
  const query = String(input.query ?? "");
  const found = findCase(query);
  if (!found) {
    return {
      result: {
        status: "not_found",
        open_requests: [],
      },
      action: "Searched request history — no match",
    };
  }
  return {
    result: {
      reference: found.reference,
      service: found.service,
      status: found.status,
      team: found.team,
      raised: found.raised,
      update: found.update,
      next_step: found.nextStep,
    },
    card: {
      kind: "status",
      reference: found.reference,
      service: found.service,
      status: found.status,
      team: found.team,
      raised: found.raised,
    },
    action: `Retrieved status for ${found.reference}`,
    outcome: found.reference,
  };
}

function execEscalate(input: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const tier = String(input.tier ?? "urgent_building") as EscalationTier;
  const config = escalationTiers[tier] ?? escalationTiers.urgent_building;
  const location = String(input.location ?? "").trim();
  const requiredDetails = String(input.required_details ?? "").trim();

  // Verbatim copy from the brief with the slot substituted — never generated.
  let message: string = config.template;
  if ("locationFallback" in config) {
    message = message.replace(
      "{location}",
      location || (config as { locationFallback: string }).locationFallback,
    );
  }
  message = message.replace("{required_details}", requiredDetails || "the required details");

  const team: Team = config.team;
  ctx.trace.urgency = config.urgency;
  ctx.trace.destinationTeam = team;
  ctx.trace.handoffSummary = config.handoffSummary;
  ctx.trace.rulesApplied = Array.from(
    new Set([...(ctx.trace.rulesApplied ?? []), config.priorityRule]),
  );

  // Emergency and security are immediate hand-offs, not logged requests, so
  // they do not carry a reference. Urgent building issues do.
  let reference: string | undefined;
  if (tier === "urgent_building") {
    const allocated = allocateReference("support", ctx.referenceCursor);
    ctx.referenceCursor = allocated.cursor;
    reference = allocated.reference;
    ctx.issued.push({ reference, label: String(input.summary ?? config.label) });
  }

  return {
    result: {
      message,
      tier,
      urgency: config.urgency,
      destination_team: team,
      handoff_summary: config.handoffSummary,
      reference: reference ?? null,
      instruction:
        "Reply with the `message` field exactly as given, as the first thing you say. Do not paraphrase it, do not add a preamble.",
    },
    card: {
      kind: "escalation",
      tier,
      label: config.label,
      urgency: config.urgency,
      team,
      handoffSummary: config.handoffSummary,
      reference,
    },
    action: `Escalated — ${config.label} to ${team}`,
    outcome: reference ?? `${config.label} hand-off`,
  };
}

export const traceScaffold = (turn: number, userRequest: string): Partial<TraceRecord> => ({
  turn,
  asset: asset.name,
  userRequest,
  intents: [],
  entities: {},
  confidence: "Medium",
  rulesApplied: ["After-hours mode"],
  actions: [],
  outcome: "",
});
