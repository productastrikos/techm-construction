# 01 — Research & Competitive Analysis

Status: research complete, 2026-10-10. Everything marked **[V]** was found in a published source (listed at the end).
**[A]** = assumption / not verified. **[M]** = will be mocked in the demo.

## 1. What Astrikos already sells (from the boss's deck)

Source: `Construction Management_Mazzant.pptx` — "S!aP µAZZANT — Remote Construction Site Monitoring & Management (RCSM)".

| Deck element | What it implies for the PoC |
|---|---|
| 5 headline features: CCTV site surveillance, 3D spatial engineering mgmt, integrated project portfolio mgmt, ERP integration, drone imagery | These five are **table stakes** — every one must be visibly present. |
| Architecture: ERP (Finance, Budget, HR) ← Construction Monitoring Centre (CMC) → Site-1…Site-n. Modules: Performance Mgmt/Reports, Work-Task Mgmt/SOP, Engineering & Design, Remote Monitoring, Alarm & Event, Analytics | The app is a **multi-site command centre**, not a single-project tool. Home = portfolio, drill-down = site. |
| Data layer: Digital Asset Information Mgmt, As-built Engineering Data Repository, 3D/2D gateways, Access Control, PIDS, VMS, Video Analytics, Laser scan, Drawings | Show gateways as "connected systems" with live/mock status. |
| Product screens: dark teal "command-centre" UI; Inventory Store dashboard (turnover, stock-out, fill rate); CMMS dashboard (uptime, MTBF, MTTR, PM compliance, equipment health radar); HSE dashboard (manpower, manhours, LTIFR, unsafe acts, training hours); CCTV with person/crane detection boxes → work-order generation; drone orthomosaic | **Reuse this visual language** so the PoC looks like the existing product family, then go far beyond it. |
| Pain points the deck claims: no CXO visibility, no emergency SOP, silos, no analytics for early decisions, safety, no central data repo, manual daily/weekly/monthly reports, carbon footprint | Each pain point must map to one demo moment (see PRD §3). |
| Benefits: enterprise visibility, productivity, collaboration, safer ops, efficient handling, reduced carbon | Use as the closing slide of the demo talk track. |
| Industries: Oil & Gas, Public Infra, Real Estate, Energy, Mfg; utilisation: energy, bridges/highways, campus, mining, rail/airport | Supports the **"project pack"** reusability story (one engine, many project types). |

**Gap in the deck:** it shows *monitoring* (what is happening). It shows nothing *predictive or prescriptive* (what will happen / what should we do). That gap is exactly where the PoC wins against rivals.

## 2. The client's project — what the public record says

The user's brief: a new port "Al Mehra / Mina Al Hamriya", built to divert traffic away from the Strait of Hormuz.

**Important discrepancy — needs the user's decision (see open question Q1).** Public sources describe two *separate* DP World projects:

### 2a. Mina Al Hamriya (Deira, Dubai — Arabian Gulf side) [V]
- Existing port: 14 berths, 3,140 m of quay after a 1,150 m extension (project launched 2022, announced complete May 2024); dredged to 8.5 m draft; 403,400 m² storage; 86,000 m² apron; fishing harbour for 156 boats; "NAU by DP World" digital dhow-entry system since 2020.
- 2023: 4,300+ ship calls, 1.6 Mt cargo. H1 2025: 2,700 vessel calls (+11%), ~AED 9.07 bn trade.
- **22 Jul 2025: Sheikh Mohammed bin Rashid approved a further expansion — a new 700 m quay with 12 m draft** for larger vessels; total storage to ~6.4 M sq ft (from 3.4 M).
- Cargo: breakbulk, steel vessels, RoRo, containers, dhows; perishables and **livestock**; framed as **food security**. No source ties it to Hormuz. No completion date published.

