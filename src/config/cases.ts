/**
 * Pre-seeded case data for status follow-ups.
 *
 * L15 and L175 require Charli to answer a status question about a *previously*
 * raised request, so these must exist before the demo starts — a cold session
 * has to be able to answer "what is happening with my lighting request?".
 *
 * CH-MP-3018 and its wording come from the brief (L83). The other three are
 * seeded so a status question lands from any angle.
 */

import type { Team } from "./asset";

export interface SeededCase {
  reference: string;
  service: string;
  /** Keywords a tenant might use to refer to this case in natural language. */
  keywords: string[];
  raised: string;
  status: string;
  team: Team;
  update: string;
  nextStep: string;
}

export const seededCases: SeededCase[] = [
  {
    reference: "CH-MP-3018",
    service: "Lighting outage",
    keywords: ["light", "lights", "lighting", "globe", "dark"],
    raised: "Yesterday, 6:42pm",
    status: "Acknowledged — electrician scheduled",
    team: "After-Hours Building Support",
    update:
      "After-Hours Building Support has acknowledged your lighting request. An electrician is scheduled to attend at 8:30am.",
    nextStep: "I'll confirm once the electrician has attended.",
  },
  {
    reference: "CH-MP-3024",
    service: "HVAC — suite too warm",
    keywords: ["hvac", "air", "aircon", "air-con", "conditioning", "warm", "hot", "temperature", "cooling"],
    raised: "Yesterday, 4:15pm",
    status: "In progress — technician on site",
    team: "Building Support",
    update:
      "Building Support has a technician on site now. They have adjusted the floor setpoint and are monitoring it over the next two hours.",
    nextStep: "I'll let you know if they need access to your suite.",
  },
  {
    reference: "VA-MP-1047",
    service: "Access pass replacement",
    keywords: ["pass", "card", "credential", "access pass", "replacement", "badge"],
    raised: "Today, 11:20am",
    status: "Ready for collection",
    team: "Visitor Services",
    update:
      "Your replacement pass is ready for collection from the concierge desk. Your mobile credential has already been re-issued and is active now.",
    nextStep: "I can have the pass sent up to your suite instead if you prefer.",
  },
  {
    reference: "CH-MP-3031",
    service: "Additional cleaning — meeting room",
    keywords: ["clean", "cleaning", "cleaner", "rubbish", "tidy"],
    raised: "Today, 2:05pm",
    status: "Scheduled — this evening",
    team: "Building Support",
    update:
      "Building Support has scheduled an additional clean for this evening after 6pm.",
    nextStep: "I'll confirm once it's been completed.",
  },
];

export const findCase = (query: string): SeededCase | undefined => {
  const q = query.toLowerCase();
  const byReference = seededCases.find((c) => q.includes(c.reference.toLowerCase()));
  if (byReference) return byReference;
  return seededCases.find((c) => c.keywords.some((k) => q.includes(k)));
};
