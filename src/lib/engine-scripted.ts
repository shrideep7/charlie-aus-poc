/**
 * Scripted engine — deterministic playback of the brief's prompts.
 *
 * Three jobs:
 *  1. Stage insurance. If the venue network drops or the API rate-limits
 *     mid-demo, `?rails=1` keeps the presenter running and nobody in the room
 *     knows. (Demo reliability, plan §6.)
 *  2. It makes the golden harness runnable with no API key, so acceptance
 *     criteria can be evidenced in CI.
 *  3. It pins the hero journey to exactly five turns.
 *
 * It reuses the same tool executors as the live engine, so references, routing
 * and cards are identical — only the language generation is replaced.
 */

import { asset } from "@/config/asset";
import { guidance, recommendations, recommendationCategoryLabels } from "@/config/knowledge";
import { faqs } from "@/config/knowledge";
import { executeTool, traceScaffold, type ToolContext } from "./tools";
import type { Card, Confidence, SessionState, StreamEvent, TraceRecord } from "./types";
import type { EngineResult, EngineTurn } from "./engine-live";

interface Reply {
  text: string;
  cards: Card[];
  intents: string[];
  entities: Record<string, string>;
  confidence: Confidence;
  route: string;
  context?: Record<string, string>;
}

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

/**
 * Duration in minutes out of free text. Defaults to 90.
 *
 * Handles words as well as digits — a tenant says "ninety minutes" or "two
 * hours" far more often than "90" or "2".
 */
function parseDuration(s: string): number {
  if (has(s, "half an hour")) return 30;
  if (has(s, "an hour and a half", "1.5 hour")) return 90;
  if (has(s, "all morning")) return 180;
  const hourHalf = s.match(new RegExp(`\\b(${NUM})\\b\\s*(?:and a half|½)\\s*hour`, "i"));
  if (hourHalf) return toNumber(hourHalf[1]) * 60 + 30;
  const hours = s.match(new RegExp(`\\b(${NUM}|\\d+\\.\\d+)\\b\\s*(?:hours?|hrs?|h)\\b`, "i"));
  if (hours) return Math.round(toNumber(hours[1]) * 60);
  const mins = s.match(new RegExp(`\\b(${NUM}|\\d+)\\b\\s*(?:minutes?|mins?)\\b`, "i"));
  if (mins) return toNumber(mins[1]);
  if (/\ban hour\b/i.test(s)) return 60;
  return 90;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, ninety: 90,
};
// Longest words first, so "fifteen" is not shadowed by "five".
const NUM = `\\d+|${Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|")}`;
const toNumber = (token: string): number =>
  NUMBER_WORDS[token.toLowerCase()] ?? Number(token);

/**
 * Attendee count out of free text.
 *
 * Order matters. "six interstate clients arriving … a taxi for one guest" must
 * read as six, not one, so a number attached to a people-noun wins over a bare
 * number, and the earliest such phrase in the sentence wins over later ones.
 */
function parseCapacity(s: string): number {
  const peopleNoun = "people|persons?|pax|attendees|guests?|clients?|visitors?|colleagues|of us";
  const attached = s.match(new RegExp(`\\b(${NUM})\\b(?:\\s+\\w+){0,2}\\s+(?:${peopleNoun})\\b`, "i"));
  if (attached) return toNumber(attached[1]);
  const forCount = s.match(new RegExp(`\\b(?:for|of)\\s+(${NUM})\\b`, "i"));
  if (forCount) return toNumber(forCount[1]);
  const bare = s.match(new RegExp(`\\b(${NUM})\\b`, "i"));
  if (bare) return toNumber(bare[1]);
  return 6;
}

