/**
 * Live engine — Claude Opus 5 with the six tools.
 *
 * A manual streaming loop rather than the SDK tool runner, because we need to
 * interleave our own `trace` and `card` frames into the same SSE stream the
 * text deltas travel on. `record_trace` is forced on the first iteration of
 * every turn, which is what makes an untraced turn structurally impossible.
 */

import Anthropic from "@anthropic-ai/sdk";
import { asset } from "@/config/asset";
import { STABLE_SYSTEM, sessionSystem } from "./prompt";
import { executeTool, toolDefinitions, traceScaffold, type ToolContext } from "./tools";
import type { SessionState, StreamEvent, TraceRecord } from "./types";

export const MODEL = process.env.CHARLI_MODEL ?? "claude-opus-5";
const EFFORT = (process.env.CHARLI_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";
const MAX_ITERATIONS = 8;

export interface EngineTurn {
  message: string;
  history: { role: "user" | "assistant"; text: string }[];
  session: SessionState;
}

export interface EngineResult {
  session: SessionState;
  trace: TraceRecord;
  text: string;
}

export async function runLiveTurn(
  turn: EngineTurn,
  emit: (event: StreamEvent) => void,
): Promise<EngineResult> {
  const client = new Anthropic();
  const started = Date.now();
  const turnNumber = turn.session.turn + 1;

  const ctx: ToolContext = {
    referenceCursor: { ...turn.session.referenceCursor },
    issued: [...turn.session.issued],
    trace: traceScaffold(turnNumber, turn.message),
    actions: [],
    outcomes: [],
  };
  const toolCalls: { name: string; input: unknown }[] = [];
  let text = "";
  let tracePublished = false;

  const publishTrace = (): TraceRecord => {
    const record: TraceRecord = {
      turn: turnNumber,
      asset: asset.name,
      userRequest: turn.message,
      intents: ctx.trace.intents?.length ? ctx.trace.intents : ["General enquiry"],
      entities: ctx.trace.entities ?? {},
      confidence: ctx.trace.confidence ?? "Medium",
      rulesApplied: ctx.trace.rulesApplied?.length ? ctx.trace.rulesApplied : ["After-hours mode"],
      actions: ctx.actions.length ? ctx.actions : ["Answered from building knowledge"],
      outcome: ctx.outcomes.length ? ctx.outcomes.join("; ") : "Answered directly",
      urgency: ctx.trace.urgency,
      destinationTeam: ctx.trace.destinationTeam,
      handoffSummary: ctx.trace.handoffSummary,
      route: ctx.trace.route,
      latencyMs: Date.now() - started,
      toolCalls,
      engine: "live",
    };
    emit({ type: "trace", trace: record });
    return record;
  };

  const messages: Anthropic.MessageParam[] = [
    ...turn.history.map((h) => ({ role: h.role, content: h.text }) as Anthropic.MessageParam),
    { role: "user", content: turn.message },
  ];

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: STABLE_SYSTEM, cache_control: { type: "ephemeral" } },
  ];
  const volatile = sessionSystem(turn.session.context, turn.session.issued);
  if (volatile) systemBlocks.push({ type: "text", text: volatile });

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: systemBlocks,
      messages,
      tools: toolDefinitions,
      tool_choice: iteration === 0 ? { type: "tool", name: "record_trace" } : { type: "auto" },
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
    });

    stream.on("text", (delta) => {
      text += delta;
      emit({ type: "text", delta });
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      emit({
        type: "error",
        message: "That request could not be completed. Please try rephrasing it.",
      });
      break;
    }

    if (message.stop_reason !== "tool_use") break;

    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    messages.push({ role: "assistant", content: message.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      toolCalls.push({ name: use.name, input });
      let outcome;
      try {
        outcome = executeTool(use.name, input, ctx);
      } catch (error) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          is_error: true,
          content: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      if (outcome.card) emit({ type: "card", card: outcome.card });
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(outcome.result),
      });

      // Publish an early trace as soon as intent is recorded, so the presenter
      // panel fills while Charli is still working.
      if (use.name === "record_trace" && !tracePublished) {
        tracePublished = true;
        publishTrace();
      }
    }

    messages.push({ role: "user", content: results });
  }

  const trace = publishTrace();
  const session: SessionState = {
    turn: turnNumber,
    context: { ...turn.session.context, ...inferContext(ctx) },
    issued: ctx.issued,
    referenceCursor: ctx.referenceCursor,
  };
  return { session, trace, text };
}

/** Carry forward anything worth remembering from this turn (L27). */
function inferContext(ctx: ToolContext): Record<string, string> {
  const out: Record<string, string> = {};
  const entities = ctx.trace.entities ?? {};
  for (const key of ["level", "suite", "location", "entrance", "attendees", "guest_names", "company"]) {
    const found = Object.entries(entities).find(([k]) => k.toLowerCase().includes(key));
    if (found) out[key] = found[1];
  }
  return out;
}
