# Charli PoV — Build Plan

**Compressed to two days at the client's request.** Day 1 (Wed 19 Aug) is built and in
the repo; Day 2 (Thu 20 Aug) is polish, live-engine tuning, deploy and dry runs. Demo
from Fri 20 Aug onwards.

Effort: **1 senior full-stack engineer, 2 working days.** What was cut to fit, and what
was kept, is set out in §0.

---

## 0. What the two-day compression changed

Kept in full — these are what the demo is judged on:

- The hero journey, five turns, matching the brief's own reference numbers.
- All 17 prepared asks and all 11 supporting prompts.
- All four escalation tiers with byte-identical safety copy.
- The presenter trace panel, all eleven fields.
- The static configuration view.
- The golden transcript harness — this got *more* important, not less: with less time to
  hand-test, automated evidence is the only way to know the acceptance criteria hold.

Cut or reduced, deliberately:

| Item | Decision |
|---|---|
| Design polish | One pass, not two. The palette and type system are committed; there is no second visual iteration. |
| Guidance cards | Kept, but as static step lists rather than illustrated route cards. No imagery to produce. |
| Second dry run | Compressed to two runs on Day 2 rather than staged rehearsals across two days. |
| Recommendation sign-off | Content authored now and sent for sign-off in parallel with the build, rather than gated before it. |
| Live-engine tuning | Deferred to Day 2, because it needs an API key this environment does not have. |

Nothing in the brief's scope was dropped. The compression came out of iteration count and
polish, not coverage — that was the only safe place to take it from.

## 1. Shape of the thing we are building

One Next.js application. Three routes. No database, no auth, no integrations.

```
┌──────────────────────── Charli (tenant view, "/") ─────────────────────────┐
│  header: Charli · 1 Martin Place · After-hours mode                        │
│  ┌──────────────────────────────┐   ┌─────────────────────────────────┐    │
│  │ conversation                 │   │ PRESENTER TRACE PANEL           │    │
│  │  • text + rich cards         │   │ (hidden by default, ⌘⇧T)        │    │
│  │    RoomOptions / Confirmation│   │  asset · request · intents      │    │
│  │    Guidance / Recommendations│   │  entities · confidence · rules  │    │
│  │    Itinerary                 │   │  actions · outcome              │    │
│  │  • service-menu chips        │   │  + urgency/team/handoff         │    │
│  └──────────────────────────────┘   └─────────────────────────────────┘    │
│  input ▸                                                                   │
│  Demonstration environment.                                                │
└────────────────────────────────────────────────────────────────────────────┘

/presenter/config   static configuration view, rendered from the live config objects
/api/charli         streaming agent endpoint (SSE)
```

### Stack
| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 16 (App Router) + TypeScript** | one deployable serving UI + agent route; no separate backend to host |
| UI | **Tailwind**, CSS keyframes for card entrances | premium look without a component-library dependency; motion is what makes a demo feel expensive, and `prefers-reduced-motion` is respected |
| Model | **`claude-opus-5`**, adaptive thinking, streaming, prompt-cached system prefix | strongest multi-intent parsing and slot-filling; adaptive thinking handles the 4-intent hero utterance without prompt gymnastics |
| Transport | SSE from a Next route handler | lets us interleave `text`, `tool`, and `trace` events in one stream, so the trace panel fills live as Charli works |
| State | in the browser, posted back each turn | L21 excludes tenant data; there is no server-side store at all |
| Data | static TypeScript modules | L179 mandates static/mock only |
| Deploy | **Vercel** preview URL + local build as backup | one URL to share; local build removes venue-wifi risk |

If the team would rather stay on a stack it already runs in production, the only
constraint that matters is "server-side streaming route + the Anthropic TypeScript or
Python SDK". Nothing in this plan depends on Next specifically.

---

## 2. Data layer — everything the client can point at

Five files, all pure data, all rendered by the config view so the client can see them.

