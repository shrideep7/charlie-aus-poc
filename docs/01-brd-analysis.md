# BRD Analysis — Charli Proof of Value, 1 Martin Place

Source: `260813_Charli_Demo_Pack.docx` (184 paragraphs, 5 tables).
Read line by line. Every requirement below is tagged with the source line so we can
defend each build decision back to the client.

**Note on naming:** the document consistently spells the product **Charli** (not
"Charlie"). All UI copy, system prompts and headings use **Charli**. The repo name
(`charlie-aus-poc`) is internal only.

---

## 1. What they are actually asking for

Stripped of framing, this is a **single-page conversational web demo** with **three
surfaces** and **zero integrations**:

| Surface | Audience | Source |
|---|---|---|
| Charli chat experience | Tenant (the person in the room) | L9, L23–29 |
| Trace panel | Presenter only, shown deliberately | L16, L144–157 |
| Configuration view | Presenter only, **static** | L158–166 |

The commercial question they are testing is **not** "can you build software". It is
*"when the concierge desk is dark at 7pm, can one agent hold the whole tenant
relationship — answer, coordinate, transact, and hand off — without the tenant ever
learning three different systems?"* (L4–6).

Line 6 is the actual product spec and contains five verbs. Everything we build must
visibly demonstrate all five:

| # | Verb (L6) | How the demo proves it |
|---|---|---|
| 1 | understands natural-language requests | free-text input, no menus required; multi-intent parsing |
| 2 | provides immediate assistance | instant answers from the building knowledge pack, no round-trips |
| 3 | coordinates simple related tasks | the hero journey: 4 tasks from 1 sentence |
| 4 | makes simulated bookings/requests | 4 reference-number families |
| 5 | connects tenants to the appropriate support pathway | 5 simulated teams + escalation tiers |

Line 5 is a licence, and we should use it: *"not to replicate current operating
procedures or build a production-ready solution."* The bar is **believability and
service-model clarity**, not correctness. So: no integrations, no auth, no database,
all data static.

---

## 2. Line-by-line reading

### Purpose (L3–6)
| Line | Says | Actually demands | Build implication |
|---|---|---|---|
| L4 | support tenants when concierge unavailable | the framing is **after-hours**, not general workplace assistant | header state shows "After-hours mode"; time-of-day framing in system prompt |
| L5 | not production, not current SOPs | permission to fake everything; also **do not** invent real building procedures | all content is clearly demo content; no real contact numbers (L20) |
| L6 | "capable, after-hours digital concierge" | premium hospitality tone, not IT helpdesk | voice rules (L23–29) go into the system prompt near-verbatim |

### Scope — in (L8–16)
- **L9 "One standalone … configured for 1 Martin Place"** — the phrase *configured for*
  is load-bearing. Combined with the config view (L158–166), it says: the asset, service
  menu, room catalogue, teams and recommendation set are **configuration, not code**.
  → Build a single `asset.config.ts` that drives *both* the agent and the config screen.
  That gives us a strong closing line: *"a second building is a new config file, not a
  new build."*
- **L10** prepared content + simulated workflows → author a content pack, get it signed off.
- **L11** four enquiry families: after-hours, guest, amenity, building-support.
- **L12** room discovery **with mock availability** and simulated booking → availability
  logic must actually run against the catalogue (L92–100), not be hardcoded per prompt.
- **L13** "a small selection" of concierge services → capped at six active (L183).
- **L14** four hand-off types: guest-pass, access, support, concierge-service.
- **L15** status updates for **previously raised** requests → requires a pre-seeded case
  store that exists before the demo starts (a cold session must still be able to answer
  "what's happening with my lighting request?").
- **L16** trace panel is **presenter-only** → must be hidden by default so the tenant
  view stays clean; revealed by a deliberate presenter action.

### Scope — out (L17–21)
This is the most valuable section in the document because of how much it removes:

| Excluded (L18–21) | Consequence for us |
|---|---|
| all live integrations (access control, booking, calendar, visitor mgmt, F&B, transport, payment, notifications) | **zero** external API work |
| real bookings/passes/approvals/dispatch/payments | reference numbers are theatre, and that is explicitly fine |
| real building procedures, contact details, live asset data | we author plausible demo content; never a real phone number |
| authentication, tenant data, live availability, **live maps**, analytics dashboard, admin portal | **no login screen, no map component, no dashboard, no admin** |

**Catch:** L79 and L80 promise *"I'll show you the quickest route"* / *"I'll show you the
charging location and usage steps"*, but L21 excludes live maps. → Resolve with a static
**Guidance card**: numbered route steps + optional static image. Never an interactive map.

### Experience principles (L22–29)
Six voice rules. Two have direct architectural consequences:
- **L26 "Ask one concise question only where essential information is missing"** — repeated
  at L130 ("one missing detail at a time"). This collides with the 7-turn ceiling (L169);
  see Open Question 5.
