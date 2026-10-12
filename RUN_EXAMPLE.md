# Example run (bot-played, seed 106, rules v2)

Regenerate with `node sim.mjs run heur 106`.
Grid legend: `[ ]` = where you stand, `??` = face-down, `..` = empty spot.
Moving slides the window: the far row/column goes to BEHIND, 3 new face-down cards enter on the near side.
Every spread is looted completely (rule v2: take every card you can pay for). Note the win comes right after lap 2 starts.

```
LOCK card 5♠ -> need 4 consecutive ♠ (finish card = A♠)

START
    ??    ??    ??   
    ??   [ Q♥]  ??   
    ??    ??    ??   
   Hand(5): 5♣ 10♣ Q♣ K♣ A♣
   Pile: 38   Behind: 0   Gone: 0   Lap: 1 (zoom costs 1)

Zoom IN on Q♥: spend 5♣, spread 3 cards: K♦ 8♣ 7♥
  Take K♦ (treasure) -> hand.
  Take 7♥ (ally) -> hand.
  Take 8♣ (obstacle): swap it for 10♣ from your hand.
  Site cleared: region Q♥ joins your hand.
Zoom OUT: spend 7♥ to survey the whole map.
    2♦    10♦   K♠   
    6♦   [ ..]  10♠  
    5♦    2♠    9♣   
   Hand(6): Q♥ K♦ 8♣ Q♣ K♣ A♣
   Pile: 35   Behind: 0   Gone: 3   Lap: 1 (zoom costs 1)

Move right. You arrive at 10♠.
    10♦   K♠    ??   
    ..   [10♠]  ??   
    2♠    9♣    ??   
   Hand(6): Q♥ K♦ 8♣ Q♣ K♣ A♣
   Pile: 32   Behind: 3   Gone: 3   Lap: 1 (zoom costs 1)

Zoom IN on 10♠: spend 8♣, spread 2 cards: 3♣ 9♠
  Take 3♣ (obstacle): swap it for Q♣ from your hand.
  Take 9♠ (monster, strength 5): beat it with Q♥; it joins your hand.
  Site cleared: region 10♠ joins your hand.
Move up. You arrive at K♠.
    ??    ??    ??   
    10♦  [ K♠]  ??   
    ..    ..    ??   
   Hand(6): 9♠ 10♠ K♦ 3♣ K♣ A♣
   Pile: 27   Behind: 6   Gone: 6   Lap: 1 (zoom costs 1)

Zoom IN on K♠: spend 3♣, spread 3 cards: 9♥ Q♦ A♥
  Take 9♥ (ally) -> hand.
  Take Q♦ (treasure) -> hand.
  Take A♥ (ally) -> hand.
  Site cleared: region K♠ joins your hand.
Move up. You arrive at 7♦.
    ??    ??    ??   
    ??   [ 7♦]  ??   
    10♦   ..    ??   
   Hand(8): 9♠ 10♠ K♠ A♥ Q♦ K♦ K♣ A♣
   Pile: 21   Behind: 7   Gone: 8   Lap: 1 (zoom costs 1)

Zoom IN on 7♦: spend Q♦, spread 2 cards: 5♠ 6♣
  Take 5♠ (monster, strength 3): beat it with K♣; it joins your hand.
  Take 6♣ (obstacle): swap it for A♣ from your hand.
  Site cleared: region 7♦ joins your hand.
Zoom OUT: spend 6♣ to survey the whole map.
    4♠    J♦    2♣   
    5♥   [ ..]  J♥   
    10♦   ..    7♠   
   Hand(7): 5♠ 9♠ 10♠ K♠ A♥ 7♦ K♦
   Pile: 19   Behind: 7   Gone: 12   Lap: 1 (zoom costs 1)

Move up. You arrive at J♦.
    ??    ??    ??   
    4♠   [ J♦]  2♣   
    5♥    ..    J♥   
   Hand(7): 5♠ 9♠ 10♠ K♠ A♥ 7♦ K♦
   Pile: 16   Behind: 9   Gone: 12   Lap: 1 (zoom costs 1)

Zoom IN on J♦: spend 7♦, spread 3 cards: 6♠ 7♣ 6♥
  Take 6♥ (ally) -> hand.
  Take 6♠ (monster, strength 3): beat it with 6♥; it joins your hand.
  Take 7♣ (obstacle): swap it for K♦+A♥ from your hand.
  Site cleared: region J♦ joins your hand.
Move left. You arrive at 4♠.
    ??    ??    ??   
    ??   [ 4♠]  ..   
    ??    5♥    ..   
   Hand(7): 5♠ 6♠ 9♠ 10♠ K♠ J♦ 7♣
   Pile: 10   Behind: 12   Gone: 16   Lap: 1 (zoom costs 1)

Zoom IN on 4♠: spend 7♣, spread 1 card: 3♠
  Take 3♠ (monster, strength 2): beat it with J♦; it joins your hand.
  Site cleared: region 4♠ joins your hand.
Move left. You arrive at Q♠.
    ??    ??    ??   
    ??   [ Q♠]  ..   
    ??    ??    5♥   
   Hand(7): 3♠ 4♠ 5♠ 6♠ 9♠ 10♠ K♠
   Pile: 6   Behind: 13   Gone: 18   Lap: 1 (zoom costs 1)

Zoom IN on Q♠: spend 9♠, spread 3 cards: 8♦ 4♣ J♣
  Take 8♦ (treasure) -> hand.
  Take 4♣ (obstacle): swap it for 10♠ from your hand.
  Take J♣ (obstacle): swap it for 4♣ from your hand.
  Site cleared: region Q♠ joins your hand.
Zoom OUT: spend 8♦ to survey the whole map.
    2♥    3♦    A♠   
    K♥   [ ..]  ..   
    J♠    8♥    5♥   
   Hand(7): 3♠ 4♠ 5♠ 6♠ Q♠ K♠ J♣
   Pile: 3   Behind: 13   Gone: 22   Lap: 1 (zoom costs 1)

Move up. You arrive at 3♦.
    ??    ??    ??   
    2♥   [ 3♦]  A♠   
    K♥    ..    ..   
   Hand(7): 3♠ 4♠ 5♠ 6♠ Q♠ K♠ J♣
   Pile: 0   Behind: 16   Gone: 22   Lap: 1 (zoom costs 1)

Move right. You arrive at A♠.
    ??    ??    ??   
    3♦   [ A♠]  ??   
    ..    ..    ??   
   Hand(7): 3♠ 4♠ 5♠ 6♠ Q♠ K♠ J♣
   Pile: 13   Behind: 3   Gone: 22   Lap: 2 (zoom costs 2)

The finish card is the middle card and you hold your key: YOU WIN.

RESULT: WIN after 36 actions.     ??    ??    ??   
    3♦   [ A♠]  ??   
    ..    ..    ??   
   Hand(7): 3♠ 4♠ 5♠ 6♠ Q♠ K♠ J♣
   Pile: 13   Behind: 3   Gone: 22   Lap: 2 (zoom costs 2)
```
