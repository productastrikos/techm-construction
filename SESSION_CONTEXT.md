# SESSION_CONTEXT - Mazzant Construction PoC

_Last updated: 2026-10-11 (client feedback round + deployment prep)_

## State
App is built and verified: all 11 pages + models page, EN/AR (RTL), dark/light, port pack + highway pack.
`tsc` clean, `vitest` 88/88, `scripts/flows.mjs` 18/18, `scripts/ai-tour.mjs` 18/18, production build OK.
Run: `run.bat` (port 5176, strictPort). README.md has the mock-vs-real table and the AI talk track. Audit write-up: `docs/06_AUDIT_AND_AI_LAYER.md`.


## 2026-10-11 session (read `docs/07_TWIN_VISUAL_OVERHAUL.md`)
- Twin scene rebuilt: heightfield terrain + mountains, new water shader, procedural textures, vegetation, access road + traffic, camp, stockpiles, fence, markings, wakes; 23 new Sketchfab models + Meshy batching plant; composite jack-up barge; `Scenery` places the models.
- Nav label is now "Digital Twin". Twin opens on a live-incident card pinned to the worst-health machine (CC-02 in the port pack) with AI insight + Create ticket / Act & Assign. AI panels bigger + violet. HSE opens on video analytics; Docs opens on Quality.
- Scripts added: `incident.mjs`, `cam.mjs`; `models.mjs` takes an id list; `perf.mjs` now actually reports (deterministic sampling).
- Chrome note: the reconnected Chrome profile was logged out of Meshy (Sketchfab fine); Meshy worked in the built-in browser. Never enter passwords; the user logs in.
- Meshy credits ~7. Barge jobs are Private -> not downloadable (see docs/07).

## Key facts / gotchas
- Project identity per the 2026-10-10 decision: **"Mina Al Hamriya Port"** (illustrative scope, quantities, dates; Gulf-of-Oman-side generic geometry). Brand: **S!aP Mazzant** by Astrikos AI. Public sources say Mina Al Hamriya is not the Hormuz-bypass project; the pack stays a configurable composite (`packs/port/config.ts`).
- **AI layer**: `src/features/ai/` (kit, intents, Copilot, summary) + per-page panels. Numbers come from the live engines; wording is scripted; no LLM. Labelled AI DEMO everywhere; keep it that way (workspace rule: say what is mocked).
- **S!a Excel-lence** URL lives in `src/lib/links.ts` (`SIA_URL`); Reports has the button + card + CSV export. External site, needs internet, never log in on the user's behalf.
- Asset flag threshold is `FLAG_HEALTH = 75` in `engine/assets.ts` (was 62; CC-02 must be visible from the data date for hero flow H3).
- `.num` class sets `display:inline-block`: never put it on table cells or grid/flex parents (use `tabular-nums`).
- 3D scene is pack-aware (`pack.config.sceneKind`); highway scene is schematic.
- Shell.tsx / some files use CRLF; edit with newline-preserving tools.
- Dev server: `npx vite --port 5176 --strictPort --host 127.0.0.1` in `app/`.
- Meshy credits left: about 7 (2026-10-11). Models are Meshopt-compressed.

## Verification scripts (app/scripts)
flows.mjs (hero flows), ai-tour.mjs (every AI moment), tabs-tour.mjs (screenshot all tabs), dead-buttons.mjs (controls that do nothing), pack-theme.mjs (highway + light), perf.mjs, shot.mjs.

## Known limits / next steps
1. Recorded 3-minute fallback video (`demo_video/`) not made yet (docs/03 fallback c).
2. Highway 3D scene is a strip road on sand (no terrain); CCTV/drone imagery are generated stills.
3. Full 1920x1080 and projector pass, and a final `demo-reviewer` pass after any further UI change.
4. `demo-package` skill (zip handover with offline check) not run yet.
5. If a real LLM is wanted: replace `features/ai/intents.ts` `answer()` with a call that is given the same snapshot/scenario results as context; the UI contract (steps -> text -> actions) stays.

