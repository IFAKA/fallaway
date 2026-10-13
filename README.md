# Zoom

A solo exploration card game for one standard 52-card deck: about 15 minutes.
Walk a sliding 3×3 map, dig regions for supplies while hostile cards fight back, claim 4 key cards in a row, and reach the finish card. Every card in your hand is food, a weapon and a key.

- **`RULES.md`**: the rulebook (play with a real deck).
- **`app/`**: web app. Play on screen (with a win record and a daily deal), or play your real deck with step-by-step guidance (`app/README.md`).
- **`core/engine.ts`**: the rules engine, the only implementation of the rules. The app and the simulator both play it.
- **`sim/sim.ts`**: simulator with bots: skill ladder, per-decision skill, fairness, luck (`node sim/sim.ts report`).
- **`DESIGN_NOTES.md`**: why the rules are what they are, with the numbers; history of earlier versions.
- **`RUN_EXAMPLE.md`**: a full narrated game.
- `archive/`: earlier simulators, kept so old results stay reproducible: v1–v3 rules, and `sim-v4.mjs` with every rule variant tested for v4.
