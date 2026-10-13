# Zoom

*A solo exploration game for one standard deck of 52 cards.*
1 player · about 15 minutes · rules version 4.1 (2026-10-13)

You are an explorer crossing a land that is bigger than you can see. **Zoom out** to see the land, **zoom in** to dig a region for supplies, and walk on, one step at a time, while the land behind you falls away. You need to claim four key cards of one suit in a row, then reach the finish card.

Every card in your hand is three things at once:
- **Food.** Every step you take eats one card.
- **A weapon.** A high card of a suit beats the hostile cards of that suit.
- **A key.** Its rank opens a key card of the same rank.

Spending a card for one of these jobs means giving up the other two. That trade-off is the game.

---

## Goal

Build a **key**: **4 cards of your key suit in a row** (for example 6♥ 7♥ 8♥ 9♥) in your **key row**. Then stand on the **finish card**, the Ace of your key suit. When you do, you win.

## What you need

One standard deck. Take out the Jokers. You also need some table space (see the layout below).

## Setup

1. **Lock card.** Shuffle the deck and turn over the top card. If it is an Ace, push it back into the middle of the deck and turn over the next one. This is your **lock card**:
   - Its suit is your **key suit** for this game.
   - Lay it face-up near you. It is the first card of your **key row**.
2. **Hand.** Look through the deck and take out every card of your key suit (12 cards, its Ace included). Deal **8 cards** from the rest into your hand. Then shuffle the key-suit cards back into the deck. A card of your key suit never starts in your hand.
3. **Map.** Deal **9 cards face-down** in a 3 × 3 square. Turn the **middle** card face-up: that is where you stand.
4. **Pile.** The rest of the deck (34 cards) is the **pile**. Put it face-down beside the map.

```
   MAP (you stand in the middle)       PILE    WAITING   GONE
   [?] [?] [?]                         [##]    [   ]     [   ]   face-up, out of the game
   [?] [7♦] [?]
   [?] [?] [?]                         KEY ROW: [lock card] ...
   DIG ROW: cards you flip while digging go here
   HAND: 8 cards (hold at most 10)
```

## The cards

| Card | What it is |
|---|---|
| A card of your **key suit** on the map | A **key card**: locked, claim it with a card of the same rank. |
| The **Ace of your key suit** | The **finish card**. |
| A map card of another suit | A **region**. Its rank tells how deep you can dig it, and its suit tells which cards are hostile there. |
| Cards in your hand | Food, weapons and keys. |

Ranks run 2 (low) to 10, then J (11), Q (12), K (13) and A (14, high). For the key, the Ace of your key suit does not count, so runs go from 2 up to K.

## Playing

On your turn, do **one** of these actions. Repeat until the game ends.

### Move: eat one card

Put **any one card** from your hand face-up on the **GONE** pile. Then step up, down, left or right. The map is a window that slides with you:

1. Pick up the row (or column) on the far side, away from the direction you are moving. Put those cards **face-down under the pile**: the land behind you falls away. They come back much later.
2. Slide the other six cards one place, exactly as they are. Face-up stays face-up, sideways stays sideways, and empty spots move too.
3. Fill the empty row on the side you moved toward. First place any cards on the **waiting** spot, **face-up**. Then fill the rest **face-down** from the top of the pile.
4. Turn the new middle card face-up if it is face-down.

### Zoom OUT: pay one card

Put one card from your hand on **GONE**, then turn every face-down map card face-up. **Once your key row holds 4 in a row, zooming out is free.**

### Zoom IN: dig the region you stand on (free)

You can dig the middle card if it is face-up, not yet explored (not turned sideways), not of your key suit, and not the finish card.

The region's **rank** sets how many cards you may flip:

| Region | 2–5 | 6–10 | J, Q, K, A |
|---|---|---|---|
| Dig up to | 3 cards | 5 cards | 7 cards |

The region's **suit** decides who is hostile: **every card of that suit is hostile here.**

Zooming in means flipping the first card: flip cards from the top of the pile one at a time into the **dig row**. After each flip:

- **A card of another suit:** it is **loot**. It stays in the dig row for now.
- **A card of the region's suit:** it is **hostile**. Before you do anything else, either:
  - **Beat it:** put **one card of the same suit with a higher rank** from your hand on GONE. The hostile card stays in the dig row as loot, and you may keep digging.
  - **Flee:** put the whole dig row (loot and hostile) on GONE and turn the region sideways (explored). The hostile wounds you: shuffle your hand face-down, pull out **one random card**, and put it on GONE.
- **A card of your key suit (or the finish card):** it doesn't count as a flip. If it is a key card and you hold a card of the **same rank**, choose:
  - **Take it now:** put that card from your hand on GONE, and the key card goes into your key row.
  - **Leave it:** put it face-up on the **waiting** spot. It joins the map, face-up, on your next move, where you can claim it for free.

  Otherwise (no card of its rank, or the finish card) it waits. Either way, flip again.

