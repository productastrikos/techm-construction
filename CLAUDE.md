# Mazzant Construction PoC (Astrikos AI)

Inherits `../CLAUDE.md` and `../.claude/rules/windows-onedrive.md`.

**What:** front-end-complete demo of a generic construction-management + digital-twin platform (Astrikos "S!aP µAZZANT" RCSM), with a first "Port" project pack (Hormuz-aware supply chain, GCC calendar, asset failure prediction). Simulated data only.

**Start here:** `docs/01..05` (research, PRD, MVP + demo script, tech stack, implementation plan). Source deck: `Construction Management_Mazzant.pptx`.

**Rules specific to this folder**
- Port **5176**, `strictPort: true`. App lives in `app/`.
- Engines in `app/src/engine` are pure TS, unit-tested, no React.
- Everything simulated shows a SIMULATED chip. Dates/quantities are illustrative.
- 3D/images: Sketchfab (free+downloadable, CC0/CC-BY) -> ChatGPT image -> Meshy 6 Lite + texture; record in `CREDITS.md`. Use logged-in Chrome (`mcp__claude-in-chrome__*`).
- Keep `SESSION_CONTEXT.md` current.
