# 06 - PoC audit (2026-10-10) and the AI layer

## 1. Audit method
- `tsc` + `vitest` (88 tests) + hero-flow script (`scripts/flows.mjs`, 18 checks) as the functional baseline.
- Screenshot of every route and every tab at 1366x768 and 1440x900, EN + AR, dark + light, both project packs (`scripts/tabs-tour.mjs`, `scripts/pack-theme.mjs`).
- Click-through of every visible control, flagging those that change nothing (`scripts/dead-buttons.mjs`).
- Independent skeptical review by the `demo-reviewer` persona (punch list in section 4).

Result at the start: the engines and hero flows were sound (no console errors, 87/88 tests); the weaknesses were polish, narrative and a few real bugs.

## 2. Findings and what was done
| # | Finding | Status |
|---|---|---|
| 1 | No visible "how AI helps" story: briefing was static "RULE-BASED", no assistant | **Built** AI layer (section 3) |
| 2 | Reports had no route to Sia Excel assistance | **Added** S!a Excel-lence button (header of Reports + card), new tab, `noopener`; plus Excel-ready CSV of every report table |
| 3 | **Highway pack crashed the 3D twin** (port-only scene code: caissons, water, ships) | Fixed: scene is pack-aware (sand ground, highway camera presets, per-pack timeline jumps and camera labels) |
| 4 | Highway pack: programme 13 months vs "contract" Sep 2028; failing unit test | Pack metadata aligned to the CPM baseline, test updated (88/88 green) |
| 5 | Header and project name were hard-coded "PoC Port Project"; showed the wrong project after switching pack; wrapped/clipped at 1366 | Branded **S!aP Mazzant** / **Mina Al Hamriya Port** (illustrative, per the 2026-10-10 decision), header follows the active pack, compact selects, fits 1366 |
| 6 | Fleet: the crane that anchors hero flow H3 was invisible at the data date ("Flagged 0", no alarm) | Flag threshold 62 -> 75 (shared constant): CC-02 now shows in KPI, alarms, briefing and look-ahead from the start |
| 7 | Fleet: radar labels clipped, registry columns clipped, 50% utilisation everywhere | Radar resized, location column hidden below 2xl, utilisation varies per unit |
| 8 | What-If supply tab cramped at 1366/1440 (PO table wrapping, route planner overflow, empty middle card) | Bottom grid stacks below 2xl; empty state now has three call-to-action buttons |
| 9 | Cost: 7 KPIs wrapped at 1366, empty "Scenario cost impact" card with the button outside the card, truncated waterfall axis unlabelled | KPI grid 4-up below 2xl, proper empty state with CTAs, "(axis truncated)" noted |
| 10 | Procurement: "next delivery in - days", gateway "recordslatency", duplicate "SIMULATED SIMULATED", overlapping scatter labels | Fixed (templates, `.num` display gotcha, axis scaling) |
| 11 | Documents: every drawing rendered the same quay-wall section | Schematic per discipline (marine, civil, architectural, electrical, mechanical) |
| 12 | What-If calendar KPI showed "-0.0%" | Fixed |
| 13 | Twin overlay stretched; no hint that the opening view is a future (forecast) date | Overlay fixed; "Projected state (forecast)" chip |
| 14 | HSE/home alarms mentioned crane/quay when the highway pack was active | Alarm text is pack-aware |
| 15 | Command palette had pages and records only | Added Actions group: Ask AI, Play AI demo, Open S!a |

Known limits (not fixed, by design for a PoC): highway 3D scene is schematic (strip road, no terrain); CCTV imagery is generated stills; map tiles are offline vector outlines only.

## 3. The AI layer
Principle: **the numbers are real, the words are scripted.** Copilot answers call the same engines the rest of the app uses (`runScenario`, `recovery`, `assetOptions`, snapshot KPIs); only the sentence templates and the animations are authored. This is stated in the UI (AI DEMO chip tooltip, Copilot footer) and in the Integrations > Mock vs real table.

| Where | What the audience sees |
|---|---|
| Header / `Ctrl+J` | Copilot drawer: question chips, free text (keyword intents, EN+AR), thinking trace -> typed answer -> "computed from" chips -> action buttons (open page, replay hero flow, open S!a). **Play AI demo** types three questions itself. |
| Home | Briefing writes itself (steps, typed bullets), Regenerate, "Ask" chips, *Watch the AI at work* button |
| Procurement | AI supply-risk scan: rows flash in sequence, three findings with a real route recommendation each |
| Schedule | AI analysis: critical chain, supply driver, near-critical count |
| Digital Twin | AI site scan: sweep over the 3D scene, elements behind plan (+ material-at-risk elements) |
| Fleet & Assets | AI diagnosis: trace, failure-probability curve draws itself, typed explanation; shown automatically for flagged units |
| HSE | CCTV AI-vision sweep and staggered detection boxes; SOP is typed out; Incidents -> AI root cause |
| Documents | AI drawing review (findings pinned on the drawing), RFI draft reply |
| Cost | AI cost explainer |
| What-If | "AI recommends" marker on the top recovery option |
| Reports | AI executive summary + **S!a Excel-lence** + CSV |

Code: `app/src/features/ai/` (`kit.tsx` animation primitives, `intents.ts` Copilot brain, `Copilot.tsx`, `summary.ts`); per-page panels live beside their pages. Strings: `i18n/parts/ai.ts` and the per-feature parts (EN/AR parity is unit-tested). Animation primitives honour `prefers-reduced-motion`.

## 4. Independent review (demo-reviewer persona) - outcome
Fixed after the review:
- Reset (header and presenter) now returns HSE events/work orders, scenario, procurement state, twin state and Copilot history to the opening state (`app/resetDemo.ts`, verified by `scripts/reset-check.mjs`); Esc closes the Copilot.
- Fleet deep link `?asset=` always lands on the Registry tab (diagnosis visible).
- RFI draft is specific and consistent with the drawing review (RFI-030 asks for the missing tolerance), scrolls into view.
- Twin AI scan lists only elements truly behind plan; schedule analyst never quotes a past start date; HSE root-cause text no longer claims a pattern the log does not show; procurement scan has a headline and says "arrives X earlier"; cost explainer mentions approved variations (explains 2.29 bn vs 2.35 bn); SPI shows "-" before a package has planned work; map no longer captures page scrolling.
- New insight surfaced: spare SP-1101 (hoist gearbox bearings) has a 21-day lead time vs 16 days of remaining life.

Open (from the review, not changed):
- Cost S-curve flattens for about a year at the end; IPC certified total vs earned value in the cashflow table; two IPCs show the same month label.
- What-If "Run the chokepoint what-if" action replays the full scripted H1 (shock then recovery) so it opens already recovered; KPI card wraps at 1366.
- Copilot free text is keyword-based (two-part questions get one answer); user bubble stays in the typed language.
- Procurement route/suppliers tables clip a column at 1366; schedule look-ahead dates have no year; HSE KPIs (active permits 3 vs 2 in the table, LTIFR vs days since LTI) are loosely consistent.
- S!a Excel-lence needs internet and lands on its login page; have a screenshot ready if the room is offline.
