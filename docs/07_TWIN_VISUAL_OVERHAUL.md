# 07 - Digital Twin visual overhaul + demo UI changes (2026-10-11)

## What changed
**Scene (`app/src/three/`)**
- `terrain.ts`: one analytic height field (`terrainHeight`) drives the terrain mesh, the water-depth mask and prop placement. Natural coast + beach, dunes, foothills, ridged Hajar-style mountains, strata colouring. `makeRidge` backdrops for the highway pack.
- `water.tsx`: sea shader with depth-tinted shallows, animated shoreline foam (from the terrain depth mask), sky reflection, sun glitter, distance-faded ripples. Tone-mapping + colour-space chunks included (a ShaderMaterial skips them by default).
- `textures.ts`: all procedural, offline (sand grain, asphalt, concrete slabs, caisson formwork, facades, corrugated metal, painted road markings, cabin, fence, wake, clouds).
- `props.tsx`: terrain, palms (GLB hero palms + procedural), rocks, scrub, access road + traffic, perimeter fence, contractor camp, stockpiles, quay bollards, buoys, pavement markings, clouds, vessel wakes, casting-yard dressing, **incident exclusion zone**, `Scenery` (instanced Sketchfab models), composite **jack-up barge**, `HighwayScenery`.
- `common.tsx`: `InstancedGLB` (one draw call per sub-mesh for repeated static models).
- `PortScene.tsx`: textured pavements/facades/roofs (+ rooftop plant), chunkier flat-shaded armour rock, corrugated containers, anchored ships (tanker, bulk carrier, coaster), soft shadows, DOM-overlay anchor (`ScreenAnchor`).
- Quality "Low" drops Scenery, traffic and clouds. Perf at the finished state: about 340 draw calls / 2.2 M triangles (software-GL probe `node scripts/perf.mjs`).

**Assets** (credits in `CREDITS.md`): 23 new Sketchfab models (CC-BY) + Meshy batching plant. Heavy existing models were simplified (originals in `assets_src/opt_backup/`).

**UI (from the Tech Mahindra reference-UI feedback)**
- Nav label "Digital Twin 3D/4D" -> **"Digital Twin"** (EN/AR).
- The twin opens on the **live incident** at the data date: camera frames the casting yard, a floating card is pinned to the machine in the 3D view (what happened, **AI insight** in large violet type, **Create ticket** / **Act & Assign**). The ticket lands in the CMMS (`woStore`) and links to Fleet & Assets. Card, chip ("1 live incident") and an "Incident" camera button; the card hides when the timeline is scrubbed away from the data date. Numbers come from the live asset engine (worst-health machine drawn in the scene), wording is scripted (labelled AI DEMO).
- AI layer styling: `AiPanel`, `AiTag`, Copilot text are larger and violet-tinted (`.ai-body` in `index.css`).
- PPT-first tabs: **HSE & CCTV** opens on "Site safety & video analytics" (video feed -> acknowledge / SOP / work order, PPT slide 14), **Documents & Quality** opens on Quality (PPT slide 13); other tabs are extras. Fleet & Assets (asset tracking) and Reports (KPI dashboards) already led with their PPT content.

## Reproduce / verify
```
cd app
npx tsc --noEmit ; npx vitest run
node scripts/incident.mjs en 1600x900      # opening view + ticket click
node scripts/twin.mjs en 1600x900 end      # finished-port shot (see script for names)
node scripts/cam.mjs name 330 "x,y,z" "tx,ty,tz"   # arbitrary camera
node scripts/models.mjs bulldozer,forklift          # model QA shots
node scripts/perf.mjs
```

## Meshy notes (for next time)
- Free plan: Flagship (7.1) output is downloadable only when the task licence is **CC BY 4.0**; a task created while the panel licence is **Private** hits a subscribe paywall. Check the License row before pressing Generate/Image-to-3D.
- Clicking "Image to 3D" on a generated image starts a job immediately with the panel's current model/settings.
- Images made with Meshy's own GPT Image 2 cost 9 credits each; set "Number of images" to 1 (default 4 = 36 credits).
- Credits left after this session: about 7.

## Open items
- Barge: Meshy jobs exist but are Private (not downloadable); the scene uses a composite barge. Options: post the existing jobs to the Meshy community (public) to unlock the download, or regenerate with the licence set to CC BY 4.0 when credits allow.
- Reference UI colour language (Tech Mahindra red / warm-white) is not applied; only the interaction pattern (alert + Act & Assign + AI advisory) was mirrored.