```
src/config/
  asset.ts          asset name, operating model, footer copy, teams, reference formats
  services.ts       the service registry — their schema, verbatim shape
  spaces.ts         the 5-room sandbox catalogue + booking rules
  knowledge.ts      FAQ answers, amenity guidance step-cards, 3-per-category recommendations
  cases.ts          pre-seeded status cases (incl. CH-MP-3018)
```

`services.ts` uses the BRD's own schema (BRD L134–142) so the config screen shows the
client their own JSON:

```ts
export const services: ServiceDefinition[] = [
  {
    service_id: 'taxi',
    service_name: 'Taxi coordination',
    asset: '1 Martin Place',
    required_fields: ['pickup', 'destination', 'time', 'passengers'],
    routing_team: 'Concierge Services',
    reference_format: 'CS-MP-####',
  },
  // guest_pass, contractor_access, building_tour, building_support,
  // access_support, charger_loan, umbrella_loan, luggage_storage, event_support …
]
```

**Reference allocator** (`src/lib/references.ts`) — the detail that makes the demo match
their document:

```ts
const SCRIPTED = ['BK-MP-1042', 'VA-MP-1051', 'CS-MP-4108', 'CH-MP-3018']
// served in order on first use per family, then a seeded deterministic sequence
```

---

## 3. Agent design

One system prompt, six tools, one forced first call.

### System prompt (assembled, prompt-cached)
Stable prefix — cached, so it costs almost nothing after the first turn:
1. Identity and operating model: Charli, after-hours digital concierge, 1 Martin Place.
2. The six voice rules (BRD L23–29) near-verbatim.
3. **Hard negative rules:** never use technical caveats or mention that anything is
   simulated (L36); never invent a real phone number or contact (L20); never offer a
   service outside the enabled menu.
4. Turn discipline: one question per turn, paired with the previous step's result; always
   end with exactly one relevant follow-up offer (L133).
5. The building knowledge pack: FAQ answers, amenity guidance, recommendation set
   (3 per category), room catalogue summary, teams, reference formats.
6. Escalation tiering rules — *which* tier, never the copy.

Volatile suffix after the cache breakpoint: session context (level/suite, guest names,
references already issued this session).

### Tools

| # | Tool | Purpose | Notes |
|---|---|---|---|
| 1 | `record_trace` | intents[], entities{}, confidence, rules_applied[], plus urgency / destination_team / handoff_summary on escalations | **Forced as the first call every turn** via `tool_choice`. Guarantees the trace panel is never empty. `strict: true`. |
| 2 | `find_spaces` | filter the catalogue by capacity, date, start, duration, external guests → best + one alternative, each with rule flags | real logic over `spaces.ts`, so the L116/L117 "next best option" exchange emerges rather than being scripted |
| 3 | `create_booking` | issue `BK-MP-####` after confirmation | allocator-backed |
| 4 | `submit_service_request` | **the one generic handler** for every non-booking request (L180) — resolves `service_id` → routing team + reference format → issues `CH/CS/VA-MP-####` | also returns which required fields are still missing, so slot-filling is driven by data not by prompt |
| 5 | `lookup_request_status` | pre-seeded case lookup by reference or description | works from a cold session (L15, L175) |
| 6 | `escalate` | tier → returns the **verbatim** BRD safety copy with `[location]` / `[required details]` substituted, plus urgency and destination team | copy lives in code; the model must emit `message` unchanged |

That is 6 tools, 1 of which is observability and 1 of which is the mandated generic
handler. Deliberately small — every tool is a thing that can misfire on stage.

### Why the trace is a forced tool call
The trace panel is half of what this PoV sells: it is where the buyer sees that Charli
*reasons* rather than pattern-matches. If it renders late, or empty, or only for some
turns, the panel undermines the story instead of carrying it. Pinning `tool_choice` to
`record_trace` on the first iteration of every turn makes it structurally impossible for a
turn to arrive untraced.

---

## 4. The hero journey, turn by turn (≤7 required, we land 5)

Opening utterance (L102): *"I have six interstate clients arriving at 8am tomorrow. Please
arrange a room, organise guest passes, recommend breakfast nearby, and book a taxi to the
airport for one guest after the meeting."*

