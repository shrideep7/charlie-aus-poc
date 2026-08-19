/**
 * Shared types for the Charli conversation protocol.
 *
 * The server streams SSE events to the client; the trace panel is populated
 * from `trace` events, so it fills live as Charli works.
 */

import type { EscalationTier, Team } from "@/config/asset";
import type { Recommendation, RecommendationCategory, GuidanceCard } from "@/config/knowledge";
import type { SpaceSearchResult } from "@/config/spaces";

export type Confidence = "High" | "Medium" | "Low";

/** The presenter trace record. Fields are exactly those the brief lists (L146-157). */
export interface TraceRecord {
  turn: number;
  asset: string;
  userRequest: string;
  intents: string[];
  entities: Record<string, string>;
  confidence: Confidence;
  rulesApplied: string[];
  actions: string[];
  outcome: string;
  /** Escalation-only fields (L157). */
  urgency?: string;
  destinationTeam?: Team;
  handoffSummary?: string;
  /** Presenter diagnostics — not required by the brief but useful on stage. */
  route?: string;
  latencyMs?: number;
  toolCalls?: { name: string; input: unknown }[];
  engine?: "live" | "scripted";
}

/** Rich cards rendered inline in the conversation. */
export type Card =
  | { kind: "room_options"; search: SpaceSearchResult }
  | {
      kind: "confirmation";
      reference: string;
      title: string;
      team: Team;
      details: { label: string; value: string }[];
      nextStep: string;
    }
  | { kind: "guidance"; card: GuidanceCard }
  | {
      kind: "recommendations";
      category: RecommendationCategory;
      label: string;
      items: Recommendation[];
    }
  | {
      kind: "escalation";
      tier: EscalationTier;
      label: string;
      urgency: string;
      team: Team;
      handoffSummary: string;
      reference?: string;
    }
  | {
      kind: "itinerary";
      title: string;
      lines: { label: string; value: string; reference?: string }[];
    }
  | {
      kind: "status";
      reference: string;
      service: string;
      status: string;
      team: Team;
      raised: string;
    };

export interface ChatMessage {
  id: string;
  role: "user" | "charli";
  text: string;
  cards?: Card[];
  traceTurn?: number;
}

/** SSE frames sent by /api/charli. */
export type StreamEvent =
  | { type: "trace"; trace: TraceRecord }
  | { type: "text"; delta: string }
  | { type: "card"; card: Card }
  | { type: "done"; turn: number }
  | { type: "error"; message: string };

/** Session state carried by the client and posted back each turn (no server store). */
export interface SessionState {
  turn: number;
  /** Context Charli has learned and should carry forward (L27). */
  context: Record<string, string>;
  /** References issued this session, so the itinerary can be assembled. */
  issued: { reference: string; label: string }[];
  /** Index into the scripted reference queue, so replays stay deterministic. */
  referenceCursor: Record<string, number>;
}

export const emptySession = (): SessionState => ({
  turn: 0,
  context: {},
  issued: [],
  referenceCursor: {},
});
