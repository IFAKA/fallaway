# Zoom — rules v2 (bot-tested; this is what the web app plays)

Standard 52 cards, no Jokers. Solo. 10-15 min.

## Setup
1. Shuffle. Turn the top non-Ace face-up: the **LOCK** card. Its suit is the **key suit**. Leave it face-up beside the table for the whole game: it is out of play and reminds you of the key suit.
2. Take out the Ace of the key suit: the **FINISH card**.
3. Deal 5 cards to your **HAND**.
4. Deal a 3x3 face-down **MAP**; flip the middle card. You stand on the middle.
5. Shuffle the finish card into the rest of the deck, 8-30 cards down. This is the **PILE** (37 cards).

## Goal
Hold your **key** — 4 consecutive ranks of the key suit in your hand (e.g. 5♥ 6♥ 7♥ 8♥; the Ace does not count) —
while the finish card is the MIDDLE card of the map. Then you win.

## Actions (any order, unlimited)
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

## Time (laps) and losing
The pile is a loop: when it runs out, shuffle BEHIND into a new pile. Each full pass is a **lap**.
**Every lap, zooming (in or out) costs one more card**: lap 1 costs 1, lap 2 costs 2, lap 3 costs 3... Moving stays free, but wandering makes everything dearer.
You lose when you cannot pay for a zoom and do not hold your key, or when the world has no cards left to deal.
(There is no fixed number of reshuffles: the cost simply keeps climbing.)

## Bot results (10000 games, see sim.mjs; rules v2)
Skill ladder: random 0% | heuristic with 50% random moves 7% | 25% random 23% | 10% random 37% | 5% random 43% | clean heuristic 47%.
Games last about 46 actions. About 16% of games end because the world runs out of cards. Most wins happen on lap 1-2; by lap 3 zooming costs 3 and games usually end.
Rejected variants: fixed 2 reshuffles (arbitrary cutoff), monsters stronger per lap or smaller spreads per lap (games rarely end), a one-card toll per lap (games twice as long, many never end).

## Skill analysis (2026-10-12, rules v1 when spreads were optional; led to v2 below)
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

### Experiment: locks (2026-10-13, not adopted yet)
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
