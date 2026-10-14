# Implementation plan: 3D world menu + Fallaway game

Bring this prototype's 3D world menu into the Fallaway app (`../fallaway`) as its front door, and theme the game board per world.

**Decided**
- Worlds are **design and themes only**. No rule changes: `core/engine.ts`, `RULES.md` and the simulator results stay untouched.
- The menu moves **into `fallaway/app`** (the shipped product with the engine, tests, saves and deploy), not the other way round.

**Rules to respect** (from `fallaway/AGENTS.md`)
- `core/engine.ts` is the only implementation of the rules. Never reimplement a rule in the app.
- One game, no difficulty levels. A world never makes the game easier or harder.
- Keep the `localStorage` keys (`zoom-v4`, `zoom-guide-v4`, `zoom-mode`, `zoom-seen-intro-v4`, `zoom-stats-v1`). New data goes in new keys.
- Before finishing any phase: `npm run build && npm test && npm run lint` in `app/`.

---

## Phase 0: Open decisions ✅ done

- [x] **No rename.** Fallaway keeps `framer-motion` as it is. Do not add `motion` or touch existing imports; the menu code from the prototype must be adapted to import from `framer-motion` if it uses animation.
- [x] Flavour text (expedition / survival tone, not combat):
  - Earth: "The old map, still there". Terrain: forest, mountain, meadow, desert.
  - Sugar Rose: "Every path is sweet, and sticky". Terrain: candy-cane woods, rock-candy peaks, frosting plains, caramel dunes.
  - Moon: "Quiet ground, long shadows". Terrain: craters, ridges, ice flats, dust sea.
  - Creature names for the hostile-card silhouettes: decided in Phase 5.
- [x] World facts are **pure flavour for now** (the terrain line above). No stats on the menu yet; real info (record, daily deal) can come later.
- [x] Per-suit region art, same terrain for the same suit in every world, only the look changes:

  | Suit | Earth | Sugar Rose | Moon |
  |---|---|---|---|
  | ♣ | forest | candy-cane woods | crater field |
  | ♠ | mountains | rock-candy peaks | ridges |
  | ♥ | meadow | frosting plains | ice flats |
  | ♦ | desert | caramel dunes | dust sea |

  Check red/black readability in Phase 6 before the art is final.

## Phase 1: Move the menu into Fallaway ✅ done

- [x] Create a branch in `fallaway` (`feat/world-menu`).
- [x] Add dependencies to `app/`: `three`, `@react-three/fiber`, `@react-three/drei`, `@use-gesture/react`, `zustand` (+ `@types/three`).
- [x] Copy into `app/src/menu/`: `Menu`, `WorldCarousel`, `CarouselItem`, `Backdrop`, `planets/*` (Earth, Candy, Moon, geometry, OnSurface, parts), `worlds.ts`, `store.ts`, `transition.ts`, `reducedMotion.ts`.
  - The scene folder is `planets/`, not `worlds/`, so it can't be confused with `worlds.ts`.
  - Shared pieces: `createPlanet` (mesh + surface points), `PlanetBody`, `Spin`, `Scatter`, and `Sprites` for the backdrop.
  - The prototype's `GameBoard` and `useGame` store were not copied: `Menu` takes `onEnter` (called when the dive ends) and `children` (extra menu buttons), and keeps its dive state locally. The prototype used no `motion` code, so nothing needed adapting to `framer-motion`.
  - World facts are the Phase 0 terrain per suit.
- [x] Move the menu CSS into its own file (`menu/menu.css`, loaded with the menu chunk), scoped under `.menu`. The backdrop rules are scoped under `.backdrop` so Phase 3 can reuse it behind the board. Classes that clash with `App.css` were renamed (`menu-title`, `menu-stage`, `menu-actions`, `menu-btn`), and keyframes are prefixed `menu-`.
- [x] Rename the title to *Fallaway* everywhere (it already is) and check fonts match the app: the menu uses the app's `system-ui`, not the prototype's monospace.
- [x] Load the menu with `React.lazy`, so three.js is a separate chunk. Until Phase 2 it only opens at `?menu`; Play dives and then shows the current game screen.
- [x] Build passes; the bundle report shows three.js only in the menu chunk (`Menu-*.js`, 255 kB gzipped). Main chunk 134.1 kB gzipped (was 133.2 kB).

## Phase 2: Screen flow ✅ done

