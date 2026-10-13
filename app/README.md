# Fallaway — solo card game (web app)

Rules: `../RULES.md`. Design notes and simulation results: `../DESIGN_NOTES.md`. Vite + React 19 + TypeScript + framer-motion.

Two modes (top of the page; new visitors start on screen):
- **Play on screen**: the app deals a full animated game (`src/Practice.tsx`, rules in `../core/engine.ts`). Hint suggests a move and shows the odds while you dig. Keyboard: arrows, 1–9/0 (hand cards), Space, S, F, Z, U, N, Esc.
  Every face-up region is tagged **safe / risky / deadly** for the hand you hold. The end screen says how close you came and keeps your **record** (won, win rate, streak, best);
  a game counts only if you played it yourself (no Undo, no Hint, not a replayed or shared `?seed=` deal). **Daily deal**: the same deal for everyone on a date, counted once, with a "Copy result" button.
- **Play with a real deck**: you deal and flip physical cards; the app never deals. It walks you through setup, tells you exactly what to do on the table
  ("Do this on the table now"), asks you to ENTER every card you turn over, tracks the piles, hand and map, and suggests moves. Logic: `src/guide.ts`, UI: `src/GuideApp.tsx` + `src/GuideStage.tsx`.

There are no difficulty levels: one game, the same rules for everyone. The table scales to fit a phone.

How to play: `cd app && npm install && npm run play`, then open http://localhost:5199 (the phone link it prints works on the same Wi-Fi).

Rules in one line: build 4 in a row of the lock's suit in your key row (claim key cards from the map by showing a card of the same rank), then stand on that suit's Ace. Every step eats a hand card; digging is free but cards of the region's suit are hostile.

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm test` (both smoke tests, 500 games each; `npm run build` also type-checks `../core` and `../sim`)
- `bun scripts/smoke.ts [games]`: the engine's advisor plays N games (~54%; it is the careful bot of `../sim/sim.ts`).
- `bun scripts/guide-smoke.ts [games] [seed|0]`: cross-checks the real-deck guide against the engine. After every step the guide's pile, waiting cards, hand, key row, gone pile, map, dig and advice must equal the engine's.
- `bun scripts/render.tsx`: server-renders the app (catches runtime errors without a browser).

Browser checks (headless Chrome via puppeteer-core; start the dev server first; `URL=http://localhost:PORT/` if not 5199):
- `node scripts/play.mjs [seed] [games]`: practice mode. Moves, digs and fights by hand, then follows the hint to the end of each game. Fails on any page error.
- `node scripts/walk.mjs [seed]`: plays a whole real-deck guide game, entering random cards, and prints every screen (table steps, guide text, what it asks). Read it to check the guide leaves no gaps. `SHOTS=10,31` also saves screenshots, `QUIET=1` prints titles only.
- `node scripts/shot.mjs`: samples card positions during a move animation (a smooth slide shows intermediate positions).
- `node scripts/shot-hostile.mjs [seed] [steps]`: screenshots a dig with a hostile card.
- `node scripts/phone.mjs`: screenshots both modes at phone size and checks nothing overflows.
- `node scripts/record.mjs`: the win record: a game played by hand counts once, Undo and Hint un-count it, the daily deal counts once a day. Exits non-zero on failure.
- `node scripts/keys.mjs`: keyboard play (arrows, digits, Space, S); a focused button never doubles a key press.
- `node scripts/shot-ui.mjs`: screenshots the danger tags and the end screen.
- `node scripts/icons.mjs`: renders `public/favicon.svg` into the PNG icons (192, 512, apple-touch).
- `node scripts/og.mjs`: renders `public/og.png`, the 1200×630 link preview `index.html` points to.

Screenshots go to `/tmp/shots`. Saved games live in `localStorage` (`zoom-v4`, `zoom-guide-v4`, `zoom-mode`, the record in `zoom-stats-v1`). If a saved game ever fails to load, the page offers "Start fresh" (the record is kept).

## Release

`npm run build` writes a static site to `dist/` (about 130 kB gzipped). Asset paths are relative, so it works from any folder on any static host
(GitHub Pages, Netlify, Cloudflare Pages, S3, `python3 -m http.server`). It is installable as an app (manifest + icons in `public/`). No server, no accounts, no tracking.

Before a release: `npm run build && npm run lint && bun scripts/smoke.ts 2000 && bun scripts/guide-smoke.ts 500 && bun scripts/render.tsx`, then with `npm run preview` running (`URL=http://localhost:4173/`) or the dev server:
`node scripts/play.mjs`, `node scripts/record.mjs`, `node scripts/keys.mjs`, `QUIET=1 node scripts/walk.mjs`, `node scripts/phone.mjs`.
