# 04 — Technical Stack & Architecture

Follows the workspace defaults in `../../CLAUDE.md` and the Windows/OneDrive rules in `../../.claude/rules/windows-onedrive.md`. Deviations are justified inline.
Versions: pin at scaffold time using Context7 / `npm view` — do **not** trust this doc for exact versions.

## 1. Stack

| Layer | Choice | Why / note |
|---|---|---|
| Build | **Vite** + **TypeScript** (strict) | Workspace default; fast; static output for `run.bat` |
| UI | **React 19** | Workspace default |
| 3D | **three** + **@react-three/fiber** (v9 for React 19) + **@react-three/drei** | Default; `drei` gives Html labels, controls, instancing, Environment |
| State | **zustand** (+ `immer` for scenario clones) | Default; tiny; works across R3F and DOM |
| Styling | **Tailwind CSS 4** + CSS variables design tokens; **logical properties** for RTL | Default; RTL-safe from day 1 |
| Charts | **Apache ECharts** (via `echarts-for-react` or thin wrapper) | Offline, dark theme, S-curve/heatmap/tornado/radar/sankey all native — one lib instead of three |
| Gantt | **Custom SVG/Canvas component** (d3-scale + d3-time) | Off-the-shelf Gantts can't render baseline-vs-forecast ghost bars + calendar shading + critical path well, and some have licence limits |
| Maps (offline) | **MapLibre GL JS** + **deck.gl**, **local GeoJSON only** (no tile server) — Natural-Earth/OSM-derived coastline for Gulf & UAE bundled in repo | CLAUDE.md map default; offline-safe because style has no remote sources |
| Tables | **TanStack Table** + **TanStack Virtual** | Large PO/activity tables |
| Routing | **React Router** (data router) | Simple |
| i18n | **i18next** + `react-i18next`; EN + AR; `dir` auto-switch; **IBM Plex Sans Arabic / Noto Sans Arabic + Inter** via `@fontsource` (self-hosted) | Offline fonts |
| Dates | **date-fns** (+ `date-fns-tz` Asia/Dubai) | Calendar engine |
| RNG | tiny seeded PRNG (mulberry32) | Deterministic demo |
| Sim runtime | **Web Worker** (via **Comlink**) running `sim-core` | See §3 — zero backend, still "a simulator process, not random numbers in components" |
| Optional backend (stretch) | **Fastify + ws** adapter that serves the same `sim-core` over WebSocket | Only if client asks for "real" streaming; behind the same `DataSource` interface |
| PDF | **jsPDF + autotable** (or print-CSS) | One-click board report |
| Icons | **lucide-react** | Light |
| Testing | **Vitest** (engines), **Playwright** (flows + screenshots) | `/demo-verify` uses it |
| 3D asset tooling | `npx @gltf-transform/cli` (Draco/Meshopt, resize textures ≤ 2048, dedup, prune) | CLAUDE.md: not installed globally; use npx; copy inputs to a short temp path (spaces/OneDrive) |
| Packaging | `run.bat` (ASCII only) serving `dist/` via a tiny static server (`vite preview` or `sirv-cli`) on **pinned port**; no Docker (no backend) | CLAUDE.md |

**Port:** pin **5176** (`strictPort: true`). Known taken: 5173 campus, 5174 datacenter, 5175 dso-map, 4300 WinCC, 3000 static. Re-check before use.

**Do not use:** Cesium (no true globe/3D tiles needed), Next.js (no SSR/API), any CDN-loaded asset, Mapbox tokens, any paid font/service.

## 2. Repository layout (proposed, pnpm workspace optional — keep single package if simpler)
```
Construction/
  CLAUDE.md  SESSION_CONTEXT.md  README.md  run.bat  CREDITS.md
  docs/                      <- these five documents
  app/                       <- Vite + React app
    src/
      app/                   <- shell, router, layout, role switcher, command palette
      design/                <- tokens, primitives (Card, Kpi, Chip, Table, Panel), charts theme
      i18n/                  <- en.json, ar.json
      packs/                 <- project packs (config + seed + scene)
        port/                <- pack.ts, wbs.ts, materials.ts, assets.ts, calendar.ts, scene/
        highway/             <- compact second pack
      engine/                <- PURE TS, no React (unit-tested)
        cpm.ts               <- forward/backward pass, float, critical path, calendars, lags
        calendar.ts          <- working-time calculus (holidays, Ramadan, midday ban, weather)
        productivity.ts      <- heat, wind, sea-state, fatigue/Eid-absence multipliers
        materials.ts         <- BOM -> need-by, supply pipeline, stock cover
        routes.ts            <- route graph + Hormuz state + landed cost/lead time
        scenario.ts          <- clone plan, apply deltas, run engines, diff, recover-options
        assets.ts            <- health score, RUL, failure probability, impact analysis
        evm.ts               <- PV/EV/AC/CPI/SPI/EAC/TCPI, cashflow
        briefing.ts          <- templated NLG for AI briefing
      sim/                   <- simulator core + worker entry + DataSource interface
      features/              <- one folder per module (portfolio, twin, schedule, whatif, procurement, assets, cost, hse, docs, reports, admin)
      three/                 <- scene components, 4D progress shader/materials, instancing
      assets/                <- models/ (optimised .glb), textures/, images/, geojson/
    public/
    vite.config.ts           <- strictPort 5176
  assets_src/                <- raw downloads & Meshy outputs (gitignored), + prompts/ used in ChatGPT
  demo_video/
```