- **L27 "Carry the user's context across the conversation"** — session memory for level/
  suite, guest names, prior reference numbers. The status follow-up and the hero journey
  both depend on it.
- **L28 "Confirm actions with a realistic reference number"** — every action-taking turn
  must end with a reference.

### Safety behaviour (L30–34) — **highest-risk requirement**
Four scripted responses, quoted verbatim in the BRD, with `[placeholders]`:

| Tier | Trigger | Required copy (abridged) | Team |
|---|---|---|---|
| Emergency | fire/smoke/medical | "Please call **000** now and move to a safe area… recording your location as `[location]`" | Building Support (alerted) |
| Security concern | suspicious person/incident | "…connecting you with **After-Hours Building Support** now. Please remain in a safe, well-lit area." | After-Hours Building Support |
| Urgent building issue | water ingress, lighting out | "I've marked this as a **priority** for Building Support…" | Building Support |
| Approval matter | contractor access, external guests, The Forum | "Please provide `[required details]` and I'll submit this to Building Support for approval." | Building Support |

An LLM asked to "say this" will paraphrase it 1 time in 10. On stage, in front of a
client who has the exact wording in their own document, paraphrasing a **000** emergency
script is the single worst failure available to us.
→ **These four strings are returned by a deterministic tool, not generated.** The model
selects the tier and fills the slot; the copy is template-substituted in code and the
system prompt instructs Charli to emit the tool's `message` field unchanged.

### Presentation note (L35–36)
- Footer text is specified: **"Demonstration environment."** — discreet.
- **"Do not use technical caveats in Charli's normal responses."** → an explicit negative
  constraint. Charli must never say "as a demo I can't actually book…". Needs a hard
  system-prompt rule plus a golden test that greps for hedging language
  ("simulated", "I'm not able to actually", "in a real system").

### Simulated actions and references (L37–44)
Four families with worked examples:

| Action | Format | BRD example |
|---|---|---|
| Room/space booking | `BK-MP-####` | `BK-MP-1042` |
| Building/support request | `CH-MP-####` | `CH-MP-3018` |
| Concierge-service request | `CS-MP-####` | `CS-MP-4108` |
| Guest/access request | `VA-MP-####` | `VA-MP-1051` |

**Critical detail:** the hero-journey outcome (L113) uses **exactly** `BK-MP-1042`,
`VA-MP-1051`, `CS-MP-4108`, and the status example (L83) uses **exactly** `CH-MP-3018`.
Guardrail L181 says *"use pre-seeded results for all booking and status outcomes."*
→ The reference allocator serves a **scripted queue first** (1042 / 1051 / 4108 / 3018)
then falls back to a seeded deterministic sequence. When the client watches the hero
journey, the numbers on screen will match the numbers in their document. That is a
30-minute build and it is the detail that makes the room believe we read the pack.

### Simulated support teams (L45–50)
Five, fixed: After-Hours Building Support · Building Support · Security Desk ·
Visitor Services · Concierge Services. These are the only valid `routing_team` values.

### Enabled service menu (L51–70)
Fifteen services in three categories. Guardrail L183 caps **active** concierge services
at six, remainder as **interface chips only**. Our mapping:

| Category | Service | State | Source |
|---|---|---|---|
| Meetings & guests | Meeting/workspace discovery + booking | **Active** (dedicated booking flow) | L53 |
| Meetings & guests | Guest/visitor pass requests | **Active** | L54 |
| Meetings & guests | Contractor access request capture | **Active** (approval tier) | L55 |
| Meetings & guests | Building tours | **Active** | L56 |
| Access & support | After-hours building access | **Active** (knowledge answer) | L58 |
| Access & support | Access-pass troubleshooting | **Active** | L59 |
| Access & support | Parking / EV / bike & end-of-trip guidance | **Active** (guidance cards) | L60 |
| Access & support | Building / equipment / amenity support capture | **Active** | L61 |
| Access & support | Security and emergency escalation | **Active** | L62 |
| Access & support | Status updates | **Active** | L63 |
| Concierge (6 active) | Restaurant & venue recommendations | **Active 1** | L65 |
| Concierge | Taxi / airport transport | **Active 2** | L66 |
| Concierge | Portable charger loan | **Active 3** | L67 |
| Concierge | Umbrella loan | **Active 4** | L67 |
| Concierge | Luggage storage | **Active 5** | L68 |
| Concierge | Event / activation support capture | **Active 6** | L70 |
| Concierge | Wellness & local experience info | **Chip only** — answered from knowledge pack, no request created | L69 |

Rationale for the one chip: L69 is purely informational and creates no reference number,
so it is the only concierge item that loses nothing by being non-transactional. This
keeps us exactly at the six-active cap while still answering the question if asked.