- [x] `App.tsx` switches between menu → dive → game (the existing `Practice` / `GuideApp`). The menu is the front door at `/`; the `?menu` preview is gone.
- [x] Move the mode bar ("Play on screen" / "Play with a real deck") into the menu. In the game, the bar is now `← Menu · Fallaway · <world> · on screen / with a real deck`. `zoom-mode` still records the last game screen opened.
- [x] Menu buttons (the menu takes one `onEnter(destination, arrival)` callback; types in `src/screens.ts`):
  - [x] **Play** / **Continue**: with an unfinished saved game (`zoom-v4`) the main button is **Continue** (resumes it); otherwise **Play** deals a new game, so a finished game is not shown again.
  - [x] **Daily deal**: starts today's deal, or resumes it if it is the unfinished saved game (same ranking rule as the in-game button).
  - [x] **Real deck**: opens the real-deck guide (`GuideApp`, which resumes its own save). No world dive: the menu fades out and the guide fades in (a physical deck has no world to dive into).
  - [x] **How to play**: the rules in a dialog. `HowToPlay` in `shared.tsx` is shared with the on-screen game's first-visit intro.
- [x] Remember the chosen world in a **new** key: `fallaway-world-v1` (the world id).
- [x] **One on-screen game per world** (decided after testing): each world has its own save and its own Continue. Earth keeps `zoom-v4`, so existing saved games carry on there; Sugar Rose and Moon use `fallaway-game-candy-v1` and `fallaway-game-moon-v1` (`GAME_KEYS` in `src/save.ts`). One shared win record (`zoom-stats-v1`); the daily deal still counts once a day. The real-deck guide keeps one save (`zoom-guide-v4`).
- [x] **A reload stays in the game** (decided after testing): the open game screen is kept in `sessionStorage` (`fallaway-screen-v1`), so a reload resumes it while a new tab or a later visit starts at the menu.
- [x] Skip the menu and the dive for shared `?seed=` links (straight to the on-screen board, never loading three.js). Also `?play` (opens the last game screen; for the test scripts, Phase 8) and server rendering (`render.tsx` still renders the game).
- [x] Returning player with a game in progress: **Continue** resumes it. Like every way into a world it dives in (changed after testing: the transition depends only on the destination, `transitionOf` in `src/screens.ts`, never on the button).
- [x] **Back to menu** button in the game. **No confirm:** both games save every step, so leaving loses nothing and Continue / Real deck pick up where you left off. No Esc-to-menu (Esc still cancels a pending move).
- [x] Turn the menu's arrow-key handler fully off while a game is open (the menu is unmounted), and while How to play is open.
- [x] **Leave a world the way you entered it** (added while testing Phase 3): ← Menu from an on-screen game covers the table in the world's colour, then the menu opens at the planet's surface and the camera rises back out to the carousel (the dive played backwards: `camera="rise"` in `WorldCarousel`); the menu text returns as the camera settles. From Real deck the menu just fades back in. Reduced motion: straight back. One `Veil` component in `App.tsx` does every wash (`clear` arriving, `cover` leaving, `hold` while the menu chunk loads).
- [x] **Transition timing** (tuned after testing, following https://emilkowal.ski/ui/great-animations: short, ease-out, quicker for frequent actions): dive and rise 0.8 s each with an ease-out camera (was 1.5 s, ease-in), wash 0.25 s to cover and 0.4 s to clear (0.2 s on the way back, so the pull-back is seen), menu text 0.2 s, world switching 0.4 s. About 1.2 s from click to cards and 1.1 s back to the menu (was about 2.5 s each). All in `menu/transition.ts`, `menu.css`, `backdrop.css` and the `.veil` rules in `App.css`.
- [x] Start the board's deal animation only after the colour wash clears: `App` shows the wash (`Veil`, colour from `worldTheme`'s `--veil`) and `Practice` deals the cards when it is gone (`dealt` prop). Reduced motion skips the wash.

## Phase 3: Theme system for the board ✅ done