### 2b. Fujairah east-coast terminals (Gulf of Oman side — the actual "Hormuz bypass") [V]
- Context: after the Hormuz closure/Iran war, Jebel Ali volumes reportedly fell ~90–95% (single-source figure — quote carefully). Traffic diverted to Fujairah / Khor Fakkan, which lack spare capacity (Khor Fakkan ≈ ¼ of Jebel Ali's container capacity).
- **22 Jul 2026: DP World agreement in principle with Fujairah Ports Authority, 50-year concession, two new terminals:**
  - **Al Rugaylat** — container + multipurpose, up to 2.5 M TEU/yr, 1.7 Mt general cargo, 190,000 CEU, deepwater.
  - **Dibba** — general cargo, up to 3.6 Mt/yr.
  - Phased construction, **24–30 months** from start; no start date published. Lifts DP World UAE capacity 19.4 M → ~22 M TEU.
- Land bridge today: bonded trucking Khor Fakkan/Fujairah → Jebel Ali ≈ 156–166 km, ~2 h by road (E611).
- Etihad Rail–AD Ports Fujairah–ICAD freight link launched 20 Sep 2026 (serves *existing* Fujairah Terminals; no source says the new terminals connect to it).

### 2c. How the PoC handles this
The PoC is a **configurable "project pack"**. The port pack is seeded with a **composite, clearly-labelled-illustrative** project: a new Gulf-of-Oman-side gateway port with a 700 m-class deepwater quay phase, reclamation, dredging, container + general-cargo yard, and a Hormuz-aware supply chain. Name, coordinates, quantities and dates are config values, so we can retitle to whatever the client calls it in one file. **No claim of live data from the client.**

## 3. Supply-chain reality in the Gulf right now [V]
- Moody's (via Khaleej Times, Jul 2026): imported material costs ≈ **+20–25%** vs pre-conflict; contractors, not developers, absorbing it so far.
- **Core materials (concrete, steel, aluminium, ceramics) are largely domestic and little disrupted. The exposed items are: lifts, A/C equipment, MEP components, lighting, joinery, natural stone, furnishings.** For a port this maps to: port handling equipment, fenders, electrical switchgear/substations, HVAC for buildings, lighting masts, reefer sockets, crane rails — i.e. **imported, long-lead, Hormuz-sensitive.**
- Effects: longer lead times, shorter quote validity, surcharges, rerouting via Oman/Saudi/UAE east coast; inventory cover 2–6 months; Moody's central case: disruption into autumn 2026, normalisation 2027 (the ceasefire of 17 Jun 2026 has seen violations).
- Implication for the demo: the **material-delay what-if must not be generic.** It should distinguish domestic bulk (rock, aggregate, cement, rebar) from imported long-lead items, and model the **route** (Jebel Ali blocked → Khor Fakkan/Fujairah + bonded trucking, or Oman/Saudi overland).

## 4. DP World — how they could help with procurement & supplies [V unless noted]
- No single public DP World construction-procurement platform was found. What exists:
  - **Logistics backbone:** Jebel Ali + Jafza free zone, inland logistics network, bonded trucking land-bridge, breakbulk/project-cargo handling (record breakbulk 2024: wind turbines, heavy machinery, construction materials; imports ≈ 80%).
  - **Precedent:** 2020 — 10,300+ additional container movements dedicated to the construction sector via Jebel Ali.
  - **Digital:** SeaRates / LandRates / AirRates (online freight booking, acquired), Digital Freight Alliance, "NAU by DP World" (dhow entry). Past e-sourcing: BravoSolution via Tejari (2011 rollout; current status unconfirmed). Supplier registration for entities runs through Oracle supplier systems (Suriname, London Gateway examples).
  - **Tenants:** procurement/sourcing hubs inside Jafza (e.g. Sumea).
- **Where the PoC adds value (our angle):** DP World moves boxes; it does not give a *site-side* view of "which activity dies if this container is 3 weeks late." We sit on top of their logistics data and answer that question.
- **Integration posture [A]:** No public DP World API was verified. The PoC ships a **"Logistics Gateway" adapter interface** with a clearly-labelled **simulated** DP World/Jafza/SeaRates feed. UI shows a "SIMULATED" chip. Real integration = Phase 2 conversation with the client.

## 5. Competitive landscape — what exists, what they lack

| Vendor | Strength | Weakness / gap we exploit |
|---|---|---|
| **Procore** | Broadest field-to-office suite (RFI, submittals, budget, docs, bids); easiest to use of the big three | Cost; no real 3D twin; BIM weak without Autodesk; predictive layer is generic; no GCC calendar/heat/Ramadan logic; no marine/port module |
| **Autodesk Construction Cloud** | BIM/design coordination, Revit integration, intuitive dashboards | BIM-centric; no site telemetry / asset health; delay prediction not evidenced |
| **Oracle Primavera (P6 / Cloud / Aconex)** | Enterprise CPM scheduling, Monte Carlo, what-if | Steep learning curve, heavy setup, dated UX; no 3D, no live site data |
| **Buildots** | 360° hard-hat cameras → BIM-vs-actual progress, delay detection ($45 M Series D, 2025) | Interior/building-focused; weak on marine, heavy-equipment, procurement |
| **Doxel** | Robotics/LiDAR progress + forward-looking project controls | Same: buildings; vendor claims unverified |
| **nPlan** | ML schedule-risk forecasting on 750k+ historic programmes; BAM partner | Analytics overlay only — no site, no 3D, no assets |
| **ALICE Technologies** | Generative what-if scheduling on P6 baselines | Scheduling only; no procurement route/asset health |
| **Bentley iTwin / Hexagon / Cityzenith** | Infrastructure digital twin platforms | Learning curve, implementation effort, opaque pricing, rough non-native integrations |
| Port-specific: Rotterdam smart quay-walls (CLARION), crane PdM pilots (Felixstowe 5G, MultIRELOAD) | Real research on sensors + FE twins + condition monitoring | Research/pilot, not a sellable construction-management product |

Source caveats: most comparison pages are vendor/affiliate content; complaint data is thin (a few reviews). Don't quote performance numbers in the pitch.

### The white space (our positioning)
> **"Mazzant is the only platform that connects the *schedule*, the *supply chain*, the *equipment fleet*, the *calendar* and the *3D site* in one what-if engine — tuned for GCC reality (Eid, Ramadan hours, summer midday ban, shamal/sea-state, Hormuz routing) and for marine/port works."**

No competitor above does the **material-route + GCC-calendar + asset-failure → schedule/cost** chain. That is the demo.

## 6. Feature ideas ranked by "impress the client" value
Ranked on (wow in a meeting) × (feasible as a convincing mock):

1. **Hormuz shock what-if** (route + material delay → CPM re-run → cost/LD → recovery options) — highest.
2. **Calendar intelligence** (UAE holidays, Ramadan −2 h, midday ban, heat/wind/sea-state downtime) as a scenario overlay on the Gantt.
3. **Asset health & failure prediction** (crane/dredger/truck RUL, failure probability, "what activity breaks if this fails", auto work-order).
4. **4D twin** (time scrubber builds the port: reclamation → dredging → quay caissons → apron → yard → buildings → cranes) + live equipment.
5. **Procurement control tower** (PO → production → loaded → sea → port → bonded truck → laydown; stock cover days; supplier scorecard).
6. **Financial cascade** (EVM CPI/SPI, S-curve, EAC, cashflow, IPC/retention, variation orders; every scenario shows AED impact).
7. **CXO "morning briefing"** (auto-generated narrative + top 5 risks) and **AI copilot** (scripted/rule-based, labelled).
8. **Bilingual EN/AR with RTL** — rare among competitors, cheap to do early, very visible in GCC.
9. **Project Packs** — switch port → highway → tower; same engine, new vocab/WBS/KPIs/3D scene.
10. Drone before/after slider, CCTV analytics with PPE/crane-zone alerts, HSE heat-stress index, permit-to-work, daily-report PDF in one click.

## 7. Sources
- DP World / Mina Al Hamriya expansion release (10 May 2024): https://www.dpworld.com/en/news/releases/uae/dp-world-completes-major-expansion-of-mina-al-hamriya-enhancing-dubais-maritime-infrastructure
- Aletihad — Sheikh Mohammed reviews Mina Al Hamriya, approves 700 m quay (22 Jul 2025): https://en.aletihad.ae/news/uae/4592014/mohammed-bin-rashid-reviews-development-of-mina-al-hamriya
- Fujairah terminals — Splash247: https://splash247.com/dp-world-signs-50-year-deal-for-two-fujairah-terminals/ ; DP World release: https://www.dpworld.com/en/news/dp-world-to-expand-uae-gateway-network-with-new-fujairah-terminals ; Seatrade: https://www.seatrade-maritime.com/ports-logistics/dp-world-seeks-to-bypass-hormuz-with-new-fujairah-terminals ; The Circuit (14 Jul 2026): https://circuit.news/2026/07/14/dp-world-plans-new-uae-port-to-bypass-strait-of-hormuz/
- Khor Fakkan/Fujairah land-bridge to Jebel Ali: https://logisticswall.com/category/blog/dp-world-creates-jebel-ali-alternative-as-khor-fakkan-and-fujairah
- Etihad Rail–AD Ports Fujairah–ICAD link (20 Sep 2026): https://www.thenationalnews.com/news/uae/2026/09/20/etihad-rail-launches-direct-cargo-service-between-fujairah-and-abu-dhabi-under-port-partnership/
- Moody's on UAE contractors & Hormuz: https://www.khaleejtimes.com/business/uae-developers-weather-hormuz-disruption-as-contractors-absorb-rising-costs-says-moodys ; Enterprise: https://enterpriseam.com/uae/2026/07/02/the-uaes-building-boom-survives-a-25-materials-shock-for-now/
- DP World breakbulk / construction cargo: https://breakbulk.com/articles/disruptions-are-inevitable-dp-world
- UAE midday break: https://gulfnews.com/uae/uae-announces-summer-midday-break-june-15-to-september-15-1230pm-to-3pm-1.88451178 ; Ramadan 2026 hours: https://www.wam.ae/en/article/bypcc0r-mohre-reduces-working-hours-for-private-sector ; 2026 holidays: https://gulfnews.com/living-in-uae/ask-us/uae-public-holidays-2026-full-list-of-expected-dates-and-long-weekends-2-1.500457262
- Buildots raise: https://techcrunch.com/2025/05/29/buildots-raises-45m-to-help-companies-track-construction-progress/ ; nPlan: https://www.nplan.io/products-overview ; ALICE + P6: https://aecmag.com/project-management/alice-uses-ai-to-optimise-p6-schedules/ ; iTwin: https://developer.bentley.com/itwinplatform/
- Port twin / PdM research: ASCE/TU Delft smart quay-wall (Rotterdam, CLARION); MultIRELOAD: https://www.etp-logistics.eu/wp-content/uploads/2025/06/MultIRELOAD_Predictive-maintenance-for-port-handling-equipment.pdf