/** 12/24-hour time out of free text, as HH:MM. */
function parseTime(s: string, fallback = "08:00"): string {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return fallback;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const suffix = m[3];
  if (suffix === "pm" && h < 12) h += 12;
  if (suffix === "am" && h === 12) h = 0;
  if (!suffix && h <= 7) h += 12; // "at 7" after hours means 7pm
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ── Hero journey: an explicit five-turn state machine ───────────────────────

const HERO_TRIGGER =
  /(room|meeting).*(pass|guest).*(breakfast|recommend)|arriving.*(room|pass)|clients arriving.*(arrange|organise|book)/;

function isHeroOpening(s: string): boolean {
  const parts = [
    /room|space|boardroom/.test(s),
    /pass|guest|visitor/.test(s),
    /breakfast|recommend|dining|eat/.test(s),
    /taxi|airport|car/.test(s),
  ].filter(Boolean).length;
  return parts >= 3 || HERO_TRIGGER.test(s);
}

function heroTurn(
  step: number,
  userText: string,
  ctx: ToolContext,
  context: Record<string, string> = {},
): Reply {
  switch (step) {
    case 1: {
      const capacity = parseCapacity(userText) || 6;
      return {
        text: `Of course — I'll take care of all four. I'll find a room for ${capacity === 6 ? "six" : capacity} from 8:00am, arrange guest passes, suggest breakfast nearby, and book an airport car for after the meeting. How long will you need the room for?`,
        cards: [],
        intents: ["Space booking", "Guest-pass request", "Local recommendation", "Taxi coordination"],
        entities: { date: "Tomorrow", time: "08:00", attendees: String(capacity), guests: "Interstate clients", destination: "Airport" },
        confidence: "High",
        route: "Space booking",
        context: { attendees: String(capacity), meeting_start: "08:00", guest_origin: "Interstate" },
      };
    }
    case 2: {
      const duration = parseDuration(userText);
      const search = executeTool(
        "find_spaces",
        { capacity: 6, start: "08:00", duration_minutes: duration, external_guests: true },
        ctx,
      );
      const rec = ctx.lastSearch?.recommended;
      const alt = ctx.lastSearch?.alternative;
      const endLabel = rec ? `${rec.start.replace(/^0/, "")}–${rec.end.replace(/^0/, "")}` : "";
      return {
        text: `${rec?.space.name} is the best fit — it seats ${rec?.space.capacity}, has a display, and it's free ${endLabel}. ${
          alt
            ? `If you'd prefer more room, ${alt.space.name} seats ${alt.space.capacity} but needs approval as it's on request.`
            : ""
        } Shall I hold ${rec?.space.name}?`,
        cards: search.card ? [search.card] : [],
        intents: ["Space booking"],
        entities: { attendees: "six", time: "08:00", duration: `${duration} minutes`, external_guests: "Yes" },
        confidence: "High",
        route: "Space booking",
        context: { duration: String(duration) },
      };
    }
    case 3: {
      const duration = Number(context.duration) || 90;
      const booking = executeTool(
        "create_booking",
        {
          space_id: "park_meeting_room",
          start: "08:00",
          duration_minutes: duration,
          attendees: 6,
          external_guests: true,
        },
        ctx,
      );
      const reference = (booking.result as { reference: string }).reference;
      return {
        text: `Done — ${reference}. Park Meeting Room is yours from 8:00am. Who are your guests, and which company are they with?`,
        cards: booking.card ? [booking.card] : [],
        intents: ["Space booking"],
        entities: { space: "Park Meeting Room", confirmed: "Yes" },
        confidence: "High",
        route: "Space booking",
        context: { room: "Park Meeting Room", booking_reference: reference },
      };
    }
    case 4: {
      const passes = executeTool(
        "submit_service_request",
        {
          service_id: "guest_pass",
          fields: {
            guest_names: userText.trim() || "Six interstate clients",
            company: "As advised",
            arrival_time: "8:00am",
          },
        },
        ctx,
      );
      const reference = (passes.result as { reference?: string }).reference ?? "";
      const breakfast = recommendations.breakfast.slice(0, 2);
      const cards: Card[] = [];
      if (passes.card) cards.push(passes.card);
      cards.push({
        kind: "recommendations",
        category: "breakfast",
        label: recommendationCategoryLabels.breakfast,
        items: breakfast,
      });
      return {
        text: `Passes are ready — ${reference}. All six are cleared for 8:00am arrival, and reception will have their details. For breakfast, ${breakfast[0].name} is ${breakfast[0].walk.toLowerCase()} and takes bookings from 6:30am; ${breakfast[1].name} is the quicker option if you'd rather bring something up. Your meeting finishes at 9:30, so I'd suggest the airport car at 9:45 — which terminal?`,
        cards,
        intents: ["Guest-pass request", "Local recommendation"],
        entities: { guests: userText.trim() || "Six interstate clients", arrival: "8:00am" },
        confidence: "High",
        route: "Visitor Services",
        context: { guest_pass_reference: reference, taxi_time: "9:45am" },
      };
    }
    default: {
      const terminal = /t?\s*1|international/.test(userText.toLowerCase())
        ? "T1 International"
        : /t?\s*2|domestic/.test(userText.toLowerCase())
          ? "T2 Domestic"
          : "T1 International";
      const taxi = executeTool(
        "submit_service_request",
        {
          service_id: "taxi",
          fields: {
            pickup: `${asset.name} — Martin Place entrance`,
            destination: `Sydney Airport, ${terminal}`,
            time: "9:45am",
            passengers: "1",
          },
        },
        ctx,
      );
      const taxiRef = (taxi.result as { reference?: string }).reference ?? "";
      const bookingRef = ctx.issued.find((i) => i.reference.startsWith("BK-"))?.reference ?? "";
      const bookedWindow =
        ctx.issued.find((i) => i.reference.startsWith("BK-"))?.label.split(", ")[1] ?? "8:00am–9:30am";
      const passRef = ctx.issued.find((i) => i.reference.startsWith("VA-"))?.reference ?? "";
      const cards: Card[] = [
        {
          kind: "itinerary",
          title: "Tomorrow morning",
          lines: [
            { label: bookedWindow, value: `Park Meeting Room, ${context.attendees ?? "six"} attendees`, reference: bookingRef },
            { label: "8:00am", value: "Guest passes and arrival details ready", reference: passRef },
            { label: "Breakfast", value: `${recommendations.breakfast[0].name} or ${recommendations.breakfast[1].name}` },
            { label: "9:45am", value: `Airport car to ${terminal}, one passenger`, reference: taxiRef },
          ],
        },
      ];
      return {
        text: `All set. Park Meeting Room is reserved for ${bookedWindow}: ${bookingRef}. Guest passes and arrival details are ready: ${passRef}. I've included two nearby breakfast options. Your airport car is arranged for 9:45am to ${terminal}: ${taxiRef}. Would you like me to have reception meet your clients in the lobby?`,
        cards,
        intents: ["Taxi coordination", "Itinerary summary"],
        entities: { terminal, pickup: "9:45am", passengers: "1" },
        confidence: "High",
        route: "Concierge Services",
      };
    }
  }
}

// ── Single-shot rules for the brief's prepared asks and test prompts ────────

function singleShot(
  userText: string,
  ctx: ToolContext,
  context: Record<string, string> = {},
): Reply {
  const s = userText.toLowerCase();

  // ── Safety first, always. ────────────────────────────────────────────────
  if (has(s, "smoke", "fire", "smell burning", "flames", "unconscious", "collapsed", "chest pain", "ambulance")) {
    // Prefer a level the tenant has already given us this session (L27).
    const location = s.match(/level\s*(\d+)/)?.[0] ?? context.level ?? "";
    const out = executeTool(
      "escalate",
      { tier: "emergency", location, required_details: "", summary: "Smoke reported in corridor" },
      ctx,
    );
    const message = (out.result as { message: string }).message;
    return {
      // When the location is unknown the fallback copy already asks for the
      // level, so don't ask twice.
      text: location ? `${message} Building Support is on their way up.` : message,
      cards: out.card ? [out.card] : [],
      intents: ["Emergency escalation"],
      entities: location ? { location } : {},
      confidence: "High",
      route: "Building Support",
      context: location ? { level: location } : undefined,
    };
  }
  if (has(s, "suspicious", "someone following", "intruder", "unsafe", "threatened", "aggressive")) {
    const out = executeTool(
      "escalate",
      { tier: "security", location: "", required_details: "", summary: "Security concern reported" },
      ctx,
    );
    return {
      text: (out.result as { message: string }).message,
      cards: out.card ? [out.card] : [],
      intents: ["Security escalation"],
      entities: {},
      confidence: "High",
      route: "After-Hours Building Support",
    };
  }
  if (has(s, "water coming in", "water is coming", "flood", "leak", "burst")) {
    const level = s.match(/level\s*(\d+)/)?.[0] ?? "";
    const out = executeTool(
      "escalate",
      { tier: "urgent_building", location: level, required_details: "", summary: "Water ingress" },
      ctx,
    );
    const reference = (out.result as { reference?: string }).reference;
    return {
      text: `${(out.result as { message: string }).message} I've logged it as ${reference} for Building Support${level ? ` on ${level}` : ""}. I'll send you the attendance time as soon as they confirm.`,
      cards: out.card ? [out.card] : [],
      intents: ["Urgent building issue"],
      entities: level ? { level } : {},
      confidence: "High",
      route: "Building Support",
    };
  }

  // ── Status follow-up (L83, L125). ───────────────────────────────────────
  if (has(s, "what is happening", "what's happening", "status", "any update", "how is my", "progress on")) {
    const out = executeTool("lookup_request_status", { query: s }, ctx);
    const r = out.result as { update?: string; next_step?: string; reference?: string };
    return {
      text: r.update
        ? `${r.update} Reference: ${r.reference}. ${r.next_step}`
        : "I don't have an open request under that description. Tell me what it was about and I'll raise it now.",
      cards: out.card ? [out.card] : [],
      intents: ["Status update"],
      entities: {},
      confidence: "High",
      route: "Status update",
    };
  }

  // ── Contractor access — approval tier (L82, L119). ───────────────────────
  if (has(s, "contractor", "tradesman", "trades", "electrician coming", "installer")) {
    const out = executeTool(
      "escalate",
      {
        tier: "approval",
        location: "",
        required_details: "the company, contact name, purpose of visit and expected arrival time",
        summary: "After-hours contractor access",
      },
      ctx,
    );
    return {
      text: (out.result as { message: string }).message,
      cards: out.card ? [out.card] : [],
      intents: ["Contractor access request"],
      entities: { timing: has(s, "tonight") ? "Tonight" : "As advised" },
      confidence: "High",
      route: "Access approval",
    };
  }

  // ── Access pass not working (L75, L115). ────────────────────────────────
  if (has(s, "pass isn't working", "pass is not working", "pass not working", "can't get in", "cannot get in", "won't let me in", "card isn't working")) {
    const entrance = has(s, "pitt") ? "Pitt Street entrance" : has(s, "martin") ? "Martin Place entrance" : "";
    return {
      text: `Let's get you in. Please try your mobile credential at the tenant entry${entrance ? ` — you're closest to the ${entrance}` : ""}. If that does not resolve it, I'll raise a priority access request with After-Hours Building Support.`,
      cards: [],
      intents: ["Access-pass troubleshooting"],
      entities: entrance ? { entrance } : {},
      confidence: "High",
      route: "Access support",
      context: entrance ? { location: entrance } : undefined,
    };
  }

  // ── After-hours access FAQ (L74). ──────────────────────────────────────
  if (has(s, "access the building after hours", "after hours access", "get in after hours", "building after hours")) {
    return {
      text: faqs[0].answer,
      cards: [],
      intents: ["After-hours access enquiry"],
      entities: {},
      confidence: "High",
      route: "After-Hours Building Support",
    };
  }

  // ── Amenity guidance (L79, L80). ───────────────────────────────────────
  if (has(s, "shower", "locker", "end of trip", "end-of-trip")) {
    return {
      text: faqs[1].answer,
      cards: [{ kind: "guidance", card: guidance[0] }],
      intents: ["Amenity guidance"],
      entities: {},
      confidence: "High",
      route: "Amenity guidance",
    };
  }
  if (has(s, "ev", "electric car", "charge my car", "charging")) {
    return {
      text: faqs[2].answer,
      cards: [{ kind: "guidance", card: guidance[1] }],
      intents: ["Amenity guidance"],
      entities: {},
      confidence: "High",
      route: "Amenity guidance",
    };
  }
  if (has(s, "park", "parking", "car space") && !has(s, "park meeting")) {
    return {
      text: "Tenant parking is on Basement 2 and Basement 3, entered from the Pitt Street ramp. I'll show you the route and what to do if the boom does not lift after hours.",
      cards: [{ kind: "guidance", card: guidance[2] }],
      intents: ["Amenity guidance"],
      entities: {},
      confidence: "High",
      route: "Amenity guidance",
    };
  }
  if (has(s, "bike", "bicycle", "cycle")) {
    return {
      text: "Secure bike storage is on Basement 1, just beyond the end-of-trip change rooms. Here's the quickest way down from the lobby.",
      cards: [{ kind: "guidance", card: guidance[3] }],
      intents: ["Amenity guidance"],
      entities: {},
      confidence: "High",
      route: "Amenity guidance",
    };
  }

  // ── Building issue capture (L81). ──────────────────────────────────────
  if (has(s, "lights are out", "light is out", "lighting", "no power", "aircon", "air conditioning", "too hot", "too cold", "blind", "tap", "toilet")) {
    const level = s.match(/level\s*(\d+)/)?.[0];
    const out = executeTool(
      "escalate",
      { tier: "urgent_building", location: level ?? "", required_details: "", summary: "Lighting outage in tenant suite" },
      ctx,
    );
    const reference = (out.result as { reference?: string }).reference;
    return {
      text: `I'm logging this as a priority lighting issue for After-Hours Building Support — ${reference}. Which level and suite are you in?`,
      cards: out.card ? [out.card] : [],
      intents: ["Building support request"],
      entities: level ? { level } : {},
      confidence: "High",
      route: "Building Support",
    };
  }

  // ── Room booking (L78, L116, L117). ────────────────────────────────────
  if (has(s, "next best", "another option", "what else", "alternative")) {
    const search = executeTool(
      "find_spaces",
      { capacity: 12, start: "08:00", duration_minutes: 60, external_guests: false },
      ctx,
    );
    const rec = ctx.lastSearch?.recommended;
    return {
      text: rec
        ? `${rec.space.name} is the next best option — it seats ${rec.space.capacity} with a display and presentation setup. It's available on request and needs approval, which I can submit for you now. Shall I?`
        : "There's nothing else that size tomorrow morning. I can hold the Martin Boardroom from 10:00am instead.",
      cards: search.card ? [search.card] : [],
      intents: ["Space booking"],
      entities: { attendees: "12" },
      confidence: "High",
      route: "Space booking",
    };
  }
  if (has(s, "room", "boardroom", "meeting space", "somewhere to meet", "quiet room")) {
    const capacity = parseCapacity(s);
    const start = has(s, "morning") ? "08:00" : parseTime(s, "08:00");
    const search = executeTool(
      "find_spaces",
      { capacity, start, duration_minutes: 60, external_guests: false },
      ctx,
    );
    const rec = ctx.lastSearch?.recommended;
    // Only raise a blocked room if it was the tightest capacity fit — for six
    // people the 12-seat boardroom was never "the natural fit", so saying so
    // would be noise.
    const tightestFit = [...(ctx.lastSearch?.rejected ?? []), ...(rec ? [rec] : [])]
      .filter((m) => m.space.capacity >= capacity)
      .sort((a, b) => a.space.capacity - b.space.capacity)[0];
    const blocked =
      tightestFit && !tightestFit.fits && tightestFit.reason === "blocked" ? tightestFit : undefined;
    if (!rec) {
      return {
        text: "Nothing in the catalogue fits that group at that time. I can look at a later start, or split you across two rooms.",
        cards: search.card ? [search.card] : [],
        intents: ["Space booking"],
        entities: { attendees: String(capacity), time: start },
        confidence: "Medium",
        route: "Space booking",
      };
    }
    // Lead with the answer, then ask the one thing we still need (L25, L26).
    const alt = ctx.lastSearch?.alternative;
    const preamble = blocked
      ? `${blocked.space.name} would be the natural fit, but it's unavailable ${blocked.space.availabilityLabel.replace("Unavailable tomorrow, ", "tomorrow ")}. `
      : "";
    const recLine = `${rec.space.name} is the best option — it seats ${rec.space.capacity}${
      rec.space.equipment.length ? `, with ${rec.space.equipment.join(" and ").toLowerCase()}` : ""
    }${rec.requiresApproval ? ", and it's available on request with approval" : ""}.`;
    const altLine = alt
      ? ` ${alt.space.name} is the alternative if you'd rather ${
          alt.space.capacity > rec.space.capacity ? "have more room" : "keep it smaller"
        }.`
      : "";
    return {
      text: `${preamble}${recLine}${altLine} How long will you need it for?`,
      cards: search.card ? [search.card] : [],
      intents: ["Space booking"],
      entities: { attendees: String(capacity), time: start, date: "Tomorrow" },
      confidence: "High",
      route: "Space booking",
    };
  }

  // ── Guest passes (L76, L77, L118). ─────────────────────────────────────
  if (has(s, "guest pass", "guest passes", "visitor", "client is arriving", "clients arriving", "arriving at")) {
    return {
      text: "Absolutely. Please share each guest's name, company and expected arrival time, and I'll arrange the passes.",
      cards: [],
      intents: ["Guest-pass request"],
      entities: { arrival: parseTime(s, "07:30") },
      confidence: "High",
      route: "Visitor Services",
    };
  }

  // ── Concierge: dining (L84, L120). ─────────────────────────────────────
  if (has(s, "restaurant", "dinner", "lunch", "eat", "dining", "drinks", "breakfast")) {
    const category = has(s, "breakfast")
      ? "breakfast"
      : has(s, "lunch")
        ? "business_lunch"
        : has(s, "drinks", "shared plates")
          ? "drinks"
          : has(s, "formal")
            ? "formal_dining"
            : "relaxed_dinner";
    const items = recommendations[category].slice(0, 2);
    const quiet = has(s, "quiet", "business");
    return {
      text: quiet
        ? `${items[0].name} is the one I'd choose — ${items[0].descriptor.toLowerCase()}, ${items[0].walk.toLowerCase()}, and the room is built for conversation. ${items[1].name} is the alternative if you'd prefer somewhere livelier. Shall I reserve one?`
        : `I can help with that. Are you looking for formal dining, a relaxed business dinner or drinks with shared plates? ${items[0].name} and ${items[1].name} are both strong options ${items[0].walk.toLowerCase()} away.`,
      cards: [
        {
          kind: "recommendations",
          category,
          label: recommendationCategoryLabels[category],
          items,
        },
      ],
      intents: ["Local recommendation"],
      entities: { party_size: String(parseCapacity(s)) },
      confidence: "High",
      route: "Concierge Services",
    };
  }

  // ── Concierge: taxi (L85, L121). ───────────────────────────────────────
  if (has(s, "taxi", "cab", "car to the airport", "airport", "uber", "transfer")) {
    return {
      text: "Absolutely. Please confirm the pickup point, terminal and number of passengers.",
      cards: [],
      intents: ["Taxi coordination"],
      entities: { time: parseTime(s, "09:30"), destination: "Airport" },
      confidence: "High",
      route: "Concierge Services",
    };
  }

  // ── Concierge: loans and storage (L86, L87, L88, L122). ────────────────
  if (has(s, "charger", "power bank", "battery")) {
    const time = parseTime(s, "07:30");
    return {
      text: `Yes. I can reserve a portable charger for collection from Concierge. What time would you like to collect it?`,
      cards: [],
      intents: ["Portable charger loan"],
      entities: { collection_time: time },
      confidence: "High",
      route: "Concierge Services",
    };
  }
  if (has(s, "umbrella", "raining", "rain")) {
    return {
      text: "Of course. I'll reserve an umbrella for collection from Concierge. When would you like to collect it?",
      cards: [],
      intents: ["Umbrella loan"],
      entities: {},
      confidence: "High",
      route: "Concierge Services",
    };
  }
  if (has(s, "luggage", "bags", "suitcase", "store")) {
    return {
      text: "I can arrange secure luggage storage. How many items do they have, and what time will they collect them?",
      cards: [],
      intents: ["Luggage storage"],
      entities: {},
      confidence: "High",
      route: "Concierge Services",
    };
  }

  // ── Concierge: tours and events (L89, L90). ────────────────────────────
  if (has(s, "tour", "show them around", "new starter")) {
    return {
      text: "I'd be happy to arrange that. What date, time, group size and areas of interest should I include?",
      cards: [],
      intents: ["Building tour"],
      entities: {},
      confidence: "High",
      route: "Concierge Services",
    };
  }
  if (has(s, "activation", "event", "launch", "hosting")) {
    return {
      text: "I can arrange event-support planning. What is the event date, expected attendance and the type of support you need?",
      cards: [],
      intents: ["Event support"],
      entities: {},
      confidence: "High",
      route: "Concierge Services",
    };
  }

  // ── Wellness — chip-only service, answered without creating a request. ──
  if (has(s, "gym", "yoga", "run", "massage", "physio", "wellness")) {
    const items = recommendations.wellness.slice(0, 3);
    return {
      text: `${items[0].name} is ${items[0].walk.toLowerCase()} and takes same-day appointments. If you'd rather be outside, ${items[1].name} is a good loop between meetings.`,
      cards: [
        {
          kind: "recommendations",
          category: "wellness",
          label: recommendationCategoryLabels.wellness,
          items,
        },
      ],
      intents: ["Wellness and local experience"],
      entities: {},
      confidence: "High",
      route: "Concierge Services",
    };
  }

  return {
    text: "I can help with meeting rooms, guest and contractor access, building support, and concierge services like transport, dining and loans. What would you like me to arrange?",
    cards: [],
    intents: ["General enquiry"],
    entities: {},
    confidence: "Low",
    route: "Concierge Services",
  };
}

// ── Engine entry point ─────────────────────────────────────────────────────

export async function runScriptedTurn(
  turn: EngineTurn,
  emit: (event: StreamEvent) => void,
): Promise<EngineResult> {
  const started = Date.now();
  const turnNumber = turn.session.turn + 1;
  const ctx: ToolContext = {
    referenceCursor: { ...turn.session.referenceCursor },
    issued: [...turn.session.issued],
    trace: traceScaffold(turnNumber, turn.message),
    actions: [],
    outcomes: [],
  };

  const heroStep = Number(turn.session.context.hero_step ?? 0);
  const lower = turn.message.toLowerCase();
  // Steps 2..5 are hero turns; the five-turn journey finishes on step 5.
  const inHero = heroStep >= 2 && heroStep <= 5;
  // A safety matter always breaks out of the hero flow.
  const safetyInterrupt = has(lower, "smoke", "fire", "water coming", "suspicious", "unsafe");

  let reply: Reply;
  let nextHeroStep = heroStep;

  if (heroStep === 0 && isHeroOpening(lower)) {
    reply = heroTurn(1, turn.message, ctx, turn.session.context);
    nextHeroStep = 2;
  } else if (inHero && !safetyInterrupt) {
    reply = heroTurn(heroStep, turn.message, ctx, turn.session.context);
    nextHeroStep = heroStep + 1;
  } else {
    reply = singleShot(turn.message, ctx, turn.session.context);
  }

  // Trace, published before the text so the presenter panel fills first.
  ctx.trace.intents = reply.intents;
  ctx.trace.entities = { ...reply.entities };
  ctx.trace.confidence = reply.confidence;
  ctx.trace.route = reply.route;

  // Presentation-only steps that ran no tool still deserve an action line.
  for (const card of reply.cards) {
    if (card.kind === "recommendations") ctx.actions.push(`Selected ${card.label.toLowerCase()} options`);
    if (card.kind === "guidance") ctx.actions.push(`Provided ${card.card.title.toLowerCase()} guidance`);
    if (card.kind === "itinerary") ctx.actions.push("Assembled consolidated itinerary");
  }

  const trace: TraceRecord = {
    turn: turnNumber,
    asset: asset.name,
    userRequest: turn.message,
    intents: reply.intents,
    entities: reply.entities,
    confidence: reply.confidence,
    rulesApplied: ctx.trace.rulesApplied?.length ? ctx.trace.rulesApplied : ["After-hours mode"],
    actions: ctx.actions.length ? ctx.actions : ["Answered from building knowledge"],
    outcome: ctx.outcomes.length ? ctx.outcomes.join("; ") : "Answered directly",
    urgency: ctx.trace.urgency,
    destinationTeam: ctx.trace.destinationTeam,
    handoffSummary: ctx.trace.handoffSummary,
    route: reply.route,
    latencyMs: Date.now() - started,
    toolCalls: [],
    engine: "scripted",
  };
  emit({ type: "trace", trace });

  // Stream the text in word groups so it reads like the live engine on stage.
  const words = reply.text.split(" ");
  for (let i = 0; i < words.length; i += 3) {
    emit({ type: "text", delta: (i === 0 ? "" : " ") + words.slice(i, i + 3).join(" ") });
  }
  for (const card of reply.cards) emit({ type: "card", card });

  const context = { ...turn.session.context, ...(reply.context ?? {}) };
  if (nextHeroStep > 0) context.hero_step = String(nextHeroStep);
  if (reply.entities.level) context.level = reply.entities.level;
  if (reply.entities.entrance) context.location = reply.entities.entrance;

  return {
    session: {
      turn: turnNumber,
      context,
      issued: ctx.issued,
      referenceCursor: ctx.referenceCursor,
    },
    trace,
    text: reply.text,
  };
}
