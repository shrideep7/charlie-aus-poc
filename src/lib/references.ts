/**
 * Reference number allocator.
 *
 * Guardrail L181 requires pre-seeded results for all booking and status
 * outcomes. The brief's own worked examples use specific numbers:
 *
 *   BK-MP-1042  room booking      (L40, L113)
 *   VA-MP-1051  guest/access      (L43, L113)
 *   CS-MP-4108  concierge service (L42, L113)
 *   CH-MP-3018  building support  (L41, L83)
 *
 * Those are served first for each family, so when the hero journey runs the
 * numbers on screen match the numbers in the client's own document. After the
 * scripted values are exhausted, a deterministic sequence continues — never
 * random, so a replay produces an identical transcript.
 */

import type { ReferenceFamily } from "@/config/asset";

const SCRIPTED: Record<ReferenceFamily, string[]> = {
  booking: ["BK-MP-1042", "BK-MP-1043", "BK-MP-1044"],
  access: ["VA-MP-1051", "VA-MP-1052", "VA-MP-1053"],
  concierge: ["CS-MP-4108", "CS-MP-4109", "CS-MP-4110"],
  support: ["CH-MP-3018", "CH-MP-3019", "CH-MP-3020"],
};

const PREFIX: Record<ReferenceFamily, string> = {
  booking: "BK-MP-",
  access: "VA-MP-",
  concierge: "CS-MP-",
  support: "CH-MP-",
};

const BASE: Record<ReferenceFamily, number> = {
  booking: 1042,
  access: 1051,
  concierge: 4108,
  support: 3018,
};

/**
 * Allocate the next reference for a family, advancing the cursor held in
 * session state. Pure with respect to the cursor map so a replay is identical.
 */
export function allocateReference(
  family: ReferenceFamily,
  cursor: Record<string, number>,
): { reference: string; cursor: Record<string, number> } {
  const used = cursor[family] ?? 0;
  const scripted = SCRIPTED[family];
  const reference =
    used < scripted.length
      ? scripted[used]
      : `${PREFIX[family]}${BASE[family] + used}`;
  return { reference, cursor: { ...cursor, [family]: used + 1 } };
}

export const referenceFamilyOf = (reference: string): ReferenceFamily | undefined => {
  if (reference.startsWith("BK-MP-")) return "booking";
  if (reference.startsWith("VA-MP-")) return "access";
  if (reference.startsWith("CS-MP-")) return "concierge";
  if (reference.startsWith("CH-MP-")) return "support";
  return undefined;
};

export const REFERENCE_PATTERN = /\b(BK|CH|CS|VA)-MP-\d{4}\b/g;