### Prepared user requests (L71–91) — **these are our acceptance tests**
Seventeen rows of `user ask → expected Charli response → simulated route`. This is a
golden-transcript suite handed to us for free. Acceptance L173 only requires ten; we have
seventeen, so we target all seventeen.

Observed route vocabulary (the trace panel's "simulated route" field): After-Hours
Building Support · Access support · Visitor Services · Space booking · Amenity guidance ·
Building Support · Access approval · Status update · Concierge Services.

Note the shape of the expected replies: several are **questions**, not completions
(L76, L77, L78, L84, L85, L86, L87, L88, L89, L90). Charli's correct first move on a
transactional request is to collect the one missing detail — not to invent it. The room
booking flow is therefore: *ask duration → propose best + alternative → confirm → issue
`BK-MP-####`* (L78 asks duration before proposing).

### Sandbox room catalogue (L92–100)
Five spaces. The availability data is deliberately constructed to create the demo's
decision moments:

| Space | Cap | Equipment | Rule | Demo availability |
|---|---|---|---|---|
| Martin Boardroom | 12 | Display, whiteboard | External guests require approval | **Unavailable tomorrow 08:00–10:00** |
| Park Meeting Room | 8 | Display | Standard | Available tomorrow 08:00–12:00 |
| Pitt Collaboration Room | 6 | Display, whiteboard | Standard | Available tomorrow **09:00**–17:00 |
| The Forum | 24 | Display, presentation setup | Approval required | Available on request |
| Quiet Room | 2 | — | Max 2 hours | Available tomorrow 08:00–18:00 |

Two traps are built into this table, and both matter on stage:
1. **"I need a room for 12 people tomorrow morning"** (L116) → Martin Boardroom is the only
   12-cap room and it is blocked 08:00–10:00 → forces the "that's unavailable, here's the
   next best option" exchange (L117) → The Forum (24, approval required).
2. **Hero journey: 6 people, 08:00, 90 min** → Quiet Room fails on capacity, Pitt fails on
   time (opens 09:00), Martin fails on time (blocked until 10:00). Only **Park Meeting
   Room** works — which is exactly what the BRD's own worked example books (L113). The
   *alternative* we offer must therefore be **The Forum (on request)**, not Pitt.
   → See Open Question 1.

### Hero journey (L101–113)
One utterance, four intents (room · guest passes · breakfast recommendation · airport
taxi). Eight required flow steps (L104–111). Missing details to collect (L105): meeting
duration, guest names/companies, airport terminal, pickup time. Finishes with **one
concise itinerary carrying all reference numbers** (L111).

The worked outcome (L113) hides a nice context-carry demonstration: the meeting is
08:00–09:30 and the taxi is **09:45** — i.e. Charli inferred the pickup time from the
meeting end rather than asking. We should reproduce that: propose 09:45 and ask only for
the terminal. It saves a turn *and* it is the moment a room notices the agent is thinking.

### Supporting test prompts (L114–125)
Eleven additional prompts, including the two escalation extremes: *"There is water coming
into our suite on level 17"* (→ urgent building issue) and *"I smell smoke in the
corridor"* (→ emergency / 000). See Open Question 2.

### Shared service-request workflow + generic schema (L126–142)
This is the architectural instruction, and it is unusually explicit:
- **L127** one conversational front door; routing happens invisibly.
- **L128–133** six steps: identify intent → load required fields → ask one missing detail →
  create simulated request → return confirmation + reference + next step → **offer one
  relevant follow-up**.
- **L134–142** the service schema, given as JSON: `service_id`, `service_name`, `asset`,
  `required_fields[]`, `routing_team`, `reference_format`.
- **L180** *"Use one generic service-request handler for all non-booking requests."*

→ Our service registry uses **their exact schema shape**, and there is exactly **one**
`submit_service_request` tool behind every non-booking action. The config view renders the
registry, so the client sees their own JSON on screen. Do not invent a per-service handler.

### Trace panel (L144–157)
Eight fields per interaction: Asset · User request · Intent(s) · Extracted entities ·
Confidence · Rules applied · Actions · Outcome. For escalations, three more: urgency ·
destination team · hand-off summary.

Reliability decision: the trace is **not** reconstructed after the fact and **not**
inferred by a second model call. Charli is forced to call a `record_trace` tool as its
first action on every turn (`tool_choice` pinned on the first iteration). The panel can
then never be empty, which matters because the panel is half of what they are buying.

### Configuration view (L158–166)
Six static sections; **L166 explicitly forbids a live editor**. Rendered from the same
config objects the agent consumes — so it is provably the real configuration, not a
mock-up of one.

---

## 3. Acceptance criteria → how we satisfy each (L167–176)

| # | Criterion | Satisfied by | Verified by |
|---|---|---|---|
| 1 | Hero journey in **≤7 turns** after the initial request | 5-turn scripted turn map (§4) | golden test asserts turn count |
| 2 | Multiple intents; asks only for **missing** essential details | `record_trace.intents[]`; required-field diffing in the service registry | golden test asserts ≥4 intents on hero utterance, and that no already-supplied field is re-asked |
| 3 | Recommends a room **and an alternative** using mock capacity, rules, availability | `find_spaces` runs real filters over the L92–100 catalogue | golden test asserts 2 distinct spaces + rule badges |
| 4 | Creates simulated booking, guest/access, support and concierge references | 4 reference families via the allocator | golden test asserts one valid ref per family across the suite |
| 5 | Answers **≥10** common after-hours / guest / amenity / concierge requests | all 17 prepared asks (L74–90) | golden replay of 17 + 11 prompts |
| 6 | Handles access, standard support, approval, security and emergency with correct routing | `escalate` tiers + registry `routing_team` | golden test asserts verbatim safety copy + team per tier |
| 7 | Answers a status follow-up from **pre-seeded** case data | seeded case store incl. `CH-MP-3018` | golden test from a cold session |
| 8 | Trace panel shows intent, entities, confidence, actions, outcome | forced `record_trace` | golden test asserts all 8 fields non-empty per turn |

## 4. Guardrails → our compliance (L177–184)

| Guardrail | Compliance |
|---|---|
| L178 one full hero journey only | one hero journey; every other prompt is single-step |
| L179 static/mock data only | no DB, no network calls except the model API |
| L180 one generic service-request handler | single `submit_service_request` tool |
| L181 pre-seeded booking and status outcomes | scripted reference queue + seeded case store |
| L182 ≤3 local recommendations per category | content pack holds exactly 3 per category; enforced in the prompt and by test |
| L183 ≤6 active concierge services, rest as chips | table in §2; wellness/local-experience is the display-only chip |
| L184 no new integrations or workflows unless replacing an in-scope item | see the **deliberately not building** list below |

### Deliberately NOT building (so nobody expects it on the day)
Login/SSO · tenant profiles · any real integration · interactive map or wayfinding ·
payments · analytics dashboard · admin or config editor (L166) · voice input ·
mobile app · multi-building switcher · notifications/email · second hero journey.

If the client asks for one of these in the room, the answer is *"that's the production
phase — and here's the config-driven path to it"*, not a scope change before the demo.

---

## 5. Decisions we have made (and will state on the day)

1. **Safety copy is deterministic, not generated.** Non-negotiable for the 000 script.
2. **Trace is captured by a forced tool call**, so the panel is never empty.
3. **Reference numbers are pre-seeded to match the BRD's own examples.**
4. **Building knowledge (FAQ, amenity guidance, recommendations) lives in the cached
   system prompt**, not behind a tool — so factual answers return instantly with no extra
   round trip. Tools are reserved for actions that produce a reference or need
   availability logic.
5. **Amenity "routes" are static step cards**, honouring the no-live-maps exclusion (L21).
6. **A deterministic rails mode** replays the hero journey with canned copy if the network
   or API fails on stage. Insurance, and it costs half a day.

## 6. Open questions for the client (none block the build)

We proceed on the stated assumption in each case; each is a 2-minute confirmation.

| # | Question | Our assumption |
|---|---|---|
| 1 | The hero journey needs a room for 6 at 08:00, but Pitt Collaboration Room only opens at 09:00 and Martin Boardroom is blocked until 10:00 — so the "one alternative" to Park Meeting Room can only be **The Forum (approval required)**. Confirm, or shift Pitt's window to 08:00? | We offer **The Forum** as the alternative and flag the approval rule — it also demonstrates rule handling. |
| 2 | *"I smell smoke in the corridor"* (L124) — Emergency tier (000) or urgent building issue? | **Emergency tier.** Smoke gets the 000 script, then we ask for the level to complete `[location]`. |
| 3 | The local-recommendation set (L165) is referenced but not supplied — breakfast, dining, wellness, venues. | We author 3 per category as plausible Sydney CBD / Martin Place demo content, clearly marked demo content, and send it for sign-off on Day 2. |
| 4 | Pre-seeded status cases: only the `CH-MP-3018` lighting case is given (L83). | We seed four cases (lighting, HVAC, access pass, cleaning) so a status question lands from any angle. |
| 5 | "One question at a time" (L26/L130) vs the 7-turn ceiling (L169). | We ask one question per turn but **pair a question with the result of the previous step** (e.g. "Booked — `BK-MP-1042`. Who are your guests?"). That satisfies both and lands the hero journey in 5 turns. |
| 6 | Any brand assets — logo, typeface, colour — for Charli or 1 Martin Place? | We ship a neutral premium hospitality palette; swapping brand is a token change if assets arrive by Day 3. |
