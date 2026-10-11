# 02 — Product Requirements Document (PRD)

**Product:** Mazzant Construction — Remote Construction Management & Digital Twin (Astrikos.ai)
**Type:** Front-end-complete **demo / proof of concept** (not a production system). Data is simulated; every simulated source is labelled.
**First project pack:** Marine / Port construction (Gulf-of-Oman-side deepwater gateway port, Hormuz-aware supply chain).
**Audience:** Client executives (CXO/PMO) + their technical evaluators, who are comparing us against other vendors.

## 1. Goal
Win the evaluation. The client asked for a **general construction-management PoC reusable across projects**. We deliver that, and add the port-specific intelligence they will need on this project — which no competitor shows — so we are remembered.

Success = in a 20-minute demo the client says "none of the others showed us what happens *if*."

## 2. Principles
1. **Generic engine, specific skin.** Everything project-specific lives in a *Project Pack* (config + seed data + 3D scene). The port is pack #1; a second light pack proves reuse.
2. **Predict and prescribe, don't just monitor.** Every dashboard answers "so what / now what."
3. **Everything connects.** A change in one module (a late shipment, a crane fault, a holiday) ripples visibly through schedule → 3D → cost → procurement → risk.
4. **Honest mocks.** Simulated feeds carry a "SIMULATED" chip; README has a mock-vs-real table.
5. **Offline-first, projector-safe.** Double-click `run.bat`; no network needed.

## 3. Personas and the pain each one feels (mapped to the Mazzant deck)
| Persona | Pain (deck) | What they see first |
|---|---|---|
| **CXO / Port Authority exec** | No enterprise visibility; no early-decision data | Portfolio map + AI morning briefing + top risks |
| **Project Director / PMO** | Silos; manual reports | Schedule health, EVM, what-if sandbox, one-click report |
| **Procurement / Supply-chain manager** | Late materials unseen until site stops | Procurement control tower, route planner, stock cover |
| **Site / Construction manager** | Daily coordination, equipment downtime | 3D/4D twin, work-fronts, equipment fleet |
| **HSE officer** | Safety, no SOPs | HSE dashboard, CCTV analytics, permit-to-work, heat stress |
| **Asset / maintenance manager** | Breakdowns surprise the schedule | Fleet health, RUL, work orders |
| **Finance controller** | Budget visibility lag | Cost, cashflow, EAC, variations, IPCs |
| **Document controller / QA** | Drawing/RFI chaos, NCRs | Document control, RFI, submittals, inspections |

## 4. Functional requirements
Priority: **P0** = must be in the demo; **P1** = should; **P2** = nice-to-have / stretch.

### 4.1 Portfolio Command Centre (home)
- P0 Multi-site map (offline GeoJSON, no tile server) with site markers coloured by health; drill-down to site.
- P0 KPI strip: schedule (SPI), cost (CPI), safety (LTIFR, days since LTI), open risks, fleet availability, material-at-risk.
- P0 Role switcher (CXO / PM / Procurement / HSE / Asset / Finance) changes the home layout.
- P0 **AI Morning Briefing** card: auto-generated narrative from current sim state (templated NLG, labelled "rule-based").
- P1 Alarm & event feed (deck: Alarm & Event) with severity, acknowledge, SOP link.
- P1 Global command palette (Ctrl+K) searching sites, assets, POs, RFIs, documents.

### 4.2 3D / 4D Digital Twin (site view)
- P0 Interactive 3D port scene: sea, reclaimed land, quay wall, berths, yard, buildings, roads, laydown area, equipment.
- P0 **4D timeline scrubber**: scrub date → construction elements appear/progress by WBS (dredge cut, reclamation fill, caisson/pile segments, apron, yard paving, buildings, crane erection).
- P0 Click any element/equipment → side panel (status, WBS, schedule, cost, linked docs, sensors).
- P0 Colour modes: progress vs plan (green/amber/red), material availability, equipment health, HSE zones.
- P1 Layers: bathymetry heat-map (design vs actual depth), settlement sensors, tide/wave/wind, CCTV frustums, geofences.
- P1 Drone imagery: before/after swipe + orthomosaic overlay (generated images).
- P1 Moving equipment (trucks, barges, dredger, cranes) driven by the simulator.
- P2 Section/clipping plane through the quay wall; laser-scan point-cloud toggle.

