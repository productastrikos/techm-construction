# 03 — MVP Scope & Demo Script

The MVP is "the smallest build that wins the meeting." It is **thin vertical slices**, each demonstrable on its own.

## 1. MVP definition
**In:** every **P0** item in the PRD, built to demo polish. **Stretch:** P1 as time allows, in the order of §4. **Out:** P2.

### The 3 hero flows (everything else exists to support these)
| # | Flow | Wow moment | Chain it exercises |
|---|---|---|---|
| **H1** | **"Hormuz shock"** — Procurement → What-If | Presenter sets Hormuz = Closed and the fender/crane-rail/switchgear shipment slips 5 weeks. In ~3 seconds the Gantt grows ghost bars, the critical path jumps, the 3D berths turn amber, cost bar adds AED, and 3 recovery options appear. | Supply route → PO → BOM → activity → CPM → 3D → cost |
| **H2** | **"Eid & Summer slowdown"** — Calendar What-If | Presenter selects "Ramadan + Eid al-Fitr" then "Summer midday ban". Productive-hours heatmap lights up, quay-wall caisson output drops X %, finish moves; compare "night shift" vs "pre-Eid push". | Calendar → productivity → activity durations → CPM → cost |
| **H3** | **"Crane will fail in 9 days"** — Asset health | Fleet radar shows the crawler crane's hoist-gearbox bearing trending bad; click → failure probability, explanation, "if it fails: 11 days lost, AED …", one-click work order; Gantt shows planned service window with no loss. | Telemetry → RUL → asset-activity link → CPM → work order |
| **H4** *(closer)* | **Stress test** — stack H1+H2+H3 | Tornado chart ranks the drivers; "Generate board briefing" produces the PDF. | Combined |

### Supporting slices (needed so the hero flows look real)
Portfolio home → Site 3D twin + 4D scrubber → Gantt → Procurement tower → Fleet/CMMS → Cost/EVM → HSE + CCTV → Reports → EN/AR → Project-pack switch.

## 2. Slice order (build sequence — see 05 for detail)
1. **S0 Foundation:** repo, design system, layout shell, i18n, theme, demo clock.
2. **S1 Sim core + data model:** seeded generator for WBS/activities/materials/POs/assets/telemetry; CPM engine + unit tests.
3. **S2 Twin:** procedural port scene + 4D progress + equipment + selection.
4. **S3 Schedule/Gantt** with baseline-vs-forecast ghost bars.
5. **S4 What-If Studio A (supply/route)** → H1 playable end-to-end.
6. **S5 What-If B (calendar)** → H2.
7. **S6 Asset health + What-If C** → H3.
8. **S7 Procurement tower, Cost/EVM, HSE/CCTV, Reports.**
9. **S8 Portfolio home, AI briefing, role views, Project-pack #2, polish, Arabic QA.**
10. **S9 Packaging** (`run.bat`, README, talk track, offline test).

Each slice ends with `/demo-verify` (screenshots + console clean) before the next starts.

## 3. Demo script (20 minutes)

**0:00 – Open (2 min) — Portfolio home.** CXO role. "Three sites, one pane." Briefing card reads out today's top risks. *Maps to deck: no enterprise-wide visibility.*

**2:00 – The site twin (3 min).** Drill into the port. Orbit the 3D scene; scrub the 4D timeline from dredging to cranes; click a berth → status/cost/schedule. Toggle colour mode "material availability". *Deck: 3D spatial engineering management.*

**5:00 – H1 Hormuz shock (5 min).** Procurement tower → route planner → Hormuz Closed → show fender & crane-rail PO late → open What-If Studio → pick recovery option "Fujairah/Khor Fakkan + bonded trucking" vs "air-freight critical items" → compare AED vs days. Commit scenario. *The line: "Your logistics partner moves the containers. We tell you which activity dies if one is late — and what to do about it."*

**10:00 – H2 Calendar (3 min).** Switch to Calendar view; pick Ramadan; then Summer; show lost productive hours and mitigation comparison. Flip UI to **Arabic** to show RTL (10 seconds, big reaction).

**13:00 – H3 Asset health (3 min).** Fleet → crane flagged → explanation → work order → Gantt shows protected window.

**16:00 – Safety & site (2 min).** HSE dashboard + CCTV wall: detection box on a crane exclusion-zone breach → auto SOP/work order. *Deck: video analytics and work-order generation.*

**18:00 – Close (2 min).** Stress-test tornado → "Generate board report" PDF → switch Project Pack to Highway/High-rise: "Same engine, new project, one afternoon." Show benefits slide.

**Fallbacks:** (a) presenter panel can jump directly to any scenario checkpoint; (b) every flow has a pre-baked "Replay" button that runs the scripted sequence if live interaction misbehaves; (c) a recorded 3-minute MP4 of the full flow is packaged beside the app (`demo_video/`).

## 4. Acceptance criteria (definition of done for the MVP)
| ID | Criterion | How verified |
|---|---|---|
| A1 | `run.bat` on a clean Windows laptop opens the app with no network; no console errors | `/demo-verify`, `poc-qa` agent |
| A2 | H1 completes in ≤ 6 clicks and updates Gantt, 3D, cost, risk within 1 s | Playwright flow + screenshots |
| A3 | H2: switching scenario updates productive-hours heatmap and finish date; numbers reconcile with calendar rules (unit tests) | Vitest + visual |
| A4 | H3: injected fault → failure window shown → work order created → appears in CMMS and Gantt | Playwright |
| A5 | CPM engine passes unit tests (forward/backward pass, float, critical path, calendar-aware durations, lag/lead) | Vitest |
| A6 | 3D scene ≥ 45 fps on integrated GPU, total GLB payload ≤ 40 MB after Draco/Meshopt | Perf script + glb-optimize |
| A7 | EN↔AR switch flips layout RTL with no clipped/overflowing text on 6 key screens | Screenshots at 1366×768 |
| A8 | Every simulated source has a visible SIMULATED chip; README mock-vs-real table complete | Manual review |
| A9 | All 3D/image assets have licence + source recorded in `CREDITS.md` (CC0/CC-BY only) | Manual review |
| A10 | `demo-reviewer` agent scores the running app ≥ "client-ready" on polish/narrative | Review pass |

## 5. Risks & mitigations
| Risk | Mitigation |
|---|---|
| 3D scene too heavy / looks cheap | Procedural geometry for civil works (cheap, animatable); downloaded models only for ~10 hero equipment pieces; Draco/Meshopt; instancing for containers/trucks; quality toggle |
| Free-plan Meshy credits run out | Sketchfab first; max 1 retry per Meshy asset; procedural placeholder always works |
| What-if numbers feel arbitrary | Seed data from stated public figures; show the formula/drivers on screen; deterministic seed; label illustrative |
| Scope explosion | P0 gate; P1 only after H1–H3 verified; P2 stays out |
| Project-identity mismatch (Mina Al Hamriya vs Fujairah) | All names/coords in one pack config; resolved via user answer Q1 |
| Presenter nervous / live-demo failure | Replay buttons, checkpoints, recorded fallback video |
| Arabic RTL breaks layout late | Build with logical CSS properties (`ms-`, `me-`, `start/end`) from S0 |