- [x] Define a theme shape per world: CSS custom properties in `src/themes.css` (`--table`, `--felt`, `--felt-hi`, `--line`, `--line-soft`, `--btn*`, `--card-back`, `--card-back-edge`, `--title`). `App.css` uses the tokens instead of hard-coded greens. Earth is the original green table and also the default. No image assets needed so far.
- [x] Apply the theme on the game root: `.game` with `data-world`, `data-mode` and `worldTheme()` variables (`--accent`, `--veil`, ...), as the menu does.
- [x] Card backs per world (face-down map cards and the pile): Earth classic blue, Sugar Rose candy stripes, Moon stars. The pile count has a text shadow so it reads on any back.
- [x] Table surface and panel styling per world (pile, waiting, gone, key row, dig row, hand, log panel, buttons). Not themed, in any world: card fronts and suit colours, safe / risky / deadly tags, gold highlights, the instruction box, tracker chips (Phase 6).
- [x] Real deck themes the table and panels only: its card backs stay classic (`.game[data-mode='guide']`).
- [x] Ambient background per world: the menu's `Backdrop` behind the board with `tone="calm"` (fixed, 45% opacity, 2.5× slower). Its CSS moved to `menu/backdrop.css` and its random helper to `menu/random.ts`, so it loads without the menu chunk or three.js.
- [x] Flavour labels next to the real terms only, in the world's accent colour (`flavour` in `worlds.ts`): "Your hand · your sweets bag", "gone for good (3) · melted away", and on the idle dig row "Zoom in on the middle card to dig here · unwrap it". Nothing is renamed; the real-deck guide shows no flavour.

## Phase 4: Per-suit region art ✅ done

- [x] Region art on face-up map cards, one look per suit per world, following the Phase 0 terrain table. Small flat SVG landscapes in `src/regionArt.tsx` (no image files, no gradients or ids, so nine copies on the board can't clash), passed the world by `Practice`'s `world` prop. Only face-up map regions show it: cards in the hand, the dig row, the key row and waiting stay plain, and a region that joins your hand fades its art out (0.3 s) as it slides.
- [x] Keep the rank + suit corner index on every card; art never covers it. The art fills the lower half of the card; the big suit moves to the top right so the suit colour still reads at a glance. Checked in every world (the corner's box ends above the art's).
- [x] Explored (sideways) regions still read clearly with art on: their landscape turns grey, the index stays full strength.
- [x] Key-suit cards and the finish card keep a distinct look: plain white, no art.
- Main chunk +2.3 kB gzipped (136.8 → 139.1 kB). Reduced motion turns off the art's fade and the suit's move.

## Phase 5: Themed motion

- [ ] Land falling away on a move: Earth crumbles, Sugar Rose melts, Moon floats off.
- [ ] Dig effect when zooming in: soil cracks, wrapper tears, dust puffs.
- [ ] Hostile card appearing: a world creature silhouette (expedition danger, not a "kill" moment).
- [ ] Win / lose screens per world (sunrise, candy confetti, Earth rising).
- [ ] Reduced motion: every themed animation falls back to a simple fade.

## Phase 6: Must stay true in every world

- [ ] Rank and suit readable at a glance; red and black suits clearly different (check contrast).
- [ ] Safe / risky / deadly tags use the same colours in every world.
- [ ] Real-deck mode themes the background and panels only, never the card art (players look at physical cards).
- [ ] No rule, number or text in `RULES.md` changes.

## Phase 7: Performance and phones

- [ ] Menu fallback for slow or low-power phones (static poster or 2D carousel) while three.js loads or if WebGL is missing.
- [ ] Canvas unmounts during the game (already true in the prototype).
- [ ] `node scripts/phone.mjs`: nothing overflows at phone size, menu included.
- [ ] Check the gzipped size of the first load and of the game alone (target: game alone stays about 130 kB).
- [ ] `bun scripts/render.tsx` still server-renders (the lazy menu keeps three.js out of it).

## Phase 8: Tests and tooling

- [ ] Browser scripts (`play`, `keys`, `record`, `walk`, `phone`, `shot*`) can skip the menu (e.g. a `?seed=` or `?play` URL).
- [ ] Make the Chrome path in `app/scripts/*.mjs` configurable (it is hard-coded for macOS; this machine is Windows).
- [ ] New script: menu smoke test (pick each world, Play, dive, board appears, back to menu).
- [ ] `npm run build && npm test && npm run lint` pass.
- [ ] Update `app/README.md` and `AGENTS.md` (menu, themes, new storage key, new scripts).

## Phase 9: Release

- [ ] Update the link preview (`og.png`) and screenshots if the first screen changes.
- [ ] Full release checklist from `app/README.md`.
- [ ] Deploy to GitHub Pages and test on a real phone.