### 4.3 Schedule & Planning
- P0 Gantt (baseline vs forecast "ghost bars", critical path highlighted, dependencies, today-line, calendar shading for holidays/Ramadan/midday-ban season).
- P0 Resource-loaded and WBS-linked: each activity links to materials (BOM), assets, crews, cost.
- P1 Look-ahead (3-week) board, constraints log, S-curve (planned/actual/forecast).
- P1 Schedule import placeholder (P6/XER, MS Project) — shows mapping UI, imports a bundled sample.
- P2 Monte Carlo P50/P80 finish distribution.

### 4.4 **What-If Studio** (headline differentiator — three scenario families + combined)
Common: scenario sandbox clones the live plan; user changes inputs; the **engine re-runs CPM** and returns Δfinish, Δcost, Δcritical path, affected 3D elements, and **ranked recovery options** with cost/benefit; scenario can be saved, compared side-by-side with baseline, and "committed" (demo only).

**A. Material & supply-chain delay**
- P0 Select material/PO → shift ETA (slider ± weeks) or set "route closed"; see affected activities, float consumed, new critical path, new end date, LD exposure, prolongation cost.
- P0 **Route planner:** origin → port of entry → site. Toggle **Hormuz: open / restricted / closed**. Routes: Jebel Ali direct; Khor Fakkan/Fujairah + bonded trucking (~2 h road); Oman (Sohar) / Saudi overland; air freight. Shows transit time, landed cost, risk. Distinguishes **domestic bulk** (rock, aggregate, cement, rebar — low exposure) from **imported long-lead** (fenders, crane rails, switchgear, HVAC, lifts, lighting masts, reefer sockets, port equipment).
- P0 Recovery options generated, e.g. re-source domestic, expedite by air, split shipment, resequence (move non-dependent work forward), add shift, buy-from-stock transfer.
- P1 Price shock: commodity/freight index slider (e.g. +20–25% imports) → budget impact.

**B. Calendar & workforce intelligence (holidays / Ramadan / heat / sea-state)**
- P0 Calendar engine with UAE public holidays (configurable list; Islamic dates flagged "expected, ±1 day, moon sighting"), **Ramadan reduced hours (−2 h/day private sector)**, **summer midday outdoor-work ban 12:30–15:00, 15 Jun–15 Sep** (with critical-work exemptions flag), Fridays, labour-leave surges around Eid.
- P0 Operator picks a period (e.g. "Eid al-Fitr week", "Ramadan", "Summer") → sees **productive hours, output loss %, activities pushed, finish-date change**, then compares mitigations (pre-Eid push, night shifts, crew staggering, overtime rules, equipment re-allocation) with cost.
- P0 Weather/marine downtime model for marine works (wave-height limit for dredging/barge ops, wind limit for crane lifts, shamal season) → workable-days forecast.
- P1 Heat-stress productivity curve; WBGT in HSE view.

**C. Equipment failure & asset health**
- P0 Select an asset (or let the demo script trigger a fault) → predicted failure window, **"if it fails" impact** (which activities stall, days lost, rental-replacement cost, mobilisation lead time) vs **"service now" cost**; recommended action; **one-click work order** that appears in the CMMS and on the Gantt as a constraint.
- P1 Fleet "what if we lose the dredger/crane for N days".

**D. Combined scenario** — P0 "Hormuz stress test": stack A+B+C; output a single before/after with the biggest drivers ranked (tornado chart).

### 4.5 Procurement & Supply Chain Control Tower
- P0 PO register with 7-stage pipeline: Ordered → In production → QA/inspection → Shipped → At port/customs → Bonded truck → On site. Status, ETA, need-by date, float, risk flag.
- P0 Shipment map (offline GeoJSON): vessels/trucks on Gulf, Gulf of Oman, UAE roads; Hormuz status overlay.
- P0 Stock & laydown: on-hand vs required, **days of cover**, stock-out forecast, reorder suggestions.
- P1 Supplier scorecards (on-time %, quality, price variance), RFQ comparison matrix, three-way match (PO–GRN–invoice).
- P1 **Logistics Gateway (SIMULATED):** adapter panel for port/free-zone/freight feeds (DP World/Jafza/SeaRates-style) — container status, gate-in/out, customs hold.
- P2 Customs/permits tracker; carbon per shipment.

