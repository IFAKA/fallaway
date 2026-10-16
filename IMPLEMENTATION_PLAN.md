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
  - Creature names for the hostile-card silhouettes: decided in Phase 6.
- [x] World facts are **pure flavour for now** (the terrain line above). No stats on the menu yet; real info (record, daily deal) can come later.
- [x] Per-suit region art, same terrain for the same suit in every world, only the look changes:

  | Suit | Earth | Sugar Rose | Moon |
  |---|---|---|---|
  | ♣ | forest | candy-cane woods | crater field |
  | ♠ | mountains | rock-candy peaks | ridges |
  | ♥ | meadow | frosting plains | ice flats |
  | ♦ | desert | caramel dunes | dust sea |

  Check red/black readability in Phase 7 before the art is final.

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
- [x] Skip the menu and the dive for shared `?seed=` links (straight to the on-screen board, never loading three.js). Also `?play` (opens the last game screen; for the test scripts, Phase 9) and server rendering (`render.tsx` still renders the game).
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
- [x] Table surface and panel styling per world (pile, waiting, gone, key row, dig row, hand, log panel, buttons). Not themed, in any world: card fronts and suit colours, safe / risky / deadly tags, gold highlights, the instruction box, tracker chips (Phase 7).
- [x] Real deck themes the table and panels only: its card backs stay classic (`.game[data-mode='guide']`).
- [x] Ambient background per world: the menu's `Backdrop` behind the board with `tone="calm"` (fixed, 45% opacity, 2.5× slower). Its CSS moved to `menu/backdrop.css` and its random helper to `menu/random.ts`, so it loads without the menu chunk or three.js.
- [x] Flavour labels next to the real terms only, in the world's accent colour (`flavour` in `worlds.ts`): "Your hand · your sweets bag", "gone for good (3) · melted away", and on the idle dig row "Zoom in on the middle card to dig here · unwrap it". Nothing is renamed; the real-deck guide shows no flavour.

## Phase 4: Per-suit region art ✅ done

- [x] Region art on face-up map cards, one look per suit per world, following the Phase 0 terrain table. Small flat SVG landscapes in `src/regionArt.tsx` (no image files, no gradients or ids, so nine copies on the board can't clash), passed the world by `Practice`'s `world` prop. Only face-up map regions show it: cards in the hand, the dig row, the key row and waiting stay plain, and a region that joins your hand fades its art out (0.3 s) as it slides.
- [x] Keep the rank + suit corner index on every card; art never covers it. The art fills the lower half of the card; the big suit moves to the top right so the suit colour still reads at a glance. Checked in every world (the corner's box ends above the art's).
- [x] Explored (sideways) regions still read clearly with art on: their landscape turns grey, the index stays full strength.
- [x] Key-suit cards and the finish card keep a distinct look: plain white, no art.
- Main chunk +2.3 kB gzipped (136.8 → 139.1 kB). Reduced motion turns off the art's fade and the suit's move.
- [x] **Entering a biome** (added after testing): digging the middle region dives into its card the way Play enters a world from the menu (`BiomeDive` in `src/biome.tsx`, same timings from `menu/transition.ts`): the board grows until the card fills the screen, the biome's colour washes in and clears on the dig, played inside the biome. Ending the dig covers the board and rises back out of the card. A reload mid-dig shows the biome at once; reduced motion skips the dive.
- [x] The biome behind the board is a `Panorama` (`src/regionArt.tsx`): the world's one sky (every biome of a world shares it: Earth blue with a sun, Sugar Rose pink with a sugar sun, the Moon's stars with Earth in the sky), and the card's ground repeated in a strip along the bottom at a natural size, toned down so the board stays readable. Scenes draw only their ground and meet themselves at both edges, so the strip has no seams. The `.game` root clips, so the zoomed board never makes the page scroll.

## Phase 5: Rebuild the game board (in progress)

Before themed motion: the on-screen game should read as a game, not a debug view, and the whole board should fit the screen.

- [x] **One compact header:** ← Menu · Fallaway · world, the key goal (Key: 4 in a row of ♣ · finish A♣), Hand and Pile, then three small icon buttons: How to play (?), Undo (↶) and Hint (💡). Restart, New game and Daily deal leave the header: Restart and New game stay in the end-of-game box, Daily deal stays on the main menu.
- [x] **Actions next to the board, only the usable ones:** Zoom IN, Claim key card, Zoom OUT, Finish (or Flip, Stop, Flee, Leave while digging, and Cancel) show only when you can use them, in a column beside the board instead of a full-width row of mostly disabled buttons. The end-of-game box sits there too.
- [x] **Tracker:** the "Your ♣" chips stay on one compact line; their legend (in key row, in sight, hidden, gone) moves into How to play.
- [x] **No scrolling:** header, tracker and the whole board (map, pile, key row, dig row, hand) fit in the window; the board scales to the height left as well as the width. The side panel (instructions and log) stays beside it. On phones the board fits the width and the panel goes below.
- [x] No rule changes; keyboard shortcuts unchanged. `npm run build && npm test && npm run lint` pass.
- [x] **No log, one short coach line** (after testing): the log panel is hidden, and the long instruction card became a title and one line of what to do now (Coach in `Practice.tsx`), on top of the actions beside the board. Key progress is left to the tracker chips and the key row; the full rules stay in How to play. With no side panel the screen is one column.
- Checked at 1900×960, 1440×900, 1280×720 and 390×844: no page scroll on desktop (the board scales from 0.84 to 1.16), the whole board in the first screen on a phone, no disabled action buttons, the end-of-game box beside the table. `FitScreen` in `src/shared.tsx`; the real-deck guide keeps its own layout and its own bar.

