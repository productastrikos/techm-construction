# 05 — Implementation Plan, Asset Pipeline & Sub-Agent Brief

Execution model (per the user): **I (main session) do research and documents. ONE sub-agent does all coding and asset sourcing.** To keep it to one agent, drive it phase-by-phase with `SendMessage` to the same agent rather than spawning new ones. The agent keeps `SESSION_CONTEXT.md` current so a context reset never loses state.

## 1. Phases (thin vertical slices — each ends with `/demo-verify`)

| Phase | Slice | Deliverables | Exit gate |
|---|---|---|---|
| **P0** | Foundation | Scaffold in `app/` (see 04 §2), `--prefix "$PWD"` on every npm install and verify `ls node_modules/<pkg>`; Tailwind 4 tokens; layout shell (sidebar, header, role switcher, language/theme toggles, SIMULATED chip); i18n EN/AR + RTL; routes stubbed; port 5176 strict | App opens, EN↔AR flips layout, 0 console errors |
| **P1** | Assets (parallelisable with P2) | Sketchfab/ChatGPT/Meshy sourcing per §3; optimised GLBs in `app/src/assets/models`; `CREDITS.md`; generated images (drone, CCTV frames, supplier logos-as-initials, hero banner) | All hero models load in a test scene; payload ≤ 40 MB; credits file complete. **Never blocks:** use procedural placeholder if an asset fails. |
| **P2** | Engines + sim | `engine/*` + unit tests; port pack seed (WBS ≈ 300 activities, ~40 materials, ~30 POs, ~25 assets, calendars, routes); Worker `DataSource`; demo clock; deterministic seed | `vitest` green; CPM/calendar/EVM tests match hand-computed cases |
| **P3** | Twin | R3F port scene (procedural civil + GLB equipment), 4D scrubber, selection panel, colour modes, equipment motion | 45 fps check; 4D reveals match schedule dates; click→panel works |
| **P4** | Schedule | Gantt with ghost bars, critical path, calendar shading, S-curve, look-ahead | Baseline vs forecast visible; matches engine output |
| **P5** | What-If A (H1) | Route planner + Hormuz toggle + PO pipeline + scenario compare + recovery options + 3D/Gantt/cost ripple | **H1 end-to-end in ≤ 6 clicks** |
| **P6** | What-If B (H2) | Calendar view, holiday/Ramadan/midday/weather overlays, productive-hours heatmap, mitigation compare | **H2 end-to-end**, numbers reconcile to tests |
| **P7** | Assets + What-If C (H3) | Fleet registry, telemetry sparkline, health/RUL/failure prob + explanation, impact, work-order kanban, Gantt link | **H3 end-to-end** |
| **P8** | Remaining modules | Procurement tower extras (stock cover, supplier scorecard, simulated Logistics Gateway), Cost/EVM/cashflow/VOs/IPCs, HSE + CCTV wall w/ detection overlays, docs/RFI/NCR lite, auto-report PDF, combined stress-test + tornado | All P0 in PRD ticked; P1 as time allows |
| **P9** | Portfolio + polish | Portfolio map + role-based home + AI briefing + command palette; Highway/High-rise pack #2; Arabic QA; empty/error states; animation polish | `demo-reviewer` pass; A1–A10 in doc 03 met |
| **P10** | Package | `run.bat`, README (mock-vs-real table), talk track, recorded fallback video, offline test, zip | `poc-qa` agent clean run from a fresh folder |

Rough effort: P0–P4 core platform ≈ 40 %; P5–P7 hero flows ≈ 35 %; P8–P10 ≈ 25 %. Don't polish P8 before H1–H3 are green.

## 2. Mock-data plan (seed values are **illustrative**, label them so)

