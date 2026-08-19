/**
 * Building knowledge pack — FAQ answers, amenity guidance and the local
 * recommendation set.
 *
 * This content lives in the (cached) system prompt rather than behind a tool,
 * so factual answers return with no extra round trip. Tools are reserved for
 * actions that produce a reference number or need availability logic.
 *
 * All content is demonstration content. Per L20 the brief excludes real
 * building procedures and real contact details, so nothing here is a real
 * phone number or a real operating procedure.
 *
 * Recommendations are capped at three per category (L182).
 * Amenity guidance is delivered as static step lists, never a live map (L21).
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  route: string;
}

export const faqs: FaqEntry[] = [
  {
    id: "after_hours_access",
    question: "Can I access the building after hours?",
    answer:
      "Yes. Use the nominated tenant entry for after-hours access. If your pass does not work, I can connect you with After-Hours Building Support.",
    route: "After-Hours Building Support",
  },
  {
    id: "end_of_trip",
    question: "Are the showers and lockers open?",
    answer:
      "Yes—end-of-trip facilities are available to eligible building users. I'll show you the quickest route from your current level.",
    route: "Amenity guidance",
  },
  {
    id: "ev_charging",
    question: "Can I charge my EV?",
    answer:
      "EV charging is available in the car park. I'll show you the charging location and usage steps.",
    route: "Amenity guidance",
  },
];

export interface GuidanceCard {
  id: string;
  title: string;
  steps: string[];
  note?: string;
}

/** Static step cards, honouring the no-live-maps exclusion (L21). */
export const guidance: GuidanceCard[] = [
  {
    id: "end_of_trip",
    title: "End-of-trip facilities",
    steps: [
      "Take the tenant lift core to Basement 1.",
      "Turn left out of the lift lobby — the change rooms are through the glass doors.",
      "Tap your building pass at the reader to enter.",
      "Showers, lockers and towel service are on the left; secure bike racks are straight ahead.",
    ],
    note: "Day lockers release overnight. Available to eligible building users.",
  },
  {
    id: "ev_charging",
    title: "EV charging",
    steps: [
      "Enter the car park from the Pitt Street ramp and continue to Basement 2.",
      "Charging bays are in the north-east corner, signed EV ONLY.",
      "Tap your building pass on the charger to start a session.",
      "Charging stops automatically when you tap the same pass again.",
    ],
    note: "Four bays, shared. Bays are for active charging only.",
  },
  {
    id: "parking",
    title: "Parking",
    steps: [
      "Tenant parking is on Basement 2 and Basement 3.",
      "Enter from the Pitt Street ramp; the boom gate reads your building pass.",
      "After hours, use the intercom at the gate if the boom does not lift.",
    ],
  },
  {
    id: "bike_end_of_trip",
    title: "Bike storage",
    steps: [
      "Secure bike racks are on Basement 1, beyond the change rooms.",
      "Tap your building pass at the cage door.",
      "Repair stand and pump are mounted beside the cage entrance.",
    ],
  },
];

export type RecommendationCategory =
  | "breakfast"
  | "business_lunch"
  | "formal_dining"
  | "relaxed_dinner"
  | "drinks"
  | "wellness";

export interface Recommendation {
  name: string;
  descriptor: string;
  walk: string;
  bestFor: string;
}

/** Exactly three per category (L182). Demonstration content. */
export const recommendations: Record<RecommendationCategory, Recommendation[]> = {
  breakfast: [
    { name: "The Ledger Room", descriptor: "Quiet corner café in the GPO colonnade", walk: "1 min walk", bestFor: "Early client breakfast, table service from 6:30am" },
    { name: "Pitt & Grain", descriptor: "Bakery counter with a small seated area", walk: "3 min walk", bestFor: "Fast, informal, good pastries to take up to a meeting" },
    { name: "Ash Street Kitchen", descriptor: "Laneway dining room", walk: "5 min walk", bestFor: "A sit-down breakfast when you have a full hour" },
  ],
  business_lunch: [
    { name: "Bligh & Vine", descriptor: "Understated dining room, well-spaced tables", walk: "4 min walk", bestFor: "Quiet conversation — the room is built for it" },
    { name: "The Chifley Table", descriptor: "Modern Australian, banquette seating", walk: "6 min walk", bestFor: "A working lunch with documents on the table" },
    { name: "Hunter Street Trattoria", descriptor: "Relaxed Italian, fast service", walk: "7 min walk", bestFor: "When you need to be back within the hour" },
  ],
  formal_dining: [
    { name: "Number One Martin", descriptor: "Fine dining, degustation and à la carte", walk: "In building", bestFor: "Formal client hosting" },
    { name: "The Sandstone Room", descriptor: "Heritage dining room, extensive cellar", walk: "5 min walk", bestFor: "Milestone dinners and larger tables" },
    { name: "Quay Street Grill", descriptor: "Classic grill, private rooms available", walk: "8 min walk", bestFor: "Traditional, reliable, good for mixed groups" },
  ],
  relaxed_dinner: [
    { name: "Ash Street Cellar", descriptor: "Wine bar with a full kitchen", walk: "5 min walk", bestFor: "A relaxed business dinner that can run late" },
    { name: "Angel Place Bistro", descriptor: "Bistro classics, lively room", walk: "6 min walk", bestFor: "Groups of six to ten" },
    { name: "Barrack Lane Izakaya", descriptor: "Shared plates, counter and booths", walk: "7 min walk", bestFor: "Informal hosting with variety" },
  ],
  drinks: [
    { name: "The Vault Bar", descriptor: "Basement bar in the old strongroom", walk: "In building", bestFor: "Shared plates and drinks after a meeting" },
    { name: "Radio Rooftop", descriptor: "Rooftop terrace, harbour outlook", walk: "6 min walk", bestFor: "Warm evenings and a view worth the walk" },
    { name: "Bridge Lane Wine Room", descriptor: "Small wine room, standing and seated", walk: "4 min walk", bestFor: "Two to six people, easy conversation" },
  ],
  wellness: [
    { name: "Martin Place Physio & Recovery", descriptor: "Physio, massage and recovery rooms", walk: "2 min walk", bestFor: "Same-day appointments, opens 6:30am" },
    { name: "The Domain circuit", descriptor: "2.4km loop through the Domain and Botanic Garden", walk: "8 min walk to start", bestFor: "A run or walk between meetings" },
    { name: "Hunter Street Yoga", descriptor: "Studio with lunchtime and 6pm classes", walk: "5 min walk", bestFor: "Drop-in classes, mats provided" },
  ],
};

export const recommendationCategoryLabels: Record<RecommendationCategory, string> = {
  breakfast: "Breakfast",
  business_lunch: "Business lunch",
  formal_dining: "Formal dining",
  relaxed_dinner: "Relaxed business dinner",
  drinks: "Drinks and shared plates",
  wellness: "Wellness and local experience",
};