### 4.6 Asset & Equipment Management (CMMS)
- P0 Registry of fleet (crawler/tower/mobile-harbour cranes, excavators, trucks, dredger, piling rigs, batching plant, tugs/barges, generators).
- P0 Health score, uptime, MTBF, MTTR, PM compliance (deck CMMS screen), utilisation, fuel, hours, location.
- P0 Telemetry detail: vibration, temperature, hydraulic pressure, oil debris, load cycles, tilt/wind for cranes — sparkline + anomaly flags.
- P0 Failure prediction + RUL + explanation (top contributing signals).
- P1 Work orders (kanban), spare-parts stock, calibration/inspection certificates (LOLER-style crane cert expiry).

### 4.7 Cost & Financials
- P0 Budget / committed / actual / forecast (EAC) by WBS and cost code (AED); **EVM** (PV, EV, AC, CPI, SPI, TCPI); S-curve; cashflow forecast.
- P0 **Scenario cost overlay:** every what-if shows Δ cost split into LDs, prolongation, expedite, price escalation, rental.
- P1 Variation orders / change requests with approval flow; IPC (interim payment certificates), retention, advance-payment recovery; contingency drawdown; contract/sub-contract register.
- P1 FX & commodity index panel (steel, freight) feeding escalation clauses.
- P2 ERP integration screen (deck: ERP) — mapping of cost codes to SAP/Oracle (mock connector).

### 4.8 Quality, Safety, Docs (the "quality-of-life" layer)
- P0 **HSE dashboard** (deck): manpower, manhours, LTIFR, severity, unsafe acts/conditions, observations, training hours; **heat-stress index**; incident/near-miss log.
- P0 **CCTV wall + video analytics** (generated/stock frames with detection boxes: person, crane, no-PPE, exclusion-zone breach) → auto work-order / SOP trigger (deck slide 14).
- P1 Permit-to-work (hot work, lifting, confined space, marine) with approval states.
- P1 Quality: ITPs, inspections, NCRs, snag/punch list; concrete cube results; pile test results.
- P1 Document control: drawing register, revisions, transmittals, RFIs, submittals, markup viewer (PDF/image placeholder).
- P1 Daily/weekly report **auto-generation → PDF export** (deck: manual reports pain).
- P1 Manpower histogram, access-control gate log, labour-camp occupancy.
- P2 Meeting minutes/action tracker; lessons-learned library.

### 4.9 Platform features
- P0 **EN / AR with full RTL**, dark/light, large-text projector mode.
- P0 **Project Packs**: switcher showing Port pack (full) and a second compact pack (e.g. Highway or High-rise) re-skinning WBS, KPIs, equipment types and 3D scene — demonstrates "reusable for other projects".
- P0 Simulator controls (demo clock): play/pause/speed, jump to "scenario checkpoints", reset. Hidden "presenter mode" panel with scripted scenario buttons.
- P1 RBAC mock (role-based menu/visibility), audit trail panel, notification centre, saved views.
- P1 Open-API/integration page (ERP, VMS, access control, drone, DP World-style logistics) with status chips — shows the deck's architecture.
- P2 Mobile/tablet responsive field view for site engineers.

## 5. Non-functional requirements
- Runs offline on a mid laptop (integrated GPU) at ≥ 45 fps in the 3D scene; first load < 5 s from `run.bat`.
- Projector-safe: ≥ 4.5:1 contrast; min 14 px body text at 1280×720; works at 1366×768, 1920×1080, 2560×1440.
- Deterministic simulation (seeded) so the demo is reproducible; "Reset" returns to the exact start.
- No console errors in demo paths; no external network calls (fonts, maps, CDN all bundled/local).
- Accessibility basics: keyboard nav, focus rings, `lang`/`dir` set on language switch.
- Security: no secrets, no client data; sample data fictional/illustrative.

## 6. Out of scope (explicit)
Real integrations (ERP, P6, DP World APIs, CCTV streams, IoT); real ML models; auth/multi-tenant backend; production database; real BIM/IFC authoring. These are **mocked** and listed in README with the real-world path for each.

## 7. Open questions (tracked in the final MCQ to the user)
Project identity (Mina Al Hamriya vs Fujairah vs composite), Arabic/RTL scope, 3D asset ambition, when to start the build.
