# 08 - Reference control tower: API shape and AI UX (observed 2026-10-14)

Source: the Astrikos "S!aP PDL Command Centre" demo (`pdl.astrikos.xyz:8443`), viewed in the user's logged-in browser pane. Read-only: page text, resource list, and GET requests the page itself makes. No credentials were typed or stored.

## How the reference is wired

- **Separate API host**: the SPA is served from `pdl.astrikos.xyz:8443`, data comes from `pdl-api.astrikos.xyz:8443/api/v1/*` (cookie session, `fetch` with credentials, no token in localStorage; only `astk_theme` is stored locally).
- **Calls seen**: `GET /session`, `/catalog` (static reference data: originators, channels, providers, status tones), `/state/snapshot` (live headline state), `GET /charts/<chartId>?tf=12H|24H|7D|30D&<filters>` per chart, `GET /kpi?label=&value=&ctx=` when a KPI card's *Details* is opened. The dashboard re-polls the chart endpoints on a timer; it also opens a WebSocket for the live activity feed.
- **Chart payload** (`/charts/*`, `/kpi`): `{ tf, filters, data: { type: "series", labels[], actual[], forecast[], lower[], upper[], previous[], nowIndex, stats: { last, fEnd, lo, hi, change, total, fTotal, direction, bandPct, horizon, endLabel } } }`. `actual` is `null` after `nowIndex`; `forecast`/`lower`/`upper` are `null` before it and start at the last actual value so the line joins up. `previous` is the prior period, aligned point by point.
- **KPI payload** adds `model: { fmtKey, dims[], goodUp, kind, split }` (how to format, which filters apply, whether up is good) so the UI can colour the change and show the right breakdown tabs.
- **Time frame is a query parameter** (`tf`), filters are query parameters too. The UI never computes the forecast.

## AI UX pattern worth copying

- Colour: violet-500 `#8b5cf6` fill / violet-600 `#7c3aed` border, white text, soft violet glow. Dark UI (`#0a0a0a` page, `#1c1c1c` panels).
- Header: two violet buttons, *S!a Copilot* (outline, chat) and *AI Advisory* (solid, recommended actions).
- Page opens with an **AI Advisory strip**: 4-5 one-line facts with status dots and *See actions*.
- **KPI card** = delta chip (top), big value, label, sub-line, then a footer with a status word (ON TRACK / WITHIN TOLERANCE / NORMAL / TO REVIEW) and a **Details >** link. Nothing is clickable-by-surprise.
- **KPI Details drawer**: big value + delta + status, `12H/24H/7D/30D` segmented filter, dimension dropdowns, **Forecast** and **Compare previous** checkboxes, *Trend & prediction* chart (actual, dotted previous, dashed forecast with 95% band, NOW marker), three stat tiles (forecast value, +-range, vs previous), a *Breakdown* chart, then **AI Advisory** (one bold sentence, *Drivers*, *Recommended actions* each with an **Apply** button) and a *Definition* line.

## What this PoC mirrors (2026-10-14)

| Reference | Here |
|---|---|
| violet AI colour | `--violet` / `--violet-solid` tokens in `index.css` (light `#6d28d9` / `#7c3aed`, dark `#a78bfa` / `#8b5cf6`); TM red stays the brand accent |
| two header AI buttons | `Copilot` (outline) + `AI Advisory` (solid, opens the recommended-actions panel) in `Shell.tsx` |
| KPI card status + Details link | `design/ui.tsx` `Kpi`: status word + violet *Details >* on every tile (compact tiles get the link inline) |
| KPI drawer | `features/kpi/KpiPanel.tsx`: **7D / 14D / 30D / 90D** window (history = outlook = N days), **Forecast** and **Compare previous** toggles, AI **Forecast** button that replays the reasoning steps, forecast / +-range / vs-today tiles, drivers, recommended actions with **Apply** (creates a work order and routes it through the integration hub), definition line |
| `/kpi` series payload | `features/kpi/forecast.ts` `buildSeries()` returns the same field names (`labels, actual, forecast, lower, upper, previous, nowIndex, stats`) |
| drone / imagery filter | `features/portfolio/DroneCompare.tsx`: 30D / 90D / 180D / since-start / start-to-finish presets, two flight-date dropdowns, clickable flight timeline, % complete per flight from the S-curve engine |
| onboarding | sign-in page now has a 7-slide deck and a *KPI & UX overview* tab (`app/login/`) |

## Not copied (and why)

- **A real `/api/v1/kpi` on the hub.** The series is computed in the browser (deterministic, offline-safe). To move it server-side: serve `buildSeries(spec, tf)` from `server/` at `GET /api/v1/kpi?label=&value=&tf=` and have `KpiPanel` call it with the local builder as fallback, exactly like `integrationStore` already does for tickets. The response shape already matches.
- **Live polling / WebSocket feed** for charts (the hub only streams ticket updates).
- **Breakdown tabs** (by channel / state / originator): there is no equivalent dimension data in the simulator yet.
- **Play tour**: the Portfolio page's *Watch the AI at work* is the equivalent.

## Honesty note

KPI forecasts are a deterministic trend + confidence band seeded from each KPI's current value and tone. They are **not** produced by the schedule or cost engines. The README mock-vs-real table says so; keep the slide *What is real and what is simulated* in sync if that changes.