## Phase 6: Themed motion (in progress)

- ~~Land falling away on a move~~: dropped (decided 2026-10-16). Zooming in already carries the movement.
- [ ] Dig effect when zooming in: soil cracks, wrapper tears, dust puffs.
- [ ] **Hostile creatures** (`src/creatures.tsx`), SVG in a chibi style (big head, thick dark outline, a darker side, angry brows, one prop each). Three per biome, picked by the hostile card's rank in the dig-depth bands (`depthOf`: 2–5 small, 6–10 medium, J–A big). The creature slides out from behind the hostile card to stand beside it, just after the card turns up; flying creatures (the bee) bob while they wait, the others stand still. **Fight:** your card still flies into the hostile card; the creature lunges, the explorer draws a sword and slashes (CSS `sword-swing`, timed so the blow lands with the card), the creature is knocked back, and once beaten it tumbles away. **Flee:** the creature charges at you while the explorer runs off as before. Reduced motion: it fades in and out, no fight or charge.
  - [x] Earth: ♠ goat / eagle / yeti, ♥ bee / boar / bull, ♦ scorpion / rattlesnake / sandworm, ♣ hedgehog / wolf / bear.
  - [x] Sugar Rose: ♠ sugar cube / cotton-candy bat (flies) / rock-candy golem, ♥ cupcake / marshmallow bunny / gingerbread knight, ♦ gummy worm / donut beetle / chocolate golem, ♣ lollipop fairy (flies) / gummy bear / candy-cane dragon.
  - [x] Moon: ♠ rock mite / moon bat (flies) / ridge troll, ♥ ice slime / crystal crab / frost alien, ♦ dust bunny / dust ray (flies) / octo-alien, ♣ crater crawler / saucer alien (flies) / cyclops.
  - [ ] Remove the temporary **Creatures** preview from the menu (`Bestiary` in `src/creatures.tsx`) once the art is signed off.
- [x] **Explorer restyled to match** (`src/explorer.tsx`), in every world: chibi proportions, outline and shading, a sword for fights. The backpack's opening moved, so its position now lives in `src/explorerPack.ts`, where Practice reads it.
- [x] **Win / lose screens per world** (`src/ending.tsx`): when a game ends, a dialog opens over the board (after 0.6 s, so the last move plays) with a small scene standing on your key suit's ground. Earth: the sun comes up / night falls. Sugar Rose: a shower of sweets / the sugar sun melts. Moon: Earth rises / Earth sets. The explorer jumps for joy or sits down. Under it: the result, a flavour line (`flavour.win` / `flavour.lose` in `worlds.ts`), the record, and the buttons. After a **win**: New game, Copy result (daily), Replay this deal and See the board (Esc), after which the result box beside the board takes over. After a **loss** the dialog can't be closed (no Esc, no click outside, keys and the board behind it are inert): only New game, Copy result (daily) and Back to menu.
- [ ] Reduced motion: every themed animation falls back to a simple fade (the ending dialog does: last frame, faded in).

## Phase 7: Must stay true in every world

- [ ] Rank and suit readable at a glance; red and black suits clearly different (check contrast).
- [ ] Safe / risky / deadly tags use the same colours in every world.
- [ ] Real-deck mode themes the background and panels only, never the card art (players look at physical cards).
- [ ] No rule, number or text in `RULES.md` changes.

## Phase 8: Performance and phones

- [ ] Menu fallback for slow or low-power phones (static poster or 2D carousel) while three.js loads or if WebGL is missing.
- [ ] Canvas unmounts during the game (already true in the prototype).
- [ ] `node scripts/phone.mjs`: nothing overflows at phone size, menu included.
- [ ] Check the gzipped size of the first load and of the game alone (target: game alone stays about 130 kB).
- [ ] `bun scripts/render.tsx` still server-renders (the lazy menu keeps three.js out of it).

## Phase 9: Tests and tooling

- [ ] Browser scripts (`play`, `keys`, `record`, `walk`, `phone`, `shot*`) can skip the menu (e.g. a `?seed=` or `?play` URL).
- [ ] Make the Chrome path in `app/scripts/*.mjs` configurable (it is hard-coded for macOS; this machine is Windows).
- [ ] New script: menu smoke test (pick each world, Play, dive, board appears, back to menu).
- [ ] `npm run build && npm test && npm run lint` pass.
- [ ] Update `app/README.md` and `AGENTS.md` (menu, themes, new storage key, new scripts).

## Phase 10: Release

- [ ] Update the link preview (`og.png`) and screenshots if the first screen changes.
- [ ] Full release checklist from `app/README.md`.
- [ ] Deploy to GitHub Pages and test on a real phone.
