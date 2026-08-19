/**
 * Charli conversation endpoint.
 *
 * Streams SSE frames: `trace` (presenter panel), `text` (token deltas),
 * `card` (rich cards), `done` (with the updated session), `error`.
 *
 * There is no server-side store — the client posts its session state back each
 * turn. L21 excludes tenant data, so there is nothing to persist.
 *
 * Engine selection:
 *   - `rails: true` in the body, or CHARLI_ENGINE=scripted, uses the
 *     deterministic engine (stage insurance, and the golden harness).
 *   - No API key present also falls back to the scripted engine rather than
 *     failing, so the demo always runs.
 */

import { runLiveTurn, type EngineTurn } from "@/lib/engine-live";
import { runScriptedTurn } from "@/lib/engine-scripted";
import { emptySession, type SessionState, type StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  message?: string;
  history?: { role: "user" | "assistant"; text: string }[];
  session?: SessionState;
  rails?: boolean;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return new Response("Message is required", { status: 400 });

  const turn: EngineTurn = {
    message,
    history: (body.history ?? []).slice(-12),
    session: body.session ?? emptySession(),
  };

  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const forced = process.env.CHARLI_ENGINE;
  const useScripted = body.rails === true || forced === "scripted" || (!hasKey && forced !== "live");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const result = useScripted
          ? await runScriptedTurn(turn, send)
          : await runLiveTurn(turn, send);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", turn: result.trace.turn, session: result.session })}\n\n`,
          ),
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        send({ type: "error", message: detail });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return Response.json({
    engine: process.env.CHARLI_ENGINE ?? (process.env.ANTHROPIC_API_KEY ? "live" : "scripted"),
    keyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
