# Zoom — solo card game (web app)

Draft rules: `../DRAFT_RULES.md`. Vite + React 19 + TypeScript + framer-motion.

Two modes (top of the page):
- **Play with a real deck (guide)** — you deal and flip physical cards; the app never deals. It walks you through setup, tells you exactly what to move on the table
  ("Do this on the table now"), asks you to ENTER every card you reveal, tracks piles/hand/map, and suggests moves. Logic: `src/guide.ts`, UI: `src/GuideApp.tsx`.
- **Practice on screen** — the app deals a full animated game (`src/Practice.tsx`, rules in `src/engine.ts`).

How to play: `cd idea/zoom/app && npm run play`, then open http://localhost:5199 (the phone link it prints works on the same Wi-Fi).

Commands:
- `npm run dev` / `npm run build` / `npm run lint`
- `bun scripts/smoke.ts [games]` — engine advisor plays N games (~47% wins, same as `../sim.mjs`)
- `bun scripts/guide-smoke.ts [games]` — cross-checks the guide against the engine: after every step the guide's piles, hand, gone pile and map must equal the engine's
- `node scripts/shot.mjs`, `node scripts/flow.mjs`, `node scripts/guide-flow.mjs` — drive the dev server (localhost:5199) in headless Chrome and screenshot to /tmp/shots

State is saved in `localStorage` (`zoom-guide-v1`, `zoom-v1`).

Rules in one line: build 4 in a row of the lock suit, make that suit's Ace the middle card of the map. The pile loops; each lap zooming costs one more card. Zooming in, you take every card you can pay for.
`scripts/lap2.mjs` browser-tests paying 2 cards on lap 2 (needs `/tmp/lap2.json`, see the script header).
`scripts/loot.mjs` browser-tests that the spread's Done button stays locked while something is affordable.
`scripts/walk.mjs [seed]` plays a whole real-deck guide game in headless Chrome and prints every screen (table steps, guide text, what it asks) — read it to check the guide leaves no gaps. `SHOTS=10,31` also saves screenshots.
