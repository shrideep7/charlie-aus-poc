# Charli PoV — 1 Martin Place

Proof of Value for **Charli**, an after-hours digital concierge for 1 Martin Place.
Demonstrates the tenant experience and service model when the concierge desk is
unavailable. Simulated workflows only — no integrations, no auth, no live data.

> Demonstration environment.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Charli runs without an API key: with `ANTHROPIC_API_KEY` unset it falls back to the
deterministic engine, so the demo never fails to start. For the live agent:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

| Route | What it is |
|---|---|
| `/` | Charli tenant chat. `?rails=1` starts in deterministic playback. |
| `/presenter/config` | Presenter-only static configuration view |
| `/api/charli` | Streaming agent endpoint (SSE); `GET` reports the active engine |

**Presenter controls** — `⌘⇧T` / `Ctrl⇧T` or the *Trace* button reveals the trace panel.
The footer carries *Hero journey*, *Rails on/off* and *Reset*.

## Acceptance evidence

```bash
npm run golden         # deterministic engine — no API key needed
npm run golden:live    # same suite through Claude Opus 5
```

Replays all 17 prepared asks, all 11 supporting prompts and the full hero journey, then
asserts every acceptance criterion and guardrail in the brief. Each result cites the BRD
line it evidences. Currently **88/88 checks across 31 criteria**.

Also: `npm run typecheck`, `npm run build`.

## How it fits together

```
src/config/     asset · services · spaces · knowledge · cases      ← all static data
src/lib/        tools (6) · prompt · engine-live · engine-scripted · references
src/app/        page · api/charli · presenter/config
src/components/ Charli · Cards · TracePanel
harness/        golden.ts
```

Both engines share the same tool executors, so references, routing and cards are
identical — only language generation differs. The configuration view renders the same
config modules the agent reads at runtime, so configuring another asset means replacing
those values, not rebuilding.

## Documents

| Document | Contents |
|---|---|
| [`docs/01-brd-analysis.md`](docs/01-brd-analysis.md) | Line-by-line analysis of the client BRD, acceptance traceability, guardrail compliance, decisions, open questions |
| [`docs/02-build-plan.md`](docs/02-build-plan.md) | Two-day plan, architecture, agent design, hero-journey turn map, demo run-of-show, risks |
