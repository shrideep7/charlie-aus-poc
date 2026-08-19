/**
 * Service registry.
 *
 * The shape below is the generic service schema given in the brief (L134-142),
 * used verbatim so the presenter configuration view shows the client their own
 * JSON. Every non-booking request in the demo goes through ONE handler
 * (`submit_service_request`) driven by this table — mandated by L180.
 *
 * Source: L51-70 (enabled menu), L134-142 (schema), L183 (six active concierge
 * services; the remainder are interface chips only).
 */

import { asset, type ReferenceFamily, type Team } from "./asset";

export type ServiceCategory = "meetings_guests" | "access_support" | "concierge";

export interface ServiceDefinition {
  service_id: string;
  service_name: string;
  asset: string;
  required_fields: string[];
  routing_team: Team;
  reference_format: string;
  /** Internal metadata — not part of the brief's schema. */
  meta: {
    category: ServiceCategory;
    family: ReferenceFamily;
    /** false => interface chip only, no request is created (L183). */
    active: boolean;
    /** Requires approval before it can be granted (L34, L82). */
    approval: boolean;
    /** Field prompts, so slot-filling copy is data-driven not prompt-driven. */
    fieldPrompts: Record<string, string>;
    /** The route label shown in the presenter trace panel (L73 vocabulary). */
    route: string;
    /** One relevant follow-up to offer after completion (L133). */
    followUp: string;
  };
}

const A = asset.name;

export const services: ServiceDefinition[] = [
  // ── Meetings and guests (L52-56) ─────────────────────────────────────────
  {
    service_id: "guest_pass",
    service_name: "Guest and visitor pass request",
    asset: A,
    required_fields: ["guest_names", "company", "arrival_time"],
    routing_team: "Visitor Services",
    reference_format: "VA-MP-####",
    meta: {
      category: "meetings_guests",
      family: "access",
      active: true,
      approval: false,
      route: "Visitor Services",
      fieldPrompts: {
        guest_names: "each guest's name",
        company: "their company",
        arrival_time: "the expected arrival time",
      },
      followUp: "I can also have reception meet them in the lobby if that would help.",
    },
  },
  {
    service_id: "contractor_access",
    service_name: "Contractor access request",
    asset: A,
    required_fields: ["company", "contact_name", "purpose", "arrival_time"],
    routing_team: "Building Support",
    reference_format: "VA-MP-####",
    meta: {
      category: "meetings_guests",
      family: "access",
      active: true,
      approval: true,
      route: "Access approval",
      fieldPrompts: {
        company: "the company",
        contact_name: "the contact name",
        purpose: "the purpose of the visit",
        arrival_time: "the expected arrival time",
      },
      followUp: "I can arrange a loading dock booking as well if they have equipment.",
    },
  },
  {
    service_id: "building_tour",
    service_name: "Building tour",
    asset: A,
    required_fields: ["date", "time", "group_size", "areas_of_interest"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "meetings_guests",
      family: "concierge",
      active: true,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: {
        date: "the date",
        time: "the time",
        group_size: "the group size",
        areas_of_interest: "the areas you'd like included",
      },
      followUp: "I can hold a meeting room for a wrap-up afterwards if that suits.",
    },
  },

  // ── Access and building support (L57-63) ─────────────────────────────────
  {
    service_id: "access_support",
    service_name: "Access pass support",
    asset: A,
    required_fields: ["location", "pass_type"],
    routing_team: "After-Hours Building Support",
    reference_format: "CH-MP-####",
    meta: {
      category: "access_support",
      family: "support",
      active: true,
      approval: false,
      route: "Access support",
      fieldPrompts: {
        location: "which entrance you're at",
        pass_type: "whether you're using a card or mobile credential",
      },
      followUp: "I'll stay with this until you're inside — tell me if the mobile credential fails too.",
    },
  },
  {
    service_id: "building_support",
    service_name: "Building, equipment or amenity support request",
    asset: A,
    required_fields: ["issue", "level", "suite"],
    routing_team: "Building Support",
    reference_format: "CH-MP-####",
    meta: {
      category: "access_support",
      family: "support",
      active: true,
      approval: false,
      route: "Building Support",
      fieldPrompts: {
        issue: "what's happening",
        level: "which level you're on",
        suite: "which suite",
      },
      followUp: "I'll send you the attendance time as soon as Building Support confirms it.",
    },
  },

  // ── Concierge services — six active (L64-70, L183) ──────────────────────
  {
    service_id: "taxi",
    service_name: "Taxi coordination",
    asset: A,
    required_fields: ["pickup", "destination", "time", "passengers"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "concierge",
      family: "concierge",
      active: true,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: {
        pickup: "the pickup point",
        destination: "the destination or terminal",
        time: "the pickup time",
        passengers: "the number of passengers",
      },
      followUp: "I can add a second car if the group splits up.",
    },
  },
  {
    service_id: "restaurant",
    service_name: "Restaurant and venue reservation",
    asset: A,
    required_fields: ["date", "time", "party_size", "style"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "concierge",
      family: "concierge",
      active: true,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: {
        date: "the date",
        time: "the time",
        party_size: "the number of guests",
        style: "the style you're after",
      },
      followUp: "I can arrange cars to the venue as well.",
    },
  },
  {
    service_id: "charger_loan",
    service_name: "Portable charger loan",
    asset: A,
    required_fields: ["collection_time"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "concierge",
      family: "concierge",
      active: true,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: { collection_time: "what time you'd like to collect it" },
      followUp: "I can add a laptop charger to the same reservation if you need one.",
    },
  },
  {
    service_id: "umbrella_loan",
    service_name: "Umbrella loan",
    asset: A,
    required_fields: ["collection_time"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "concierge",
      family: "concierge",
      active: true,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: { collection_time: "when you'd like to collect it" },
      followUp: "There are covered walkways most of the way to Wynyard if that helps.",
    },
  },
  {
    service_id: "luggage_storage",
    service_name: "Secure luggage storage",
    asset: A,
    required_fields: ["item_count", "collection_time"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "concierge",
      family: "concierge",
      active: true,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: {
        item_count: "how many items they have",
        collection_time: "what time they'll collect them",
      },
      followUp: "I can have the items brought to the lobby for collection if that's easier.",
    },
  },
  {
    service_id: "event_support",
    service_name: "Event and activation support",
    asset: A,
    required_fields: ["event_date", "attendance", "support_type"],
    routing_team: "Concierge Services",
    reference_format: "CS-MP-####",
    meta: {
      category: "concierge",
      family: "concierge",
      active: true,
      approval: true,
      route: "Concierge Services",
      fieldPrompts: {
        event_date: "the event date",
        attendance: "the expected attendance",
        support_type: "the type of support you need",
      },
      followUp: "I'll include lobby access and loading dock timings in the plan.",
    },
  },

  // ── Interface chip only — no request created (L69, L183) ─────────────────
  {
    service_id: "wellness_local",
    service_name: "Wellness and local experience information",
    asset: A,
    required_fields: [],
    routing_team: "Concierge Services",
    reference_format: "—",
    meta: {
      category: "concierge",
      family: "concierge",
      active: false,
      approval: false,
      route: "Concierge Services",
      fieldPrompts: {},
      followUp: "",
    },
  },
];

