/**
 * Sandbox room catalogue and the availability engine.
 *
 * The catalogue is copied exactly from the brief (L92-100). Its availability
 * windows are deliberately constructed to create the demo's decision moments,
 * so the search below runs real filters rather than returning scripted answers:
 *
 *  - "a room for 12 tomorrow morning" -> Martin Boardroom is the only 12-cap
 *    room and it is blocked 08:00-10:00, forcing the "next best option"
 *    exchange (L116-117).
 *  - hero journey, 6 people at 08:00 -> Quiet Room fails capacity, Pitt opens
 *    at 09:00, Martin is blocked until 10:00. Only Park Meeting Room fits,
 *    which is what the brief's own worked example books (L113).
 */

export interface Space {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
  bookingRule: string;
  /** null => "available on request" rather than a fixed window. */
  availability: { start: string; end: string } | null;
  /** Blocked windows within the availability window. */
  blocked: { start: string; end: string }[];
  approvalRequired: boolean;
  externalGuestApproval: boolean;
  maxDurationMinutes: number | null;
  availabilityLabel: string;
}

export const spaces: Space[] = [
  {
    id: "martin_boardroom",
    name: "Martin Boardroom",
    capacity: 12,
    equipment: ["Display", "Whiteboard"],
    bookingRule: "External guests require approval",
    availability: { start: "07:00", end: "19:00" },
    blocked: [{ start: "08:00", end: "10:00" }],
    approvalRequired: false,
    externalGuestApproval: true,
    maxDurationMinutes: null,
    availabilityLabel: "Unavailable tomorrow, 08:00–10:00",
  },
  {
    id: "park_meeting_room",
    name: "Park Meeting Room",
    capacity: 8,
    equipment: ["Display"],
    bookingRule: "Standard booking",
    availability: { start: "08:00", end: "12:00" },
    blocked: [],
    approvalRequired: false,
    externalGuestApproval: false,
    maxDurationMinutes: null,
    availabilityLabel: "Available tomorrow, 08:00–12:00",
  },
  {
    id: "pitt_collaboration_room",
    name: "Pitt Collaboration Room",
    capacity: 6,
    equipment: ["Display", "Whiteboard"],
    bookingRule: "Standard booking",
    availability: { start: "09:00", end: "17:00" },
    blocked: [],
    approvalRequired: false,
    externalGuestApproval: false,
    maxDurationMinutes: null,
    availabilityLabel: "Available tomorrow, 09:00–17:00",
  },
  {
    id: "the_forum",
    name: "The Forum",
    capacity: 24,
    equipment: ["Display", "Presentation setup"],
    bookingRule: "Approval required",
    availability: null,
    blocked: [],
    approvalRequired: true,
    externalGuestApproval: false,
    maxDurationMinutes: null,
    availabilityLabel: "Available on request",
  },
  {
    id: "quiet_room",
    name: "Quiet Room",
    capacity: 2,
    equipment: [],
    bookingRule: "Maximum two hours",
    availability: { start: "08:00", end: "18:00" },
    blocked: [],
    approvalRequired: false,
    externalGuestApproval: false,
    maxDurationMinutes: 120,
    availabilityLabel: "Available tomorrow, 08:00–18:00",
  },
];

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const toClock = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Human-friendly time, e.g. 480 -> "8:00am", 585 -> "9:45am". */
export const toFriendly = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
};

export interface SpaceQuery {
  capacity: number;
  start: string;
  durationMinutes: number;
  externalGuests?: boolean;
}

export type RejectionReason =
  | "capacity"
  | "outside_window"
  | "blocked"
  | "max_duration";

export interface SpaceMatch {
  space: Space;
  fits: boolean;
  reason?: RejectionReason;
  /** Set when the space is only obtainable via an approval step. */
  requiresApproval: boolean;
  approvalReason?: string;
  start: string;
  end: string;
}

export interface SpaceSearchResult {
  query: SpaceQuery;
  recommended: SpaceMatch | null;
  alternative: SpaceMatch | null;
  rejected: SpaceMatch[];
  rulesApplied: string[];
}

/**
 * Filter the catalogue by capacity, window, blocked periods and duration rules.
 * Returns a best match plus exactly one alternative (L106).
 */
export function findSpaces(query: SpaceQuery): SpaceSearchResult {
  const startM = toMinutes(query.start);
  const endM = startM + query.durationMinutes;
  const rulesApplied: string[] = ["After-hours mode"];

  const evaluate = (space: Space): SpaceMatch => {
    const base = {
      space,
      requiresApproval: false as boolean,
      start: toClock(startM),
      end: toClock(endM),
    };

    if (space.capacity < query.capacity) {
      return { ...base, fits: false, reason: "capacity" };
    }
    if (space.maxDurationMinutes !== null && query.durationMinutes > space.maxDurationMinutes) {
      return { ...base, fits: false, reason: "max_duration" };
    }

    // "Available on request" spaces have no fixed window; they fit, via approval.
    if (space.availability === null) {
      return {
        ...base,
        fits: true,
        requiresApproval: true,
        approvalReason: "Approval required — available on request",
      };
    }

    const winStart = toMinutes(space.availability.start);
    const winEnd = toMinutes(space.availability.end);
    if (startM < winStart || endM > winEnd) {
      return { ...base, fits: false, reason: "outside_window" };
    }
    for (const b of space.blocked) {
      const bStart = toMinutes(b.start);
      const bEnd = toMinutes(b.end);
      if (startM < bEnd && endM > bStart) {
        return { ...base, fits: false, reason: "blocked" };
      }
    }

    const requiresApproval = space.approvalRequired || (query.externalGuests === true && space.externalGuestApproval);
    return {
      ...base,
      fits: true,
      requiresApproval,
      approvalReason: requiresApproval
        ? space.approvalRequired
          ? "Approval required"
          : "External guests require approval"
        : undefined,
    };
  };

  const evaluated = spaces.map(evaluate);
  const fitting = evaluated.filter((m) => m.fits);
  const rejected = evaluated.filter((m) => !m.fits);

  // Prefer no-approval options, then the tightest capacity fit — a boardroom
  // for two is technically available and obviously the wrong recommendation.
  fitting.sort((a, b) => {
    if (a.requiresApproval !== b.requiresApproval) return a.requiresApproval ? 1 : -1;
    return a.space.capacity - b.space.capacity;
  });

  if (rejected.some((r) => r.reason === "blocked")) {
    rulesApplied.push("Availability block honoured");
  }
  if (rejected.some((r) => r.reason === "capacity")) {
    rulesApplied.push("Capacity filter applied");
  }
  if (fitting.some((m) => m.requiresApproval)) {
    rulesApplied.push("Approval rule surfaced");
  }
  if (fitting.length > 0 && !fitting[0].requiresApproval) {
    rulesApplied.push("Standard room booking");
  }

  return {
    query,
    recommended: fitting[0] ?? null,
    alternative: fitting[1] ?? null,
    rejected,
    rulesApplied,
  };
}