| Turn | Charli does | Reference issued | Proves |
|---|---|---|---|
| 1 | Names all four parts back; asks **duration** only | — | multi-intent recognition (L104), asks only what's missing (L105) |
| 2 | Recommends **Park Meeting Room 08:00–09:30** + alternative **The Forum** (approval flagged); asks to confirm | — | capacity/rule/availability reasoning (L106) |
| 3 | Books it; asks **guest names and companies** | `BK-MP-1042` | simulated booking (L107) |
| 4 | Passes ready + arrival summary; gives **two breakfast options**; proposes **09:45** pickup (inferred from the 09:30 finish) and asks only for the **terminal** | `VA-MP-1051` | guest passes (L108), recommendations (L109), context carry (L27) |
| 5 | Taxi arranged; returns **one concise itinerary with all references** | `CS-MP-4108` | consolidated outcome (L111), matches the BRD's own worked example (L113) |

Turn 4 is the moment worth rehearsing — proposing 09:45 without being asked is what makes
the room lean forward.

---

## 5. Screens and components

**Tenant chat (`/`)**
- Header: Charli wordmark, `1 Martin Place`, `After-hours mode` state pill.
- Streaming message list; Charli's text streams token by token.
- Service-menu chips below the input, grouped by the three BRD categories. Active chips
  seed a prompt; the display-only chip (wellness & local experience) is styled as
  available but non-transactional per L183.
- Discreet footer: **Demonstration environment.**

**Rich cards** (each maps to a BRD requirement, not decoration)
| Card | Shows | Source |
|---|---|---|
| `RoomOptions` | best + alternative, capacity, equipment, booking rule badge, availability window | L106, L92–100 |
| `Confirmation` | reference number, routing team, next step | L28, L132 |
| `Guidance` | numbered static route steps (showers/lockers, EV, bike & end-of-trip, parking) | L79–80, honouring no-maps (L21) |
| `Recommendations` | max 3 options, style/party-size aware | L109, L182 |
| `Escalation` | tier banner, team, urgency, hand-off summary | L30–34, L157 |
| `Itinerary` | the hero-journey finale, all four references in one block | L111, L113 |

**Presenter trace panel** — slide-over, hidden by default (`⌘⇧T` or `?presenter=1`), one
collapsible entry per turn, all eight fields plus the three escalation fields, with tool
calls and latency shown. Turns are numbered so the presenter can point at the 7-turn
ceiling being met.

**Presenter configuration view (`/presenter/config`)** — static, six sections exactly as
L159–165: asset · operating model · enabled services (with the raw service schema JSON) ·
room catalogue and booking rules · escalation teams and priority rules · local
recommendation set. No editor (L166). Rendered from `src/config/*` so it is demonstrably
the live configuration.

---

## 6. Demo reliability — the part that actually wins the room

A PoV demo fails for operational reasons, not architectural ones. Four cheap insurances:

1. **Golden transcript harness** (`npm run golden`) — replays all 17 prepared asks
   (L74–90), all 11 supporting prompts (L115–125), and the full hero journey, then asserts:
   correct route/team, valid reference format per family, best + alternative present,
   safety copy **byte-identical** to the BRD, hero journey ≤7 turns, no hedging language,
   ≤3 recommendations per category, all 8 trace fields populated. Runs in CI and again the
   morning of the demo. This is our evidence, not just our test.
2. **Rails mode** (`?rails=1`) — deterministic canned playback of the hero journey and the
   top eight prompts, no API calls. If the venue wifi dies or the API rate-limits mid-demo,
   the presenter switches and nobody in the room knows.
3. **Presenter reset** — one control clears the session and re-seeds references so the
   hero journey can be run twice cleanly (it will be: once for the room, once for the
   person who arrived late).
4. **Recorded backup** — a 4-minute screen recording of the full hero journey plus one
   escalation, on the laptop. Costs 20 minutes on Day 4.

Latency: streaming plus a cached system prompt keeps first token well under a second;
the knowledge pack living in the prompt (not behind a tool) removes a round trip from
every factual answer.

---

## 7. Two-day plan