**Project pack: Port (composite).** Config: name, location (Gulf of Oman coast), project code, start `2026-11-01`, baseline finish ~`2029-04` (≈ 30 months — consistent with the public 24–30-month range for DP World's Fujairah terminals), demo "now" ≈ `2027-01-15` (so there is progress to show and Ramadan 2027 / Eid / summer 2027 ahead of us).
- **Phases/WBS (≈ 7 level-1):** Mobilisation & enabling → Dredging & reclamation → Marine structures (quay wall: caisson/pile + rock revetment + breakwater) → Pavements & yard → Buildings & utilities (gatehouse, admin, workshop, substation, reefer) → Port equipment (STS/MHC cranes, RTG/reach stackers, fenders, bollards, lighting) → Commissioning & handover.
- **Materials (≈ 40):** *domestic bulk* — rock armour, aggregate, cement/concrete, rebar, sheet piles (mixed), asphalt, sand fill; *imported long-lead* — STS/MHC cranes, fenders, crane rails, MV/LV switchgear & transformers, HVAC chillers, lifts, lighting masts/LED, reefer sockets, nav aids, CCTV/PIDS, bollards; *imported standard* — pipes, cables, geotextile, precast.
- **POs (≈ 30)** spread across the 7 stages; 4–5 deliberately exposed to Hormuz (sea legs via Jebel Ali) so H1 has teeth; origin mix (China, India, Turkey, Europe, UAE-local).
- **Routes:** origin → {Jebel Ali, Khor Fakkan, Fujairah, Sohar (Oman), Dammam (KSA)} → site; legs with mode/days/cost; Hormuz-dependent flags.
- **Fleet (≈ 25):** crawler cranes ×2, mobile harbour crane ×1, tower cranes ×2, excavators ×4, dump trucks ×6, dredger ×1, piling rigs ×2, batching plant ×1, concrete mixers ×3, tug ×1, barges ×2, generators ×2. One seeded degrading channel on crawler crane CC-02 (hoist gearbox bearing) so H3 triggers at the demo checkpoint.
- **Telemetry:** 1 Hz internally, downsampled to UI; diurnal temperature, load cycles correlated with active activities; faults injected on a script, not randomly in components.
- **Holidays 2027 (expected, ±1 day — verify before any client-facing claim):** New Year 1 Jan; Ramadan ≈ 8 Feb–9 Mar; Eid al-Fitr ≈ 9–12 Mar; Arafat/Eid al-Adha ≈ 15–19 May; Islamic New Year ≈ 6 Jun; Prophet's Birthday ≈ 14–15 Aug; Commemoration Day 30 Nov / National Day 2–3 Dec. Midday ban 15 Jun–15 Sep (12:30–15:00). All editable in the pack.
- **Finance:** BAC ≈ AED 2.0–2.5 bn illustrative (config), contingency 7 %, retention 10 %, advance 10 %, monthly IPCs.

## 3. Asset pipeline (user's standing workflow — this is **mandatory** for the coding agent)

Use the user's **logged-in Chrome** through `mcp__claude-in-chrome__*` (load via ToolSearch first; one batched ToolSearch call). Not the built-in browser. Sites are already logged in: Sketchfab, ChatGPT (image gen), Meshy.

### 3.1 3D models
1. **Sketchfab first.** Filters: **Downloadable + Free** (+ license CC0/CC-BY). Search is poor — scroll and eyeball many results; judge by silhouette, poly count (< ~150k, prefer < 50k), textured, not watermarked, correct scale/axes. Download **glTF/GLB**. Record author / licence / URL / title in `CREDITS.md`.
2. **If nothing good:** generate **one single-object reference image in ChatGPT** (prompt template in 3.3) → **Meshy → Image to 3D** → upload → set model **Meshy 6 Lite** (the only tier whose output is downloadable on the free plan) → generate → **apply texture** (adds colour) → download **.glb**. Free credits are small (~30 per textured asset) → **retry at most once per object**, and prioritise (see list). Record "generated with Meshy + ChatGPT image" in `CREDITS.md`.
3. **Compress** every GLB with `npx @gltf-transform/cli` (copy to a short temp path first — spaces/OneDrive break it): `dedup`, `prune`, `resize --width 2048 --height 2048`, `meshopt` or `draco`; target each < 3 MB (hero cranes ≤ 5 MB). Use the `glb-optimize` skill / `asset-pipeline` guidance.
4. **Name nodes** to stable asset IDs (`CC-02`, `STS-01`, `DRG-01`…) so telemetry binds to them.

**Priority list (do in this order; stop when budget/time says so):**
| # | Model | Sketchfab search terms | Notes |
|---|---|---|---|
| 1 | Ship-to-shore (STS) gantry crane | "ship to shore crane", "container gantry crane" | Hero object of any port scene |
| 2 | Crawler / mobile harbour crane | "crawler crane", "mobile harbour crane", "liebherr crane" | H3 subject (CC-02) |
| 3 | Container vessel | "container ship", "cargo ship low poly" | Berth + shipment map |
| 4 | Dredger (TSHD or cutter suction) | "dredger", "trailing suction hopper dredger" | Marine works |
| 5 | Dump truck (off-road) | "dump truck", "articulated dump truck" | Instanced for fleet |
| 6 | Excavator | "excavator" | |
| 7 | Tower crane | "tower crane" | Buildings phase |
| 8 | Tug boat | "tugboat" | |
| 9 | Reach stacker | "reach stacker" | Yard |
| 10 | Concrete mixer truck | "concrete mixer truck" | |
| 11 | Piling rig | "piling rig", "drilling rig crawler" | |
| 12 | Worker w/ hard hat (optional) | "construction worker low poly" | |

Containers, quay wall, buildings, breakwater rock, roads, lighting masts: **procedural in code** (no downloads).

### 3.2 Images (ChatGPT image generation, in the logged-in browser)
Generate, save to `app/src/assets/images/`, record in `CREDITS.md` as "AI-generated":
- **Drone imagery:** 2 matching frames of the same port site — "before" (reclamation only) and "after" (quay wall + yard) — top-down/oblique, Gulf coastline, photoreal. Ask for identical camera angle.
- **CCTV frames (4–6):** site gate, quay edge with crane, laydown yard, batching plant; daytime + one night; no readable text/real logos/faces. Detection boxes are drawn by the UI, not baked in.
- **Hero/background:** subtle dark port-at-dusk panorama for login/portfolio banner.
- **Project-pack #2 thumbnails** (highway / high-rise).
- Rules: no real brand logos or real people; no DP World logos (we are not DP World); generic marks only.

### 3.3 Prompt templates
- **Single-object (for Meshy):** *"A single [OBJECT], full object visible, three-quarter front view, centred, plain white background, soft even studio lighting, no shadows on the background, no people, no text, photorealistic, clean silhouette."*
- **Drone:** *"Aerial drone photo of a new deepwater container port under construction on the Gulf of Oman coast, [reclaimed platform with sheet-pile/caisson quay wall | with completed quay wall, paved container yard, two gantry cranes], desert coastline, clear day, 45-degree oblique angle, same camera position, photoreal, no text."*
- **CCTV:** *"Low-resolution security-camera still of [scene] at a coastal construction site, wide-angle lens, slight noise, daytime, no readable text, no faces."*

## 4. Definition of done for the whole build
1. Every PRD **P0** item works; H1–H4 run end-to-end (doc 03 acceptance A1–A10).
2. `vitest` green; `playwright` flows green; `/demo-verify` screenshots reviewed by a human-readable summary (agent must *look* at them).
3. `run.bat` works from a fresh copy on a machine with no network.
4. README has the **mock-vs-real table** and the talk track; `CREDITS.md` complete.
5. `SESSION_CONTEXT.md` current.

## 5. The sub-agent brief (copy this verbatim into the `Agent` call when the user says go)

> **Role:** Build the Astrikos "Mazzant Construction" PoC in `C:\Users\parth\OneDrive\Desktop\Astrikos AI\Construction\app`. You are the **only** coding agent: do all coding, asset sourcing, testing, packaging.
> **Read first (in order):** `Construction/docs/05_IMPLEMENTATION_PLAN.md`, `04_TECH_STACK_AND_ARCHITECTURE.md`, `02_PRD.md`, `03_MVP_SCOPE_AND_DEMO_SCRIPT.md`, `01_RESEARCH_AND_COMPETITIVE.md`; then `../CLAUDE.md` and `../.claude/rules/windows-onedrive.md`.
> **Rules:** follow workspace CLAUDE.md. Every `npm install` uses `--prefix "$PWD"` and is verified with `ls node_modules/<pkg>`. Never touch/print `.env`/keys. Pin dev port 5176 `strictPort`. `.bat` files ASCII-only. No remote assets at runtime (fonts/maps/CDN). Use Context7 for library API questions (React 19, R3F v9, Tailwind 4, Vite, deck.gl, MapLibre, ECharts, i18next).
> **Assets:** follow doc 05 §3 exactly (Sketchfab → ChatGPT image → Meshy 6 Lite + texture; use `mcp__claude-in-chrome__*`; load tools with one batched ToolSearch). Max one Meshy retry per object. Always keep a procedural fallback so a missing model never blocks. Fill `CREDITS.md`.
> **Order:** phases P0→P10 in doc 05 §1. After each phase: run unit tests, run `/demo-verify`-style capture (Playwright screenshots at 1366×768 and 1920×1080, EN and AR where relevant), **open and look at the screenshots**, fix, then update `SESSION_CONTEXT.md` (paths, gotchas, done, next step). Do not start P8 polish until H1, H2, H3 pass.
> **Honesty:** every simulated source carries a SIMULATED chip; all quantities/dates are illustrative; holiday dates are "expected ±1 day". Never claim real DP World integration or live client data.
> **Report back** at the end of each phase in ≤ 15 lines: what works (with proof: test output / screenshot paths), what is mocked, what is blocked, next phase.

## 6. After the build — my (main session) follow-ups
- Review screenshots / run `demo-reviewer` agent on the running app.
- Draft the client-facing talk track slide(s) (pptx skill) if the user wants a deck.
- Re-verify holiday dates and the Mina Al Hamriya/Fujairah facts before any client meeting.

## 7. Risks specific to the build
| Risk | Response |
|---|---|
| One agent, long task, context resets | Phase gating + `SESSION_CONTEXT.md` + continue via `SendMessage` to the same agent |
| OneDrive sync lag with `node_modules` | Recommend moving to `C:\dev\mazzant-construction` for the build; copy back for packaging (decision in user MCQ if needed) |
| Meshy free credits exhausted | Sketchfab-first, 1 retry cap, procedural fallback |
| 3D performance on demo laptop | Budget in doc 04 §6, quality toggle, 2D fallback |
| Scope creep into P2 | P0 gate, P1 after H1–H3 green |