## 3. Architecture

```
 ┌────────────────────────── Browser (single static app) ──────────────────────────┐
 │  React UI  ──(zustand stores)──►  DataSource interface  ◄──────────────┐         │
 │   │                                  │                                  │         │
 │   │  R3F scene (reads same stores)   ▼                                  │         │
 │   │                         ┌─────────────────┐  postMessage (Comlink)  │         │
 │   │                         │  Sim Worker      │◄────────────────────────┘         │
 │   │                         │  sim-core + engine/*                                │
 │   │                         │  seeded RNG, demo clock, scenario runner            │
 │   │                         └─────────────────┘                                   │
 │   └── What-If Studio: scenario.run(plan, deltas) in worker → diff → UI/3D/cost     │
 └───────────────────────────────────────────────────────────────────────────────────┘
        (optional later)  DataSource ◄──► Fastify+ws ◄──► same sim-core   [adapter swap, UI unchanged]
```

**Key decisions**
1. **Engines are pure TypeScript with no React/DOM** → unit-testable, reusable in worker, in Node, or on a server. This is the correctness story ("the numbers are computed, not painted").
2. **`DataSource` interface** (`subscribe(topic)`, `getSnapshot()`, `runScenario(spec)`, `control(clock)`) with two implementations: `WorkerDataSource` (default) and `WsDataSource` (stretch). The mock/real boundary is one file — matches the PoC rule.
3. **Demo clock:** sim time decoupled from wall time; speed 1×/60×/1 day/s; "now" defaults to a configured demo date; scripted checkpoints (`T-0`, `T-H1`, `T-H2`, `T-H3`) for the presenter.
4. **Scenario = immutable clone + deltas.** Baseline plan is never mutated; scenarios are `Plan + Delta[]` evaluated by the engine; results cached by hash; "commit" swaps the forecast layer only.
5. **Everything keyed by IDs** (`wbsId`, `activityId`, `materialId`, `poId`, `assetId`, `elementId`) so one click in 3D resolves to schedule, cost, docs, and sensors. 3D element names = `elementId` (see asset pipeline).

## 4. Core data model (TypeScript sketch)
```ts
type Id = string;
interface ProjectPack { id; name; locale; calendarId; wbs: WbsNode[]; activities: Activity[]; materials: Material[];
  boms: BomLine[]; pos: PurchaseOrder[]; suppliers: Supplier[]; routes: RouteGraph; assets: Asset[];
  costCodes: CostCode[]; kpis: KpiDef[]; scene: SceneDef; copy: Vocabulary }
interface Activity { id; wbsId; name; durationHrs; calendarId; preds: {id; type:'FS'|'SS'|'FF'|'SF'; lagHrs}[];
  constraints?: {mustStartOn?; finishNoLaterThan?}; crew?: CrewReq; assets?: Id[]; boms?: Id[]; cost: {budget; weight}; elementIds: Id[];
  weatherSensitivity?: 'none'|'wind'|'sea'|'heat'|'rain'; progressPct }
interface Material { id; name; class:'domestic-bulk'|'imported-long-lead'|'imported-standard'; unit; origin; leadTimeDays; exposure: 0..1 }
interface PurchaseOrder { id; materialId; supplierId; qty; valueAED; stage:0..6; etd; eta; needBy; routeId; incoterm; riskScore }
interface Route { id; legs: {from; to; mode:'sea'|'road'|'air'|'rail'; days; costPerUnit; hormuzDependent:boolean}[] }
interface Asset { id; type; name; model; hours; location; health; telemetry: Channel[]; linkedActivities: Id[]; pm: PmPlan; certExpiry }
interface Calendar { workWeek: number[]; shifts; holidays: Holiday[]; seasons: Season[] /* Ramadan, midday-ban */; weatherNormals }
interface Scenario { id; name; deltas: Delta[]; /* ShiftEta | SetHormuz | SetCalendar | FailAsset | ServiceAsset | AddShift | PriceShock */ }
interface ScenarioResult { finish; dFinishDays; criticalPath: Id[]; floatConsumed; costBreakdown; affectedElements: Id[]; recoveryOptions: RecoveryOption[] }
```

## 5. Engine specifications (so the numbers are defensible)