export const serviceById = (id: string): ServiceDefinition | undefined =>
  services.find((s) => s.service_id === id);

export const activeServices = services.filter((s) => s.meta.active);

export const categoryLabels: Record<ServiceCategory, string> = {
  meetings_guests: "Meetings and guests",
  access_support: "Access and building support",
  concierge: "Concierge services",
};

/**
 * Service-menu chips shown under the input. Grouped per the brief's three
 * categories (L52, L57, L64). Chips marked `active: false` are display only.
 */
export const menuChips: {
  category: ServiceCategory;
  label: string;
  prompt: string;
  active: boolean;
}[] = [
  { category: "meetings_guests", label: "Book a room", prompt: "I need a room for six tomorrow at 8am.", active: true },
  { category: "meetings_guests", label: "Guest passes", prompt: "Can you arrange guest passes for my visitors?", active: true },
  { category: "meetings_guests", label: "Contractor access", prompt: "Can a contractor come in tonight?", active: true },
  { category: "meetings_guests", label: "Building tour", prompt: "Can you arrange a building tour for prospective clients?", active: true },
  { category: "access_support", label: "After-hours access", prompt: "Can I access the building after hours?", active: true },
  { category: "access_support", label: "Pass not working", prompt: "My access pass isn't working.", active: true },
  { category: "access_support", label: "EV charging", prompt: "Can I charge my EV?", active: true },
  { category: "access_support", label: "End of trip", prompt: "Are the showers and lockers open?", active: true },
  { category: "access_support", label: "Report an issue", prompt: "The lights are out in our suite.", active: true },
  { category: "access_support", label: "Request status", prompt: "What is happening with my lighting request?", active: true },
  { category: "concierge", label: "Restaurant", prompt: "I need a restaurant for six clients tomorrow night.", active: true },
  { category: "concierge", label: "Airport taxi", prompt: "Book a taxi for my client to the airport at 9:30.", active: true },
  { category: "concierge", label: "Charger loan", prompt: "Can I borrow a charger for my meeting?", active: true },
  { category: "concierge", label: "Umbrella loan", prompt: "It looks like rain—can I borrow an umbrella?", active: true },
  { category: "concierge", label: "Luggage storage", prompt: "My client has luggage before a meeting.", active: true },
  { category: "concierge", label: "Event support", prompt: "We are hosting a lobby activation next month.", active: true },
  { category: "concierge", label: "Wellness & local", prompt: "", active: false },
];