## 2026-10-11 (later) - Tech Mahindra x Astrikos re-skin
- Theme now follows the TM "Retail Control Tower" look: warm off-white + white cards + near-black ink + TM red accent (light default), true-black + red (dark). Tokens in `app/src/index.css` (`--violet` is now TM maroon / rose; `--violet-ink` is text on it; `--logo-tile`, `--astrikos-filter` for dark-mode logos).
- Logos: `app/public/brand/` (tm-logo.png, tm-mark.png from the root TM files; astrikos-logo.png from `_reference_ui`). Sidebar = TM logo on top, "Powered by Astrikos" at the foot; favicon = TM mark.
- Sidebar: uppercase labels, red active state with start border. Card titles uppercase. Header AI button solid maroon (rose in dark).
- Default theme flipped to light (`store.ts`); stored preference still wins.

## 2026-10-11 (night) - client feedback round + deployment prep (read README "Client-feedback round")
- New: `features/ai/Advisory.tsx` (strip in Shell), `features/kpi/*` (Kpi tiles open `KpiPanel`; `PageKpis` adds a compact strip to Twin/Schedule/HSE/Docs/Reports; `forecast.ts` = deterministic 7/30-day outlook, NOT an engine forecast), `features/ai/ActionPanel.tsx` + `actionStore.ts` (alert explain -> ticket), `features/workorders/*` (page + `integrationStore` that talks to `server/` or falls back to a local simulator), `design/Drawer.tsx`, `lib/api.ts`.
- `woStore.create()` pushes every work order to the hub (also HSE CCTV work orders and the twin incident card). The hub is reset on every page load (`/api/reset`) so work-order ids never collide.
- `SimChip` renders nothing; "AI demo" tag is now "AI". Remaining honest disclosures: Admin > Integrations/mock tables, a few banners (procurement gateway, ERP, board briefing disclaimer).
- Backend `server/` (Node + ws, in-memory) - contract in `server/README.md`. Deployment: `DEPLOY.md`, `ecosystem.config.cjs`, `app/.env.production` (public URLs only - the one allowed .env exception, required by the deployment guide). Ports FE 3333 / BE 4333; URL techm-construction.astrikos.xyz.
- Dev server proxies `/api` and `/ws` to 4333 (vite.config.ts). `scripts/features.mjs` verifies the whole round (29/29).

## 2026-10-14 - reference UI round (read docs/08_REFERENCE_API_AND_AI_UX.md)
- Studied the Astrikos PDL reference (pdl.astrikos.xyz:8443, user's logged-in built-in browser tab "seed"): API host `pdl-api...:8443/api/v1` (`/kpi`, `/charts/<id>?tf=`, `/state/snapshot`); violet `#8b5cf6` AI; KPI "Details" drawer with tf filter + Forecast/Compare + AI advisory + Apply.
- Built: `Kpi` card footer (status + Details), `KpiPanel` rewrite + `forecast.ts` `buildSeries()` (API-shaped; `tests/kpi-series.test.ts`), `DroneCompare` date selector, violet AI tokens (`--violet-solid`), header Copilot + AI Advisory buttons, sign-in page deck + overview (`app/src/app/login/Deck.tsx`, `Overview.tsx`).
- Verified: tsc clean, vitest 95/95, features 29/29, flows 18/18, ai-tour 18/18, login.mjs 6/6, `login-tour.mjs`, `kpi-drone.mjs` (light + dark), Arabic RTL panel screenshot.
- Dev servers were started hidden for verification: vite 5176 and hub 4333.
- Demo clock is only ~75 days into a ~2.5 year programme, so short drone presets (30D/90D) compare nearly identical early frames; the default is Start -> finish (forecast).
- Open: no `/api/v1/kpi` on the hub yet (series is browser-side); KPI breakdown tabs; header is tight at 1366px (role select truncates).