**CPM (`cpm.ts`)** — activity-on-node; FS/SS/FF/SF with lags; per-activity calendars (working-time calculus handles holidays, Ramadan hours, midday-ban windows, weekends); forward/backward pass; total/free float; critical path = float ≤ 0; supports constraints and "material not available until X" as a computed early-start constraint. Target: 300–500 activities re-computed < 50 ms.

**Calendar (`calendar.ts`)** — working hours per day = base (e.g. 10 h) minus: public holiday (0), Friday policy (config), Ramadan (−2 h/day, config), midday ban window overlapped with outdoor-work activities (−2.5 h, 15 Jun–15 Sep; flag for exempt activities like continuous concrete pours), weather/sea-state downtime sampled from monthly normals. Holiday list is data; Islamic dates carry `uncertaintyDays: ±1`. **Dates in the pack are expected/illustrative — flagged as such in the UI.**

**Productivity (`productivity.ts`)** — multiplicative factors: heat (WBGT curve), wind (crane lift limit, e.g. >~ 12 m/s stops lifts — configurable), sea state (Hs limit for barge/dredge ops; shamal season uplift), Eid-surge absenteeism (workforce %). All coefficients in config with a visible "assumptions" drawer.

**Materials & routes (`materials.ts`, `routes.ts`)** — each PO stage has duration distributions; need-by derived from linked activity ES minus handling buffer; slip = ETA − need-by; Hormuz state ∈ {open, restricted(+x days, +y %), closed} modifies legs with `hormuzDependent`; route selection computes lead time + landed cost; domestic bulk uses low exposure. Illustrative defaults from public figures: imports +20–25% cost under stress; bonded-truck leg ≈ 2 h; stock cover 2–6 months.

**Asset health (`assets.ts`)** — per-channel degradation models (exponential/Weibull-like drift + noise); health = weighted channel z-scores; **RUL** from trend extrapolation to threshold; **failure probability(t)** from a Weibull on remaining life; explanation = top-k channel contributions; impact = re-run CPM with asset unavailable for (downtime + mobilisation) vs planned-service window. Mocked "ML" — **label as rule-based/simulated**; keep seam for real model.

**EVM (`evm.ts`)** — PV from baseline S-curve, EV from progress × budget, AC from sim cost postings; CPI, SPI, EAC = BAC/CPI (and alt), TCPI; cashflow with payment terms and retention.

**Recovery options (`scenario.ts`)** — enumerate candidate mitigations per delta (re-route, expedite air, substitute material, resequence, add shift/crew, rent equipment), re-run CPM for each, rank by (days recovered per AED) and present top 3 with trade-offs.

**Briefing (`briefing.ts`)** — templated NLG over the live snapshot ("3 of 14 POs at risk; critical path now passes through quay-wall fendering; crane C-02 flagged…"). Labelled rule-based.

## 6. 3D scene design (R3F)
- **Procedural (code-built, animatable):** seabed + water plane (simple animated shader), reclaimed platform, quay wall as caisson/pile segments (instanced boxes), berths, apron paving, container yard (instanced boxes with texture atlas), buildings (gatehouse, admin, workshop, substation, reefer stack), roads, lighting masts, breakwater (instanced rocks), dredge channel (heightmap displacement).
- **4D progress:** each element has `elementId`; material shader uses `uProgressDate` + per-element `[startDate,endDate]` to reveal (clip/scale/dissolve); colour modes via uniform; selection via raycast → store.
- **Downloaded/generated GLB (hero equipment, ≈10–12):** STS gantry crane, mobile harbour / crawler crane, tower crane, dump truck, excavator, trailing-suction or cutter-suction dredger, bulk/container ship, tug, reach stacker, concrete mixer, piling rig, (optional) worker figure. Draco/Meshopt compressed; names normalised to asset IDs.
- **Performance budget:** < 1.5 M triangles visible; ≤ 40 MB GLB total; instancing for repeated items; LOD for equipment; shadows only from the key light; antialiasing via MSAA, no heavy postprocessing; adaptive DPR; "Quality: High/Balanced/Low" toggle.
- **WebGL safety:** context-loss handler, fallback to 2D plan view if WebGL fails (demo insurance).

## 7. Design system direction
Match the Mazzant product family (dark teal command-centre, thin-line cards, mint accent for "good", coral for "bad", amber warn) but refine: stronger type hierarchy, density toggle, consistent KPI tile + sparkline primitive, consistent SIMULATED chip. A light theme for printed/board reports. Reference UI for layout ideas: `../../_reference_ui` (React admin template; reuse patterns only, do not copy CRA stack). Use `frontend-design` skill guidance to avoid generic template look.

## 8. Quality gates
- `vitest` for all of `engine/*` (A5, A3).
- `playwright` flows for H1–H4 with screenshots at 1366×768 and 1920×1080 (EN + AR).
- `/demo-verify` after every slice; console-error budget = 0; external-host scan = none.
- Lighthouse not required; but bundle ≤ ~12 MB excl. GLB, lazy-load the 3D route.
