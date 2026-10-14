# S!aP Mazzant - Construction PoC (Astrikos AI)

Front-end-complete demo of a construction-management + digital-twin platform, first project pack "Mina Al Hamriya Port"
(illustrative scope, quantities and dates) plus a second "E611 highway" pack to show the same engine on a new project.

## Run it
Double-click `run.bat` (Windows, Node 20+). It starts the integration hub (`server/`, port 4333) and Vite on **http://127.0.0.1:5176** and opens the browser. The demo works fully even if the hub is not running (it falls back to a built-in local simulator).
First run needs internet for `npm install`; after that the demo runs offline, except the S!a Excel-lence link.

Useful keys: `Ctrl+J` AI Copilot, `Ctrl+K` search, `Ctrl+Shift+P` presenter panel (checkpoints, hero-flow replays, Play AI demo, reset).

## What is real vs mocked
| Area | In this PoC | In production |
|---|---|---|
| Project data, telemetry | Seeded deterministic simulator in the browser | ERP, scheduler, IoT, CCTV, drone feeds |
| Schedule / what-if | **Real** CPM + scenario engine (unit tested, 88 tests) | Same engine, live inputs |
| Equipment prediction | Rule-based degradation model on simulated telemetry | Trained models on real telemetry |
| CCTV | Generated stills with scripted detections | Video analytics on real streams |
| Logistics | Simulated adapter, no operator connection | Port / free-zone / freight APIs |
| **AI Copilot and AI panels** | **Numbers are computed live by the engines; wording and animation are scripted. No language model is connected** | LLM grounded on project data with audit trail |
| **S!a Excel-lence** | Link-out to the separate hosted demo (internet needed) + CSV export. Not embedded | Embedded with SSO and live data connection |
| **Sign-in** | Client-side demo gate (`app/src/app/auth.ts`); one demo account, credentials ship in the bundle, override with `VITE_DEMO_USER` / `VITE_DEMO_PASS` at build time. Not real security | SSO (OIDC / SAML) with server-side sessions |

The on-screen SIMULATED / AI DEMO labels were removed for the client presentation; this table (and *Integrations > Mock vs real*) is where the mock-vs-real split is documented. The ticketing integrations (ServiceNow, Jira, Maximo, SAP PM, Teams) are simulated by `server/` - no real calls are made.

## Client-feedback round (Oct 2026)
- **AI Advisory strip** under the header on every page (page-specific, numbers from the live engines) with *See actions*.
- **Every KPI tile opens a right-hand panel**: value, 7-day and 30-day prediction charts with a confidence band, drivers and a recommended action. The old tile navigation is the panel's *Open full page* button.
- **Dashboard alert scenario**: click an alert in *Alarms and events* -> the AI analyses it -> *what happened / why / what to do next* -> *Create ticket* -> the ticket is pushed to the right external tool by department -> *View in Work Orders* shows it with live status.
- **Work Orders** (new sidebar page): board, tickets synced with external tools (live status), and an **Integrations** tab (connectors, department routing, webhook details, test / sync / connect, sync log).
- Command-centre "Good morning" hero hidden; *Watch the AI at work* stays.
- Deployment: see `DEPLOY.md` (frontend 3333, backend 4333, `techm-construction.astrikos.xyz`). Hub API: `server/README.md`.

## Reference-UI round (Oct 14 2026) - read `docs/08_REFERENCE_API_AND_AI_UX.md`
- **KPI cards say they are clickable**: status word (On track / Watch / At risk) and a violet *Details >* link on every tile.
- **KPI panel**: day filter **7D / 14D / 30D / 90D**, **Forecast** and **Compare previous** toggles, an AI **Forecast** button (replays the reasoning steps), forecast / range / vs-today tiles, drivers, recommended actions with **Apply** (raises a work order through the hub). Forecasts are deterministic trend + band, not engine output.
- **Drone imagery** (Portfolio): 30D / 90D / 180D / since-start / start-to-finish presets, two flight-date dropdowns and a clickable flight timeline; % complete per flight comes from the schedule engine, the stills are illustrations.
- **AI is violet** again (brand stays Tech Mahindra red); header has *Copilot* and *AI Advisory* buttons.
- **Sign-in page**: 7-slide deck about the PoC plus a *KPI & UX overview* tab (card anatomy, KPI catalogue with live day filter / forecast preview, UI conventions, suggested demo path). Verify with `node scripts/login-tour.mjs` and `node scripts/kpi-drone.mjs`.

## AI moments to show (about 4 minutes)
1. **Home** - the morning briefing writes itself (reasoning steps, then typed text). Press *Watch the AI at work* (or `Ctrl+J` > Play AI demo): the Copilot asks itself three questions and answers them from the live engines (biggest risk, 12-month Hormuz closure, which crane will fail).
2. **Procurement** - *Run AI scan*: rows light up one by one, then three findings each with a concrete re-route recommendation.
3. **Fleet & Assets > CC-02** - *AI diagnosis*: reasoning trace, failure-probability curve draws itself, typed explanation and the cost of failing vs servicing.
4. **Digital Twin** - opens on the **live incident** (crane CC-02 at the casting yard): a card pinned to the machine shows what happened, the AI insight and *Create ticket* / *Act & Assign* (ticket appears in Fleet & Assets > Work orders). Then *AI site scan*: sweep over the 3D scene, elements behind plan with likely cause. Timeline shortcuts (*Quay wall done*, *STS cranes up*, *Handover*) show the finished port.
5. **HSE** - first tab *Site safety & video analytics* (the PPT's live-video -> work-order flow) has the AI vision sweep; *Show SOP* types the SOP; Incidents has *AI root cause*.
6. **Documents** - *AI drawing review* drops findings onto the drawing; RFI *Draft reply* writes a response.
7. **Integrations > How AI helps** - animated Sense / Understand / Recommend / Act pipeline, each card links to the matching demo screen; illustrative team-impact targets (clearly not measured).
8. **Reports** - *Generate with AI* executive summary, then **S!a Excel-lence** (button top right + card) and *Download data (CSV)* for analysis in S!a.

Scene and asset notes for the twin (what was added, credits, Meshy pitfalls): `docs/07_TWIN_VISUAL_OVERHAUL.md`; every third-party model is listed in `CREDITS.md`.

Hero flows (H1 Hormuz, H2 Ramadan/summer, H3 crane failure, H4 stress test) are unchanged and covered by `node scripts/flows.mjs`.

## Verify (developers)
```
cd app
npx tsc --noEmit                 # types
npx vitest run                   # 95 unit tests
node scripts/flows.mjs 1440x900  # hero flows H1-H4 (18 checks)
node scripts/ai-tour.mjs 1440x900 en   # every AI moment, button to result (18 checks)
node scripts/tabs-tour.mjs 1366x768 en dark   # screenshot every tab -> app/.verify/tabs
node scripts/dead-buttons.mjs en # click every control, list the ones that change nothing
node scripts/pack-theme.mjs      # highway pack + light theme smoke
node scripts/login-tour.mjs      # sign-in deck + KPI & UX overview tab + mobile
node scripts/kpi-drone.mjs light # KPI Details affordance/panel (day filter, forecast, Apply) + drone date selector
node scripts/features.mjs light  # client-feedback round: advisory, KPI panels on every page, alert -> ticket -> Work Orders (29 checks; needs server/ running for the live-hub path)
cd ../server && npm test         # integration hub API (11 tests)
```
Assets and licences: see `CREDITS.md`. Plans: `docs/`. Session notes: `SESSION_CONTEXT.md`.
