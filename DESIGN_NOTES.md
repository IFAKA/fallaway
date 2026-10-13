# Zoom — design notes

The current rules are in `RULES.md` (v4). This file explains **why** they are what they are, with the simulation evidence, and keeps the history of earlier versions.
Tools: `core/engine.ts` (the rules engine, the only implementation of the rules), `sim/sim.ts` (bots and reports that play that engine), `app/scripts/smoke.ts` (the app engine's advisor plays N games), `app/scripts/guide-smoke.ts` (the real-deck guide must equal the engine at every step).
The rule variants tested while designing v4 (biomes, trails, fight and edge variants...) are knobs of the archived `archive/sim-v4.mjs`, which still reproduces the v4 tables below.

## v4 (2026-10-13): the redesign

### What was wrong with v3

A design review (and `archive/sim-v3.mjs` experiments, see "Danger and clock check" below) found:
- **No danger.** Monsters were a one-card fee: with an 8–10 card hand, one card always paid for them. Even monsters that bite when unbeaten, one-card duels and dangerous regions bit **0.0–0.1 cards per game**.
- **Fake choices.** "Take everything you can pay for" was mandatory because choosing never beat taking everything.
- **Cosmetic suits.** Suits were monster/ally/treasure/obstacle, but the key suit was removed from spreads: with a ♠ lock, no monster ever appeared. The region card's suit did nothing.
- **A bolted-on clock.** Zoom cost +1 per reshuffle. Without it nobody ever went broke (0 of 5000 games), and the clock **halved the skill gap** (55 → 23 points).

### Pillars

1. **Every card has three uses**: food (steps), weapon (fights), key (claims). Every spend is an opportunity cost (the multi-use-card idea of *Race for the Galaxy* and *Regicide*).
2. **Plan on the map, gamble in the dig**: zoom out is paid information; zoom in is push-your-luck (*Quacks*, *Can't Stop*, *Deep Sea Adventure*).
3. **One clock, made of the core resource**: hunger. Every step eats a card (the classic roguelike food clock). No hidden escalation.
4. **Suits and ranks always mean something**: region rank = dig depth; region suit = who is hostile; lock rank = where your run can be; hand suits = which regions are safe for you.
5. **Few rules, and every decision real**: a decision stays only if swapping it for the obvious simple rule loses games. A rule stays only if removing it changes results.

### How the rules were found (`archive/sim-v4.mjs`, careful bot unless noted)

| Step | Change | Result |
|---|---|---|
| 1 | Push-your-luck digs; region suit is hostile; beat a hostile with one higher card; the lock card starts the key row; map cards that fall off are destroyed | 1.3%: key cards get destroyed, and the world ends after ~7 moves |
| 2 | Fallen cards go under the pile instead | 65%, but ~200 moves and many stalls: walking is free, so wandering is free |
| 3 | **Hunger**: every step eats a card | 3.5% (too costly) → free digging 23% → bigger starting hand 51% |
| 4 | Push-your-luck was fake: "always flip" beat every threshold rule. Bust chance ~5% per flip, break-even only after ~19 loot cards | Beat a hostile **only with a higher card of its suit** (bust ~17%), **fleeing wounds** (one random hand card), digs 4/5/6 deep: careful 16.7% vs always-flip 9.4%, a real decision |
| 5 | Resource level | Start 10 / limit 12 → 50%. The hand limit is load-bearing (no limit: 64% and a smaller skill gap). Free zoom-out with the key: +8 points. Lock in the key row: +9 points |
| 6 | Dig depth by region rank | 3/5/7 gives the most push skill (49% vs 35% for always-flip) and gives regions personality |
| 7 | Finish card placement (6–20 deep, top half, anywhere) | 49.1 / 49.9 / 50.4%: no effect, so it is simply shuffled in (one setup step fewer) |
| 8 | Key cards met while digging return **face-up** (a player remembers them anyway) | +13 points; retuned to start 9 / limit 10 → 49.5% |
| 9 | Advisor uses only public information (also used by the real-deck guide); always digs (digging is free and always worth it) | The app engine's advisor = the simulator bot (50.1% vs 49.8%) |
| 10 | Removed the "no run possible" loss | Key-suit cards can never reach your hand, so they can never be spent: it cannot happen |
| 11 | No rule change: the careful bot also walks toward deep regions its hand can fight (danger, `SAFE=2`; see the biome test) | 50.0% → 55.1%. The app's advisor does the same (55.0%), and the app tags every region safe / risky / deadly |
| 12 | Starting hand: set the 12 key-suit cards aside, deal 9 from the rest, shuffle them back in (was: deal one at a time and put each key-suit card under the deck, which also kept those cards off the map) | Same game, less handling: careful 55.1% → 54.8%, beginner 16.4% → 17.6% (4000 games). Letting key-suit cards start in your hand: 30.1% / 8.3% (they can only be spent, and the finish Ace can start in hand) |
| 13 | A key card met while digging was a dead flip ("see it, set it aside, flip again"; a player hit four in a row and asked for a change). Now, if you hold a card of its rank, you choose: **take it now** by paying that card to GONE, or **leave it** waiting as before. It still does not count as a flip. Retuned to **start 8** (`sim/sim.ts`, 4000 games) | Start 9: careful 60.4%, beginner 39.3% → start 8: **careful 54.0%, beginner 34.5%** (was 55.0% / 18.4%). The skill gap shrinks from 37 to 20 points; taking or leaving well is worth 3.6 points (`swap take` 50.4%). Rejected alternatives: a key card counts as a flip and waits (55.4% / 27.6%: digging to the bottom gets safe, push-your-luck drops from 17 to 5 points), counts as a flip and is claimed free if you hold its rank (68.9% / 53.9%), ends the dig (17.4% / 7.0%) |

### Results (`node sim/sim.ts report 4000`, after step 13)

- **Skill ladder:** careful 54.0% · beginner 34.5% (eats its lowest card, flips to the bottom, fights whenever it can, takes every key card it can pay for, steps to the highest card) · random 0%.
- **What each decision is worth** (careful bot with one decision swapped for the beginner's):

| Decision | Win rate |
|---|---|
| Careful (no swap) | 54.0% |
| Push-your-luck | 40.7% |
| Where to move | 39.5% |
| What to eat / pay with | 31.6% |
| When to zoom out | 40.9% |
| Take or leave a key card met while digging | 50.4% |
| Dig whenever you can | 54.8% (automatic) |
| Fight whenever you can | 53.9% (automatic) |

Before step 13 (start 9, key cards always waited) the careful bot won 55.0% and the beginner 18.4%; eating your lowest card cost 31 points (now 22). What to eat was reported as 6.9% (later 9.6%) until the simulator moved onto the app's engine (2026-10-13): the old simulator made the beginner pay a card for every dig, though digging is free.

- **Length:** ~40 actions (about 15 minutes with real cards): 10 moves, 5.3 digs, 8.8 flips, 3.1 fights, 1.1 flees, 1.0 key cards taken and 1.1 left while digging.
- **Close games:** losses by key cards held when the hand ran out (0/1/2/3/4): 0 / 180 / 548 / 906 / 208. Six losses in ten come with at least 3 key cards; the app's end screen says how close you came.
- **Fairness:** by lock rank 48–59% (7 is hardest, 8 easiest); by key suit 51–55%.
- **Luck:** replaying each deal 20 times with 5% random moves, 286 of 300 deals were won at least once, and 2 were won every time.
- **No levels, no escalation:** one game for everyone, like poker: mastery raises your win rate, it never guarantees a win. Nothing gets harder over time and there is no turn limit: hunger is the only clock. (Dropped Easy 10/12 and Hard 8/9 levels.)

### Not tested by bots

The bots measure whether decisions matter, not whether they are fun. Next step: human playtests (5–10 games each, a few players). Questions:
- Is ~15 flips per game pleasant with real cards?
- Does the random wound feel fair?
- Is "higher card of the same suit" easy to read at a glance?
- Do players want "one more game" right after a loss?

## Biome test (2026-10-13, not adopted)

Goal: give each suit of region its own reward, so that where you dig is a real choice and you visit different biomes.
Measure: the careful bot vs the same bot blind to biomes (`BLIND=1`). The gap is what choosing biomes is worth. Run `SAFE=0 BIOME=1|2 node archive/sim-v4.mjs biome 6000` (the table was measured before danger steering became the bot's default).

| Variant | Careful | Blind to biomes | Choosing biomes is worth | Beginner |
|---|---|---|---|---|
| Today's rules | 49.5% | — | — | 16.9% |
| `BIOME=1`: digging a region to the bottom pays by suit: ♥ region card + a pile card, ♠ region card + map face-up, ♦ pick any gone card, ♣ 2 free steps | 56.4% | 55.7% | +0.7 (+1.8 steering harder, `BW=4`) | 21.9% |
| `BIOME=2`: every dig you don't flee pays a small bonus: ♥ a pile card, ♠ map face-up, ♦ trade a hand card for a gone card, ♣ 1 free step | 74.0% | 72.5% | +1.5 (+2.4 at `BW=4`) | 22.1% |
| `BIOME=2` + whole map face-up (`UP=1`, test only) | 87.5% | 86.3% | +1.2 | 26.9% |
| `TRAIL=1`: digging a region to the bottom, if its rank matches a key card you still need, pulls that key card out of the pile onto the map | 51.4% | 50.9% | +0.5 | 19.1% |

For scale: where to move is worth 13 points, and push-your-luck is worth 15.
- **It fails.** Rewards at the bottom of a dig come ~1.6 times per game, too rare to matter. Per-dig bonuses only make the game easier.
- **Seeing the map is not the problem.** With every card face-up, choosing biomes is still worth ~1 point.
- **Why:** every reward is paid in the same currency (hand cards). Food, a trade and a free step are all worth "about one card", and walking to a better biome costs one card. The biomes differ in amount, not in kind.
- **Tying a reward to the goal (`TRAIL=1`) fails too:** a wanted rank and a dig to the bottom rarely line up.
- **What does work: danger.** A region's suit decides which hostiles appear there, and a region is safe or deadly depending on the suits in your hand. That can't be swapped for anything else. A careful bot that also steers toward regions its hand can fight (`SAFE=2`) wins **55.0%** instead of 50.0%, with no new rule. More steering is worse (`SAFE=3` 54.1%, `SAFE=5` 53.6%).
- **Adopted (no rule change):** danger is the biome identity. The careful bot and the app's advisor steer by it, the app tags every region safe / risky / deadly, and the rulebook teaches it. 

## History: rules v1–v3 (superseded by v4)

Everything below describes the old rules. Its commands refer to the archived simulator: run `node archive/sim-v3.mjs ...` instead of `node sim.mjs ...`.

### Rules v2 (bot-tested)

Standard 52 cards, no Jokers. Solo. 10-15 min.

#### Setup
1. Shuffle. Turn the top non-Ace face-up: the **LOCK** card. Its suit is the **key suit**. Leave it face-up beside the table for the whole game: it is out of play and reminds you of the key suit.
2. Take out the Ace of the key suit: the **FINISH card**.
3. Deal 5 cards to your **HAND**.
4. Deal a 3x3 face-down **MAP**; flip the middle card. You stand on the middle.
5. Shuffle the finish card into the rest of the deck, 8-30 cards down. This is the **PILE** (37 cards).

#### Goal
Hold your **key** — 4 consecutive ranks of the key suit in your hand (e.g. 5♥ 6♥ 7♥ 8♥; the Ace does not count) —
while the finish card is the MIDDLE card of the map. Then you win.

#### Actions (any order, unlimited)
- **Move** (free): up/down/left/right. The map slides: the far row/column goes face-down onto the **BEHIND** pile, 3 new face-down cards from the pile enter on the near side. Flip the new middle card.
- **Zoom out** (pay the zoom cost): flip the whole map face-up.
- **Zoom in** (pay the zoom cost) on an unexplored middle card: deal cards from the pile face-up as a spread: middle card 2-5 -> 1 card, 6-10 -> 2, J-A -> 3.
  **Take every card you can pay for**, in any order; you choose what to pay with:
  - ♦ Treasure / ♥ Ally: free.
  - ♣ Obstacle: swap it for one same-colour card from your hand, or any two cards.
  - ♠ Monster: strength = rank / 2 rounded up. Pay hand cards whose total value >= strength (2-10 face value, J=11 Q=12 K=13 A=14; your ♠ count double).
  - Took every card: the middle (region) card joins your hand too. Otherwise the cards you cannot pay for go out of play and the region is marked explored (turn it sideways).
  - If the finish card turns up in a spread, put it on the bottom of the pile and deal the next card instead.
  (v2: taking used to be optional, but the sim showed "take everything you can" always beats choosing, so the fake choice was removed.)
- **Finish**: the finish card is the middle card and you hold the key: you win.

The **zoom cost** is 1 card on lap 1, 2 on lap 2, and so on (see below). Every card you pay or discard goes to the **GONE** pile, out of the game forever.
Hand limit 10: discard down immediately.

#### Time (laps) and losing
The pile is a loop: when it runs out, shuffle BEHIND into a new pile. Each full pass is a **lap**.
**Every lap, zooming (in or out) costs one more card**: lap 1 costs 1, lap 2 costs 2, lap 3 costs 3... Moving stays free, but wandering makes everything dearer.
You lose when you cannot pay for a zoom and do not hold your key, or when the world has no cards left to deal.
(There is no fixed number of reshuffles: the cost simply keeps climbing.)

#### Bot results (10000 games; rules v2)
Skill ladder: random 0% | heuristic with 50% random moves 7% | 25% random 23% | 10% random 37% | 5% random 43% | clean heuristic 47%.
Games last about 46 actions. About 16% of games end because the world runs out of cards. Most wins happen on lap 1-2; by lap 3 zooming costs 3 and games usually end.
Rejected variants: fixed 2 reshuffles (arbitrary cutoff), monsters stronger per lap or smaller spreads per lap (games rarely end), a one-card toll per lap (games twice as long, many never end).

### Skill analysis (2026-10-12, rules v1 when spreads were optional; led to v2 below)
Each decision was swapped for a simple rule, keeping everything else on the best bot (`ABL=... node sim.mjs abl`; `node sim.mjs luck` for per-deal replays).
Best bot = careful bot + "take every card you can afford" = 45%.
- When to zoom: careful 45% vs "zoom whenever you can" 20%: biggest skill.
- Where to move: careful 45% vs "step toward the highest face-up card" 28%.
- What to pay with: careful 45% vs "lowest card not of the key suit" 39% (random paying ~0%).
- What to take from a spread: careful choosing (31%) LOSES to "take everything" (45%): a fake decision, needs a downside.
- Luck: 99.8% of deals were won at least once in 40 noisy replays; the starting hand moves odds only 23%->30%; finish-card depth has no effect.

### v2: looting is mandatory (2026-10-12)
Tried to make "what to take" a real choice; none worked, "take everything" still won every time:
hand limit 6/7 (all policies drop, take-all still best), +1 zoom price per card taken (everyone 0%),
press-your-luck one-at-a-time spreads with ambush (flip-all 27% vs careful 17%), stronger monsters (same).
Cause: every card is ~1 card of fuel and every price is ~1 card, so taking is never a loss.
So the rule is now: take every card you can pay for. Bots: random 0%, 50%/25%/10%/5% noise 7/23/37/43%, careful 47%.
Skill per decision now (simple rule instead of careful): when to zoom 47->21%, where to move 47->29%, what to pay with 47->41%.

### v3: the lock stays on the table (2026-10-12)
With real cards nothing showed the key suit once the lock was shuffled back, so it now stays face-up beside the table, out of play (pile 37, hand limit 10).
Backtest, clean bot, 10000 games each (`LOCK_OUT=1 LIMIT=10 node sim.mjs heur`):
v2 (lock shuffled back, limit 8) 47.1% | lock out, limit 8 39.9% | lock out, limit 9 44.8% | lock out, limit 10 47.6% | lock out, limit 9 + 7-card start 49.0%.
Other options tried: lock rejoins at the first reshuffle 42.3%; lock starts in your hand 49.3% (but it can be paid away, so no reminder).
Losing the lock removes one key-suit card from play, hence the drop; a higher hand limit gives it back. Limit 10 matches v2 with one number changed.

### Locks (2026-10-13, adopted for v3; replaced by v4)
Problem: the obvious beginner plan ("zoom on whatever you stand on, step to the next unlooted card, repeat"; `node sim.mjs obvious`) wins 48.5% vs the careful bot's 47.2%: where you go and when you zoom add no skill.
Idea: macro (the map) shows what you need, micro (spreads) gives what opens it.
- Key cards live only on the map: a key-suit card turning up in a spread or the starting hand goes to the bottom of the pile.
- A key card on the map is locked by its rank: stand on it and show a hand card of the same rank to claim it (you keep the shown card). You cannot zoom into a key card.
- Claimed key cards go to a face-up KEY ROW: never spent, not counted in the hand limit.
- Once the key row holds the run, zooming out is free.
Results (`LOCK_OUT=1 LOCKS=1 CLAIM_SHOW=1 FREE_SCOUT_KEYED=1 LIMIT=10 PACK_START=n`, 5000 games; careful vs beginner):
paying the rank instead of showing it, no free zoom-out: 6% vs 4% | show, start 5: 28.5% vs 13.5% | start 7: 36.8% vs 15.8% (20000 games) | **start 8: 40.5% vs 17.4%** | start 9: 42.1% vs 16.2%. Random 0%.
The careful bot is a first draft for these rules, so the real skill gap is probably larger.
Skill per decision with locks (start 8, 10000 games; careful bot, one decision swapped for the beginner's; `SIMPLE=... node sim.mjs mix`):
careful 39.9% | where to move 17.4% | when to zoom 15.7% | what to keep/pay with 6.9% | which locks to open 40.4% (no decision) | endgame 39.9% (no decision) | beginner 17.4%.
Moving, zooming and keeping the right ranks are all real skill now; claiming and the free zoom-out are automatic.
The web app plays only these rules (Practice and the real-deck guide; start 8 cards, pile 34). Classic was removed from the app; sim.mjs still has it for comparison.

### Danger and clock check (2026-10-13, not adopted)
Question: can monsters be a real risk, and is the lap clock needed? New sim flags, all off by default:
`HURT=n` (each monster left unbeaten takes n random hand cards), `TURF=1` (black regions: +1 spread card, monsters bite; red regions: monsters never bite), `DUEL=1` (beat a monster with ONE card of value >= its full rank).
5000 games each on the locks rules; careful bot vs careful-but-take-everything looter vs beginner:
- HURT 1-2, forced or optional looting, with or without TURF / stronger monsters / DUEL: careful 35-40%, take-everything 37-40%, beginner ~17%. Cards bitten per game: 0.0-0.1.
- Cause: with an 8-10 card hand one card almost always beats any monster, so monsters are a 1-card tax, never a threat. Optional looting stays a fake choice (careful choosing loses 2-3 points to taking everything).
- Key suit ♠ means no monster ever appears (key cards are kept out of spreads).
- No clock (`ESC_ZOOM=0`): careful 78.6%, beginner 23.6%, random 0.6%, 54 actions. Nobody ever goes broke (0 games); every loss is the world running out of cards (spent cards leave the game), mostly on laps 5-10.
  So games end without the clock; the clock is a difficulty knob, and it halves the skill gap (55 points -> 23).