After a flip (when no hostile is waiting) you may **stop**: take the dig row into your hand and turn the region sideways.

If you flip as many cards as the region allows (and beat any hostile among them), you **dig to the bottom**. Take the dig row **and the region card itself** into your hand, and leave its spot on the map empty.

If the pile runs out during a dig, the dig ends: take the dig row into your hand and turn the region sideways.

### Claim a key card

If you stand on a key card, **show** any card from your hand with the **same rank** (any 7 opens the 7 of your key suit). You keep the card you showed. Move the key card into your key row and leave its spot on the map empty. Cards in the key row are safe: never spent, and not part of your hand.

### Finish

If you stand on the finish card and your key row holds 4 in a row of your key suit, **you win.**

## Hand limit

After taking cards, if you hold more than **10**, put cards of your choice on GONE until you hold 10.

## Losing

- You **lose** if your hand is empty and there is nothing to dig, claim or finish where you stand: you can't take another step.
- If you ever need to deal a card and the pile is empty, you also lose. This almost never happens.

## Skill and luck

There are no difficulty levels: everyone plays the same game. A careful player wins a little over half the time (about 54 games in 100); a beginner who eats whatever card is lowest, digs every region to the bottom and takes every key card they can pay for wins about 1 game in 3. Skill decides how often you win, but the deck decides any single game, like poker: almost no deal is a sure win, and about 1 deal in 20 beat a careful player every time we replayed it.

There is no turn limit and nothing gets harder over time. You can explore as long as your hand feeds you; the game ends only when you win or starve.

## Clarifications

- **Empty spots.** You can stand on an empty spot. There is nothing to do there but move on.
- **Explored regions** (turned sideways) can't be dug again, but you can stand on them.
- **The finish card before you hold your key** is just a card. You can't dig it. Walk on, and it will come back.
- **Key cards in your starting map** are fine: they are on the map, so they are claimable.
- **Taking a key card while digging** costs the card you pay with; **claiming** one on the map is free. That is the trade: pay now, or walk to it later and hope it is still there.
- **Claiming** doesn't cost anything and doesn't need the card you show to be of any particular suit. You may claim a key card you don't need. It just sits in your key row.
- **The lock card** counts toward your key when the run includes its rank. You may also build a run without it.
- **Order of waiting cards:** they enter the map in the order you found them.
- **Fleeing with an empty hand:** you lose the dig row, but there is nothing for the wound to take.
- **A beaten hostile card** is loot like any other. If you flee later in the same dig, you lose it too.

## Strategy tips

- **Your hand is your clock.** Count your steps. A hand of 4 cards means 4 steps, unless you dig.
- **Eat what you need least.** Keep the ranks that open the key cards you can see, and the highest card of each suit. Eating your only 7 when a 7 of your key suit is in sight is the classic way to lose.
- **A region is only as dangerous as your hand.** A high card of a suit makes that suit's regions safe: holding the K♣, only the A♣ can make you flee in a ♣ region. Walk toward deep regions your hand can fight, and away from the ones it can't. This alone wins about 5 more games in 100. (The app tags every face-up region **safe**, **risky** or **deadly** for the hand you hold now.)
- **Count the GONE pile.** It is face-up for a reason. If most clubs are gone, club regions are nearly safe to dig deep.
- **Low regions (2–5) are short digs**, easy to finish for the bonus region card. **High regions** are long and rich, but you will rarely reach the bottom.
- **Push your luck with care.** The more loot sits in the dig row, the more a hostile card costs you. Stop when losing the row would hurt more than one more card would help.
- **Zoom out early** to plan a route. Once your key is complete, zooming out is free: use it to find the finish card.
- **Take only the key cards your run needs.** Paying a card for a key card you don't need is a wasted meal. For one you need, paying now is often cheaper than the steps to reach it later, and it can't fall off the map.
- **Don't walk away from a key card** you can open soon. What falls off the map only comes back after the whole pile cycles.

## Quick reference

| Action | Cost | Effect |
|---|---|---|
| Move | eat 1 card | The far row goes under the pile; the new row comes in (waiting cards first, face-up). |
| Zoom OUT | 1 card (free with key) | Turn the whole map face-up. |
| Zoom IN | free | Flip up to 3 / 5 / 7 cards (region 2–5 / 6–10 / J–A); cards of the region's suit are hostile. |
| Beat a hostile | 1 higher card of its suit | It joins your loot. |
| Flee | the dig row + 1 random card | The region is explored. |
| Dig to the bottom | – | Loot + the region card join your hand. |
| Take (while digging) | 1 card of the same rank | The key card you just flipped → key row; flip again. |
| Claim | show a card of the same rank | Key card → key row. |
| Finish | – | Stand on the Ace of your key suit with 4 in a row: you win. |

---

*Play on screen or with a real deck guided by the app: see `app/README.md`. Design notes and simulation results: `DESIGN_NOTES.md`.*
