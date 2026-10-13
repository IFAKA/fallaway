# Example run (bot-played, seed 41)

Regenerate with `node sim/sim.ts run careful 41` (the log lines are the app's own). Rules: `RULES.md`.
Grid legend: `[ ]` = where you stand, `??` = face-down, `..` = empty spot, `✓` = explored (turned sideways).
Watch the key cards met while digging. The 7♦ and the 9♦ are taken on the spot, each paid with a card of its rank. The 10♦ and the K♦ are left waiting (the run the bot is building does not need them), and so are the 2♦, Q♦, J♦ and 8♦, which no card in hand could pay for. A few moves later the bot walks onto the waiting 8♦ and claims it for free with the 8♣: 6♦ 7♦ 8♦ 9♦ is the key, and the finish card is reached after 39 actions.

```
New game #41. Lock card 6♦: it starts your key row. Build 4 in a row of ♦, then stand on the finish card A♦.

START
    ??     ??     ??    
    ??    [9♥]    ??    
    ??     ??     ??    
   Hand(8): 10♠ A♠ 2♥ 3♥ 6♥ 7♥ K♥ A♥
   Key row: 6♦   Pile: 34   Gone: 0

Zoom IN on 9♥: dig up to 5 cards; ♥ cards are hostile here.
  Flip 7♣: loot.
  Flip 7♠: loot.
  Flip 7♦: a key card! Take it now (pay any 7), or leave it waiting.
  Take 7♦: pay 7♥. Key row: 6♦ 7♦.
  Flip 6♣: loot.
  Flip 4♥: HOSTILE! Beat it with a higher ♥, or flee.
  Beat 4♥ with 6♥: it joins your loot.
  Flip 9♠: loot.
  You dug to the bottom: the loot and the region card 9♥ join your hand.
    ??     ??     ??    
    ??    [..]    ??    
    ??     ??     ??    
   Hand(12): 7♠ 9♠ 10♠ A♠ 2♥ 3♥ 4♥ 9♥ K♥ A♥ 6♣ 7♣
   Key row: 6♦ 7♦   Pile: 28   Gone: 2

Hand over 10: discard 2♥.
Hand over 10: discard 3♥.
Zoom OUT (pay 6♣): the whole map turns face-up.
    5♥     A♣     2♠    
    3♦    [..]    10♥   
    Q♣     5♠     5♣    
   Hand(9): 7♠ 9♠ 10♠ A♠ 4♥ 9♥ K♥ A♥ 7♣
   Key row: 6♦ 7♦   Pile: 28   Gone: 5

Move right (eat 7♣): you stand on 10♥.
    A♣     2♠     ??    
    ..    [10♥]   ??    
    5♠     5♣     ??    
   Hand(8): 7♠ 9♠ 10♠ A♠ 4♥ 9♥ K♥ A♥
   Key row: 6♦ 7♦   Pile: 28   Gone: 6

Zoom IN on 10♥: dig up to 5 cards; ♥ cards are hostile here.
  Flip 10♦: a key card! Take it now (pay any 10), or leave it waiting.
  Leave 10♦: it waits beside the pile and joins the map on your next move.
  Flip 2♦: a key card! It waits beside the pile and joins the map on your next move.
  Flip 3♠: loot.
  Flip 3♣: loot.
  Flip Q♦: a key card! It waits beside the pile and joins the map on your next move.
  Flip J♦: a key card! It waits beside the pile and joins the map on your next move.
  Flip 9♦: a key card! Take it now (pay any 9), or leave it waiting.
  Take 9♦: pay 9♠. Key row: 6♦ 7♦ 9♦.
  Flip K♠: loot.
  Flip 4♠: loot.
  Flip 8♦: a key card! It waits beside the pile and joins the map on your next move.
  Flip Q♠: loot.
  You dug to the bottom: the loot and the region card 10♥ join your hand.
    A♣     2♠     ??    
    ..    [..]    ??    
    5♠     5♣     ??    
   Hand(13): 3♠ 4♠ 7♠ 10♠ Q♠ K♠ A♠ 4♥ 9♥ 10♥ K♥ A♥ 3♣
   Key row: 6♦ 7♦ 9♦   Pile: 17   Waiting: 10♦ 2♦ Q♦ J♦ 8♦   Gone: 7

Hand over 10: discard 3♠.
Hand over 10: discard 3♣.
Hand over 10: discard 4♥.
Move up (eat 4♠): you stand on 2♠.
    10♦    2♦     Q♦    
    A♣    [2♠]    ??    
    ..     ..     ??    
   Hand(9): 7♠ 10♠ Q♠ K♠ A♠ 9♥ 10♥ K♥ A♥
   Key row: 6♦ 7♦ 9♦   Pile: 20   Waiting: J♦ 8♦   Gone: 11

Zoom IN on 2♠: dig up to 3 cards; ♠ cards are hostile here.
  Flip 8♣: loot.
  Flip 9♣: loot.
  Flip K♦: a key card! Take it now (pay any K), or leave it waiting.
  Leave K♦: it waits beside the pile and joins the map on your next move.
  Flip 8♠: HOSTILE! Beat it with a higher ♠, or flee.
  Beat 8♠ with 10♠: it joins your loot.
  You dug to the bottom: the loot and the region card 2♠ join your hand.
    10♦    2♦     Q♦    
    A♣    [..]    ??    
    ..     ..     ??    
   Hand(12): 2♠ 7♠ 8♠ Q♠ K♠ A♠ 9♥ 10♥ K♥ A♥ 8♣ 9♣
   Key row: 6♦ 7♦ 9♦   Pile: 16   Waiting: J♦ 8♦ K♦   Gone: 12

Hand over 10: discard 2♠.
Hand over 10: discard 7♠.
Move left (eat 9♥): you stand on A♣.
    J♦     10♦    2♦    
    8♦    [A♣]    ..    
    K♦     ..     ..    
   Hand(9): 8♠ Q♠ K♠ A♠ 10♥ K♥ A♥ 8♣ 9♣
   Key row: 6♦ 7♦ 9♦   Pile: 19   Gone: 15

Zoom IN on A♣: dig up to 7 cards; ♣ cards are hostile here.
  Flip J♣: HOSTILE! Beat it with a higher ♣, or flee.
  Flee from J♣: lose the loot, and it wounds you: lose 8♠.
    J♦     10♦    2♦    
    8♦    [A♣✓]   ..    
    K♦     ..     ..    
   Hand(8): Q♠ K♠ A♠ 10♥ K♥ A♥ 8♣ 9♣
   Key row: 6♦ 7♦ 9♦   Pile: 18   Gone: 17

Move left (eat 9♣): you stand on 8♦.
    ??     J♦     10♦   
    ??    [8♦]    A♣✓   
    ??     K♦     ..    
   Hand(7): Q♠ K♠ A♠ 10♥ K♥ A♥ 8♣
   Key row: 6♦ 7♦ 9♦   Pile: 16   Gone: 18

Claim 8♦: show 8♣ (you keep it). Key row: 6♦ 7♦ 8♦ 9♦.
    ??     J♦     10♦   
    ??    [..]    A♣✓   
    ??     K♦     ..    
   Hand(7): Q♠ K♠ A♠ 10♥ K♥ A♥ 8♣
   Key row: 6♦ 7♦ 8♦ 9♦   Pile: 16   Gone: 18

Zoom OUT (free: you hold your key): the whole map turns face-up.
    2♣     J♦     10♦   
    4♦    [..]    A♣✓   
    4♣     K♦     ..    
   Hand(7): Q♠ K♠ A♠ 10♥ K♥ A♥ 8♣
   Key row: 6♦ 7♦ 8♦ 9♦   Pile: 16   Gone: 18

Move left (eat 8♣): you stand on 4♦.
    ??     2♣     J♦    
    ??    [4♦]    ..    
    ??     4♣     K♦    
   Hand(6): Q♠ K♠ A♠ 10♥ K♥ A♥
   Key row: 6♦ 7♦ 8♦ 9♦   Pile: 15   Gone: 19

Zoom OUT (free: you hold your key): the whole map turns face-up.
    8♥     2♣     J♦    
    A♦    [4♦]    ..    
    6♠     4♣     K♦    
   Hand(6): Q♠ K♠ A♠ 10♥ K♥ A♥
   Key row: 6♦ 7♦ 8♦ 9♦   Pile: 15   Gone: 19

Move left (eat 10♥): you stand on A♦.
    ??     8♥     2♣    
    ??    [A♦]    4♦    
    ??     6♠     4♣    
   Hand(5): Q♠ K♠ A♠ K♥ A♥
   Key row: 6♦ 7♦ 8♦ 9♦   Pile: 14   Gone: 20

You stand on the finish card holding your key: YOU WIN!

RESULT: WIN after 39 actions.
```