| Day | Date | Deliverable |
|---|---|---|
| **1** | Wed 19 Aug | **Done and committed.** Five config/data modules from the brief's tables. Six-tool agent surface with forced tracing and deterministic safety copy. Live engine (Claude Opus 5, streaming, prompt-cached) and deterministic engine. Tenant chat with seven card types, presenter trace panel, static configuration view. Golden harness: 88 checks, all passing. Production build clean, driven end to end in a real browser. |
| **2** | Thu 20 Aug | Live-engine tuning against the golden suite with a real API key (the one thing that cannot be done without one). Content sign-off pass. UI polish. Deploy. Two dry runs. Backup recording. Freeze. |

Two things carry over into Day 2 by necessity rather than choice:

1. **The live engine has not been exercised against the API** — there is no key in this
   environment. The code path is written, typechecked and built, and `npm run golden:live`
   drives the whole acceptance suite through it. That is the first thing to run tomorrow,
   and it is the only item with genuine unknowns left in it.
2. **Recommendation content is unsigned** — it is authored and plausible, but the client
   has not seen it.

## 8. Run-of-show for the demo (12 minutes, then questions)

| Min | Beat | What the room sees |
|---|---|---|
| 0–1 | Set the scene | 7pm, concierge desk dark, tenant has clients arriving at 8am. Charli on screen, after-hours mode. |
| 1–4 | **Hero journey** | one sentence in, four coordinated tasks out, itinerary with all four references. No menus touched. |
| 4–6 | Breadth | rapid-fire: after-hours access, showers and lockers, EV charging, charger loan, quiet business lunch. Instant, warm, on-brand. |
| 6–8 | Rules and friction | "a room for 12 tomorrow morning" → unavailable → next best option with the approval rule surfaced. Then contractor access → approval capture. |
| 8–9 | Escalation | water ingress on level 17 → priority to Building Support. Then smoke in the corridor → the 000 script, verbatim. Deliberately unhurried; this is the trust moment. |
| 9–10 | Continuity | "what's happening with my lighting request?" → `CH-MP-3018`, electrician at 8:30am. From a cold session. |
| 10–11 | **Reveal the trace panel** | replay the hero turn: intents, entities, confidence, rules applied, actions, outcome. This is where the buyer stops watching a chatbot and starts seeing a service model. |
| 11–12 | Configuration view | "everything you just saw is this config. A second building is a new config file." Close. |

Closing line to have ready: *"This is the tenant experience and the service model. What
turns it into production is replacing six simulated routes with six real ones — the
conversation layer doesn't change."*

---

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Model paraphrases the 000 safety script | High if generated | Copy is deterministic in `escalate`; golden test asserts byte-identical |
| Hero journey creeps past 7 turns | Medium | Turn map locked Day 3; golden test fails the build on turn 8 |
| Reference numbers don't match the client's document | Medium | Scripted allocator seeds 1042 / 1051 / 4108 / 3018 |
| Venue network or API hiccup mid-demo | Medium | Rails mode, local build, recorded backup |
| Charli hedges ("in a real system I'd…") | Medium | Hard negative prompt rule + golden test greps for hedging language |
| Recommendation content not signed off in time | Medium | Sent Day 2; clearly-marked demo content is acceptable per L20/L179 |
| Scope creep from an in-room request | High | The "deliberately not building" list is agreed in advance; the answer is the production-phase path (L184) |
| Demo brought forward to Mon 24 | Low | Days 1–3 already deliver the hero journey, trace panel and escalations — the config view and rails mode are the only Day-4 items, and both are presentable-if-rough |

---

## 10. What is in the client's hands on the day

1. Hosted Charli URL (works on their own phone — mobile-first layout).
2. Tenant chat handling all 17 prepared asks plus the 11 supporting prompts.
3. Presenter trace panel and static configuration view.
4. Golden transcript report — every acceptance criterion, evidenced, with the BRD line
   reference against each row.
5. A two-page service-model summary: the six simulated routes, and what each becomes in
   production.
6. This plan and the BRD analysis, so they can see we read all 184 lines.
