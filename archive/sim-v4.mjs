// Fallaway — ARCHIVED v4 simulator with every rule variant tested while designing v4 (see DESIGN_NOTES.md). It reimplements the rules
// on its own; the live simulator is sim/sim.ts, which plays the app's engine (core/engine.ts). Run this one as `node archive/sim-v4.mjs ...`.
// Known bug, kept so old results reproduce: with SIMPLE=pay, `mix` pays a card for every dig (digging is free), so `swap pay` reads ~10%; the true value is ~24%.
// Usage: node sim.mjs [careful|beginner|random|mix|mc] [games=2000] [seed0=1]   -> win rate + game stats
//        node sim.mjs report [games]      -> skill ladder (careful / beginner / random) + what each decision is worth
//        node sim.mjs bylock [games]      -> win rate by lock rank and key suit (fairness)
//        node sim.mjs luck [deals] [n]    -> replay each deal n times with 5% random moves: how many deals can be won at all
//        node sim.mjs run [policy] [seed] -> narrated game (the old RUN_EXAMPLE.md)
//        BIOME=1|2 node sim.mjs biome [games] -> biome test: skill ladder, what steering by biome is worth, which biomes get dug
// Rule knobs are env vars; the defaults are the adopted rules (START=9 LIMIT=10; there are no difficulty levels).
// The other knobs are the alternatives tested while designing (see DESIGN_NOTES.md), e.g. EDGE=gone, FIGHT=one, WOUND=0.

const GLYPH = ['♠', '♥', '♦', '♣'];
const RK = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const suit = (c) => c & 3;
const rank = (c) => (c >> 2) + 2;
const nm = (c) => (c < 0 ? '..' : (RK[rank(c)] ?? rank(c)) + GLYPH[suit(c)]);
const E = process.env;

export const P = {
  START: +(E.START ?? 9), // starting hand
  LIMIT: +(E.LIMIT ?? 10), // hand limit
  L: +(E.L ?? 4), // key run length
  EDGE: E.EDGE ?? 'bottom', // map cards that fall off the edge: 'gone' (the world crumbles) | 'bottom' (under the pile)
  DEPTH: (E.DEPTH ?? '3,5,7').split(',').map(Number), // dig depth for region rank 2-5 / 6-10 / J-A
  FIGHT: E.FIGHT ?? 'suit', // 'one': one card of higher rank | 'sum': cards totalling more | 'one2': one higher card or two that total more
  TIE: +(E.TIE ?? 0), // 1: an equal rank also wins
  FLEE: E.FLEE ?? 'gone', // where a fled dig's cards go: 'gone' | 'bottom'
  WOUND: +(E.WOUND ?? 1), // random hand cards lost when you flee
  CLEAR: +(E.CLEAR ?? 1), // dig to full depth: the region card joins your hand
  ZCOST: +(E.ZCOST ?? 0), // zoom-in cost
  MOVE_COST: +(E.MOVE_COST ?? 1), // hand cards each step costs (supplies)
  SCOST: +(E.SCOST ?? 1), // zoom-out cost
  FREE_SCOUT: +(E.FREE_SCOUT ?? 1), // zooming out is free once you hold the key
  LOCK_ROW: +(E.LOCK_ROW ?? 1), // the lock card starts your key row
  VAULT: E.VAULT ? E.VAULT.split(',').map(Number) : null, // finish card depth range in the pile; default: it is just shuffled into the deck
  BIOME: +(E.BIOME ?? 0), // 1: digging a region to the bottom pays by its suit: ♥ food, ♠ sight, ♦ pick from the gone pile, ♣ free steps
  //                         2: every dig you do not flee pays a small bonus by its suit: ♥ a pile card, ♠ map face-up, ♦ trade a hand card for a gone card, ♣ a free step
  STEPS: +(E.STEPS ?? 2), // free steps a cleared ♣ region gives (BIOME=1)
  TRAIL: +(E.TRAIL ?? 0), // 1: digging a region to the bottom, if its rank matches a key card you still need, pulls that key card out of the pile onto the map
  UP: +(E.UP ?? 0), // 1: test only: map cards always come in face-up (is seeing the biomes what makes them matter?)
  BLIND: +(E.BLIND ?? 0), // 1: the careful bot ignores what each biome pays (to measure what biome choice is worth)
  MAX_STEPS: 600,
};
const depthOf = (c) => P.DEPTH[rank(c) <= 5 ? 0 : rank(c) <= 10 ? 1 : 2];

function mkRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(a, R) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- state ----------
// pile: top = end. wait: key/finish cards met while digging, dealt first on the next move.
export function newGame(seed) {
  const R = mkRng(seed);
  const deck = shuffle([...Array(52).keys()], R);
  const lock = deck.splice(deck.findIndex((c) => rank(c) !== 14), 1)[0];
  const S = suit(lock), vault = (12 << 2) | S;
  if (P.VAULT) deck.splice(deck.indexOf(vault), 1);
  const s = {
    R, S, lock, vault, pile: [], wait: [], gone: [], hand: [], keys: P.LOCK_ROW ? [lock] : [],
    gc: [], gup: Array(9).fill(0), gdone: Array(9).fill(0), dig: null, over: null, steps: 0,
    free: 0, // free steps left (♣ paths)
    seen: new Uint8Array(52), stats: { fights: 0, flees: 0, flips: 0, digs: 0, moves: 0, scouts: 0, claims: 0, lostKeys: 0, wounds: 0, skips: 0, digsBy: [0, 0, 0, 0], clearsBy: [0, 0, 0, 0] },
  };
  if (!P.LOCK_ROW) deck.push(lock); // variant: the lock is just a marker and goes back
  // starting hand: set the key suit aside, deal from the rest, then shuffle the key suit back in
  const keySuit = deck.filter((c) => suit(c) === S);
  const rest = deck.filter((c) => suit(c) !== S);
  s.hand = rest.splice(0, P.START);
  deck.splice(0, deck.length, ...shuffle([...rest, ...keySuit], R));
  s.gc = deck.splice(0, 9);
  if (P.VAULT) deck.splice(Math.min(P.VAULT[0] + Math.floor(R() * (P.VAULT[1] - P.VAULT[0] + 1)), deck.length), 0, vault);
  s.pile = deck.reverse();
  s.seen[lock] = 1;
  for (const c of s.hand) s.seen[c] = 1;
  reveal(s, 4);
  return s;
}
export const isKey = (s, c) => c >= 0 && suit(c) === s.S && c !== s.vault && c !== s.lock;
function clone(s, R) {
  return {
    ...s, R: R ?? s.R, pile: s.pile.slice(), wait: s.wait.slice(), gone: s.gone.slice(), hand: s.hand.slice(), keys: s.keys.slice(),
    gc: s.gc.slice(), gup: s.gup.slice(), gdone: s.gdone.slice(), dig: s.dig && { ...s.dig, loot: s.dig.loot.slice() },
    seen: s.seen.slice(), stats: { ...s.stats, digsBy: s.stats.digsBy.slice(), clearsBy: s.stats.clearsBy.slice() },
  };
}
function reveal(s, i) { if (!s.gup[i] && s.gc[i] >= 0) { s.gup[i] = 1; s.seen[s.gc[i]] = 1; } }

// ---------- key ----------
/** best run of L consecutive key-suit ranks (2..K) still possible; the key row cards it has; what it misses */
export function plan(s) {
  const of = (r) => (r - 2) * 4 + s.S;
  const held = new Set(s.keys.map(rank));
  const vis = new Set();
  s.gc.forEach((c, i) => { if (s.gup[i] && isKey(s, c)) vis.add(rank(c)); });
  for (const c of s.wait) if (isKey(s, c)) vis.add(rank(c));
  let best = null, bs = -1;
  const all = [];
  for (let a = 2; a + P.L - 1 <= 13; a++) {
    const ranks = Array.from({ length: P.L }, (_, k) => a + k);
    if (ranks.some((r) => !held.has(r) && (s.gone.includes(of(r)) || (!P.LOCK_ROW && of(r) === s.lock)))) continue; // dead run
    const have = ranks.filter((r) => held.has(r)).length;
    const sc = have + 0.35 * ranks.filter((r) => !held.has(r) && vis.has(r)).length;
    all.push({ ranks, sc });
    if (sc > bs + 1e-9) { bs = sc; best = ranks; }
  }
  const want = new Set();
  for (const x of all) if (x.sc >= bs - 0.5) for (const r of x.ranks) if (!held.has(r)) want.add(r);
  return { best, want, vis, held, alive: all.length > 0 };
}
export function keyCount(s) {
  const held = new Set(s.keys.filter((c) => suit(c) === s.S).map(rank));
  let best = 0;
  for (let a = 2; a + P.L - 1 <= 13; a++) { let h = 0; for (let r = a; r < a + P.L; r++) if (held.has(r)) h++; best = Math.max(best, h); }
  return best;
}
export const hasKey = (s) => keyCount(s) >= P.L;

// ---------- hand values ----------
/** keep-value of each hand card: ranks that open wanted key cards (more if visible), plus fighting strength */
export function keepVals(s, hand = s.hand) {
  const { want, vis } = plan(s);
  return hand.map((c) => 1 + (rank(c) - 2) / 12 * 0.6 + (want.has(rank(c)) ? (vis.has(rank(c)) ? 3 : 1) : 0));
}
const beats = (c, h) => (P.FIGHT !== 'suit' && P.FIGHT !== 'suit2' || suit(c) === suit(h)) && (rank(c) > rank(h) || (P.TIE && rank(c) === rank(h)));
/** cheapest way to beat hostile h: indices into hand, by keep-value */
export function cheapestFight(s, h, kv = keepVals(s)) {
  let best = null, bc = Infinity;
  const n = s.hand.length;
  if (P.FIGHT !== 'sum') for (let i = 0; i < n; i++) if (beats(s.hand[i], h) && kv[i] < bc) { bc = kv[i]; best = [i]; }
  if (P.FIGHT === 'one2' || P.FIGHT === 'suit2') for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rank(s.hand[i]) + rank(s.hand[j]) > rank(h) && kv[i] + kv[j] < bc) { bc = kv[i] + kv[j]; best = [i, j]; }
  if (P.FIGHT === 'sum') for (let m = 1; m < 1 << n; m++) {
    let t = 0, c = 0;
    for (let i = 0; i < n; i++) if (m >> i & 1) { t += rank(s.hand[i]); c += kv[i]; }
    if (t > rank(h) && c < bc) { bc = c; best = [...Array(n).keys()].filter((i) => m >> i & 1); }
  }
  return best && { pay: best, cost: bc };
}
const lowest = (s, k) => { const kv = keepVals(s); return [...kv.keys()].sort((a, b) => kv[a] - kv[b]).slice(0, k); };

// ---------- actions ----------
const DIRS = ['up', 'down', 'left', 'right'];
const TARGET = [1, 7, 3, 5];
const EDGE_CELLS = [[6, 7, 8], [0, 1, 2], [2, 5, 8], [0, 3, 6]];
const scoutCost = (s) => (hasKey(s) && P.FREE_SCOUT ? 0 : P.SCOST);
export function legal(s) {
  if (s.over) return [];
  if (s.dig) {
    const d = s.dig, acts = [];
    if (d.hostile >= 0) {
      if (cheapestFight(s, d.hostile)) acts.push({ t: 'fight' });
      acts.push({ t: 'flee' });
      return acts;
    }
    if (d.flips < d.depth && s.pile.length) acts.push({ t: 'flip' });
    acts.push({ t: 'stop' });
    return acts;
  }
  if (s.hand.length > P.LIMIT) return s.hand.map((_, i) => ({ t: 'discard', i }));
  const acts = [], c = s.gc[4];
  if (c === s.vault && hasKey(s)) acts.push({ t: 'finish' });
  if (isKey(s, c) && s.hand.some((x) => rank(x) === rank(c))) acts.push({ t: 'claim' });
  if (c >= 0 && s.gup[4] && !s.gdone[4] && !isKey(s, c) && c !== s.vault && s.hand.length >= P.ZCOST && s.pile.length) acts.push({ t: 'zoom' });
  if (s.hand.length >= scoutCost(s) && s.gup.some((u, i) => !u && s.gc[i] >= 0)) acts.push({ t: 'scout' });
  if (s.hand.length >= P.MOVE_COST || s.free > 0) for (let d = 0; d < 4; d++) acts.push({ t: 'move', d });
  return acts;
}
function draw(s) { return s.pile.length ? s.pile.pop() : -1; }
function spend(s, idx) {
  const out = [...idx].sort((a, b) => b - a).map((i) => s.hand.splice(i, 1)[0]);
  s.gone.push(...out);
  return out;
}
function endDig(s, cleared) {
  const d = s.dig, r = s.gc[4];
  for (const c of d.loot) s.hand.push(c);
  if (cleared && P.CLEAR) { s.gc[4] = -1; s.gdone[4] = 2; s.stats.clearsBy[suit(r)]++; if (P.BIOME === 1) biome(s, r); else s.hand.push(r); } else s.gdone[4] = 1;
  if (P.BIOME === 2) bonus(s, suit(r));
  if (cleared && P.TRAIL) { // the trail: search the pile for the key card of the region's rank
    const k = ((rank(r) - 2) << 2) | s.S, i = s.pile.indexOf(k);
    if (i >= 0 && isKey(s, k)) { s.pile.splice(i, 1); s.wait.push(k); s.seen[k] = 1; s.stats.trails = (s.stats.trails ?? 0) + 1; shuffle(s.pile, s.R); }
  }
  s.dig = null;
}
/** TRAIL=1: clearing this region would pull a wanted key card out of the pile */
function trailVal(s, c, pl = plan(s)) {
  if (!P.TRAIL || P.BLIND) return 0;
  const k = ((rank(c) - 2) << 2) | s.S;
  return pl.want.has(rank(c)) && !s.seen[k] && isKey(s, k) ? 3 : 0;
}
/** BIOME=2: the small bonus every dig you do not flee pays, by the region's suit */
function bonus(s, su) {
  if (su === 1) { // ♥: the next pile card joins your hand
    let c = draw(s);
    while (c >= 0 && (c === s.vault || isKey(s, c))) { s.wait.push(c); s.seen[c] = 1; c = draw(s); }
    if (c >= 0) { s.hand.push(c); s.seen[c] = 1; }
  } else if (su === 0) for (let i = 0; i < 9; i++) reveal(s, i); // ♠: the whole map turns face-up
  else if (su === 2) { // ♦: you may swap one hand card for one card of the gone pile
    const t = tradeOf(s);
    if (t) { const c = s.gone.splice(t.g, 1)[0]; s.gone.push(s.hand.splice(t.h, 1)[0]); s.hand.push(c); }
  } else s.free += 1; // ♣: your next move costs no food
}
/** ♦ trade: the best gone card for your least needed hand card, if it gains anything */
function tradeOf(s) {
  if (!s.gone.length || !s.hand.length) return null;
  const kv = keepVals(s, [...s.hand, ...s.gone]), n = s.hand.length;
  let h = 0, g = n;
  for (let i = 1; i < n; i++) if (kv[i] < kv[h]) h = i;
  for (let i = n + 1; i < kv.length; i++) if (kv[i] > kv[g]) g = i;
  return kv[g] > kv[h] ? { h, g: g - n, gain: kv[g] - kv[h] } : null;
}
/** BIOME=2: what a dig's bonus is worth right now (keep-value units) */
function bonusVal(s, r) {
  const su = suit(r);
  if (su === 1) return 1.3 + (s.hand.length <= 4 ? 0.8 : 0);
  if (su === 0) return hasKey(s) && P.FREE_SCOUT ? 0 : Math.min(1.4, 0.25 * s.gup.filter((u, i) => !u && s.gc[i] >= 0 && i !== 4).length);
  if (su === 2) return tradeOf(s)?.gain ?? 0;
  return Math.min(...keepVals(s), 1.2) + (s.hand.length <= 3 ? 1 : 0);
}
/** how much a region's biome pulls the careful bot toward it */
const biomePull = (s, c) => (P.BLIND || !P.BIOME ? 0 : P.BIOME === 1 ? CLEAR_P[depthOf(c)] * (biomeVal(s, c) - 1.6) : bonusVal(s, c));
/** BIOME=1: what a region dug to the bottom pays, by its suit */
function biome(s, r) {
  const su = suit(r);
  if (su === 1) { // ♥ farmland: food. The region card and the next pile card join your hand.
    s.hand.push(r);
    let c = draw(s);
    while (c >= 0 && (c === s.vault || isKey(s, c))) { s.wait.push(c); s.seen[c] = 1; c = draw(s); }
    if (c >= 0) { s.hand.push(c); s.seen[c] = 1; }
  } else if (su === 0) { // ♠ ruins: sight. The region card joins your hand and the whole map turns face-up.
    s.hand.push(r);
    for (let i = 0; i < 9; i++) reveal(s, i);
  } else if (su === 2) { // ♦ mines: the region card goes to the gone pile, then take any one card from it
    s.gone.push(r);
    const kv = keepVals(s, s.gone);
    let b = 0;
    kv.forEach((v, i) => { if (v > kv[b]) b = i; });
    s.hand.push(s.gone.splice(b, 1)[0]);
  } else { s.gone.push(r); s.free += P.STEPS; } // ♣ forest: a path. Your next STEPS moves cost no food.
}
/** BIOME=1: what clearing a region of this suit is worth right now (keep-value units; 1.6 = the old "region card joins your hand") */
function biomeVal(s, r) {
  if (P.BIOME !== 1 || P.BLIND) return 1.6;
  const su = suit(r), card = keepVals(s, [r])[0];
  if (su === 1) return card + 1.3 + (s.hand.length <= 4 ? 0.8 : 0);
  if (su === 0) return card + (hasKey(s) && P.FREE_SCOUT ? 0 : Math.min(1.4, 0.25 * s.gup.filter((u, i) => !u && s.gc[i] >= 0 && i !== 4).length));
  if (su === 2) return Math.max(card, ...keepVals(s, s.gone));
  const kv = keepVals(s).sort((a, b) => a - b);
  return P.STEPS * (kv.length ? (kv[0] + (kv[1] ?? kv[0])) / 2 : 1.2) + (s.hand.length <= 3 ? 1 : 0);
}
export function apply(s, a, say) {
  say = say ?? (() => {});
  s.steps++;
  switch (a.t) {
    case 'move': {
      const freeStep = s.free > 0;
      if (freeStep) s.free--;
      const fed = P.MOVE_COST && !freeStep ? spend(s, a.pay ?? lowest(s, P.MOVE_COST)) : [];
      const old = s.gc, ou = s.gup, od = s.gdone;
      const nc = Array(9).fill(-1), nu = Array(9).fill(0), nd = Array(9).fill(0);
      const put = (to, from) => { nc[to] = old[from]; nu[to] = ou[from]; nd[to] = od[from]; };
      const d = a.d, inc = [];
      if (d === 0) { for (let i = 0; i < 6; i++) put(i + 3, i); inc.push(0, 1, 2); }
      if (d === 1) { for (let i = 0; i < 6; i++) put(i, i + 3); inc.push(6, 7, 8); }
      if (d === 2) for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) put(r * 3 + c + 1, r * 3 + c); inc.push(r * 3); }
      if (d === 3) for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) put(r * 3 + c, r * 3 + c + 1); inc.push(r * 3 + 2); }
      const fell = EDGE_CELLS[d].map((i) => old[i]).filter((c) => c >= 0);
      for (const c of fell) if (isKey(s, c)) s.stats.lostKeys += plan(s).want.has(rank(c)) ? 1 : 0;
      if (P.EDGE === 'gone') s.gone.push(...fell); else s.pile.unshift(...fell);
      for (const i of inc) {
        const waited = s.wait.length > 0; // cards met while digging come back face-up
        const c = waited ? s.wait.shift() : draw(s);
        if (c < 0) { s.over = 'lose'; s.why = 'world'; say('The pile is empty: there is no world left to walk into. You lose.'); return; }
        nc[i] = c; nu[i] = waited || P.UP ? 1 : 0;
        if (P.UP) s.seen[c] = 1;
      }
      s.gc = nc; s.gup = nu; s.gdone = nd;
      reveal(s, 4);
      s.stats.moves++;
      say(`Move ${DIRS[d]}${fed.length ? ` (eat ${fed.map(nm).join('+')})` : freeStep ? ' (free: path)' : ''}: ${fell.length ? `${fell.length} card${fell.length > 1 ? 's fall' : ' falls'} off the edge, under the pile. ` : ''}You stand on ${s.gc[4] >= 0 ? nm(s.gc[4]) : 'an empty spot'}.`);
      break;
    }
    case 'scout': {
      const paid = spend(s, lowest(s, scoutCost(s)));
      for (let i = 0; i < 9; i++) reveal(s, i);
      s.stats.scouts++;
      say(`Zoom OUT${paid.length ? ` (pay ${paid.map(nm).join('+')})` : ' (free)'}: the whole map turns face-up.`);
      break;
    }
    case 'zoom': {
      const paid = spend(s, a.pay ?? lowest(s, P.ZCOST));
      s.dig = { depth: depthOf(s.gc[4]), flips: 0, loot: [], hostile: -1, hs: suit(s.gc[4]) };
      s.stats.digs++; s.stats.digsBy[suit(s.gc[4])]++;
      say(`Zoom IN on ${nm(s.gc[4])}${paid.length ? ` (pay ${paid.map(nm).join('+')})` : ''}: dig up to ${s.dig.depth} cards; ${GLYPH[s.dig.hs]} cards are hostile here.`);
      break;
    }
    case 'flip': {
      const d = s.dig;
      let c = draw(s);
      while (c >= 0 && (c === s.vault || isKey(s, c))) { s.wait.push(c); s.seen[c] = 1; say(`  Flip ${nm(c)}: ${c === s.vault ? 'the finish card' : 'a key card'}! It waits beside the pile and enters the map on your next move.`); c = draw(s); }
      if (c < 0) { endDig(s, false); say('  The pile is empty: the dig ends.'); break; }
      s.seen[c] = 1;
      d.flips++;
      s.stats.flips++;
      if (suit(c) === d.hs) { d.hostile = c; say(`  Flip ${nm(c)}: HOSTILE! Beat it or flee.`); break; }
      d.loot.push(c);
      say(`  Flip ${nm(c)}: loot.`);
      if (d.flips >= d.depth) { const r = s.gc[4]; endDig(s, true); say(`  Dug to the bottom: loot and the region ${nm(r)} join your hand.`); }
      break;
    }
    case 'fight': {
      const d = s.dig, h = d.hostile, f = a.pay ? { pay: a.pay } : cheapestFight(s, h);
      const paid = spend(s, f.pay);
      d.loot.push(h); d.hostile = -1;
      s.stats.fights++;
      say(`  Beat ${nm(h)} with ${paid.map(nm).join('+')}: it joins your loot.`);
      if (d.flips >= d.depth) { const r = s.gc[4]; endDig(s, true); say(`  Dug to the bottom: loot and the region ${nm(r)} join your hand.`); }
      break;
    }
    case 'flee': {
      const d = s.dig, lost = [...d.loot, d.hostile];
      if (P.FLEE === 'gone') s.gone.push(...lost); else s.pile.unshift(...lost);
      const hurt = [];
      for (let k = 0; k < P.WOUND && s.hand.length; k++) hurt.push(s.hand.splice(Math.floor(s.R() * s.hand.length), 1)[0]);
      s.gone.push(...hurt);
      s.stats.flees++; s.stats.wounds += hurt.length;
      s.gdone[4] = 1; s.dig = null;
      say(`  Flee from ${nm(lost[lost.length - 1])}: the dig's loot is lost${hurt.length ? `, and it wounds you: lose ${hurt.map(nm).join('+')}` : ''}.`);
      break;
    }
    case 'stop': {
      const n = s.dig.loot.length;
      endDig(s, false);
      say(`  Stop digging: ${n} card${n === 1 ? ' joins' : 's join'} your hand.`);
      break;
    }
    case 'discard': { const [c] = spend(s, [a.i]); say(`Hand over ${P.LIMIT}: discard ${nm(c)}.`); break; }
    case 'claim': {
      const c = s.gc[4], kv = keepVals(s);
      let w = -1;
      s.hand.forEach((x, i) => { if (rank(x) === rank(c) && (w < 0 || kv[i] < kv[w])) w = i; });
      s.keys.push(c); s.gc[4] = -1; s.gdone[4] = 2;
      s.stats.claims++;
      say(`Claim ${nm(c)} by showing ${nm(s.hand[w])}. Key row: ${s.keys.slice().sort((x, y) => rank(x) - rank(y)).map(nm).join(' ')}.`);
      break;
    }
    case 'finish': s.over = 'win'; say('You stand on the finish card holding your key: YOU WIN.'); break;
  }
  if (!s.over && !s.dig && !hasKey(s) && !plan(s).alive) { s.over = 'lose'; s.why = 'dead'; say('Every possible run has a card gone for good. You lose.'); }
}

// ---------- policies ----------
function unseenStats(s, hs) {
  // cards the player has not seen: candidates for the next flip (key cards and the finish card are skipped by a dig)
  // only what the player can see right now counts as known (same as the app's advisor)
  const known = new Set([s.lock, ...s.hand, ...s.keys, ...s.gone, ...s.wait, ...s.gc.filter((c, i) => c >= 0 && s.gup[i]), ...(s.dig ? [...s.dig.loot, s.dig.hostile] : [])]);
  let n = 0, hos = [];
  for (let c = 0; c < 52; c++) {
    if (known.has(c) || suit(c) === s.S) continue;
    n++;
    if (suit(c) === hs) hos.push(c);
  }
  return { p: n ? hos.length / n : 0, hos };
}
/** chance that the next flip is a hostile you cannot beat */
export function bustP(s) {
  const { p, hos } = unseenStats(s, s.dig.hs);
  return hos.length ? p * hos.filter((h) => !cheapestFight(s, h)).length / hos.length : 0;
}
/** how valuable one pile card (time) is: rises as the pile shrinks relative to what is still needed */
function timeVal(s) {
  const need = P.L - keyCount(s);
  return 0.04 + 0.5 * Math.max(0, (need * 6 + 6) / Math.max(4, s.pile.length) - 0.6);
}
const lootVal = (s, cs) => { if (!cs.length) return 0; const kv = keepVals(s, [...s.hand, ...cs]); return kv.slice(s.hand.length).reduce((a, x) => a + x, 0); };

const C = { PUSH: +(E.C_PUSH ?? 0), FIGHT: +(E.C_FIGHT ?? 0) }; // tuning offsets for the careful bot

function carefulDig(s, acts) {
  const d = s.dig;
  if (d.hostile >= 0) {
    const f = acts.some((a) => a.t === 'fight') && cheapestFight(s, d.hostile);
    const keep = lootVal(s, [...d.loot, d.hostile]) + (d.flips >= d.depth && P.CLEAR ? lootVal(s, [s.gc[4]]) : 0);
    const woundCost = P.WOUND && s.hand.length ? P.WOUND * keepVals(s).reduce((a, x) => a + x, 0) / s.hand.length : 0;
    return f && f.cost < keep + woundCost + 0.6 + C.FIGHT ? { t: 'fight', pay: f.pay } : { t: 'flee' };
  }
  if (!acts.some((a) => a.t === 'flip')) return { t: 'stop' };
  const { p, hos } = unseenStats(s, d.hs);
  const kv = keepVals(s);
  const winP = hos.length ? hos.filter((h) => cheapestFight(s, h, kv)).length / hos.length : 1;
  const fightCost = hos.length ? hos.reduce((a, h) => { const f = cheapestFight(s, h, kv); return a + (f ? f.cost : 0); }, 0) / Math.max(1, hos.filter((h) => cheapestFight(s, h, kv)).length) : 0;
  const atRisk = lootVal(s, d.loot);
  const last = d.flips + 1 >= d.depth && P.CLEAR ? biomeVal(s, s.gc[4]) + trailVal(s, s.gc[4]) : 0; // reaching the bottom also wins the region's reward
  const good = 1.3 + last;
  const hostileOutcome = winP * Math.max(1.3 + last - fightCost, -atRisk - 0.2) + (1 - winP) * (-atRisk - P.WOUND * 1.4);
  const ev = (1 - p) * good + p * hostileOutcome - timeVal(s);
  return ev > 0.05 + C.PUSH ? { t: 'flip' } : { t: 'stop' };
}
const BW = +(E.BW ?? 1); // how much the careful bot steers toward the biome it needs
const TW = +(E.TW ?? 1); // how much the careful bot steers toward trail regions
const SAFE = +(E.SAFE ?? 2); // how much the careful bot steers toward regions whose hostiles its hand can beat
/** chance a hostile of this region's suit can be beaten with your hand (1 = the region is safe for you) */
function safety(s, c) {
  const { hos } = unseenStats(s, suit(c));
  if (!hos.length) return 1;
  const kv = keepVals(s);
  return hos.filter((h) => cheapestFight(s, h, kv)).length / hos.length;
}
const CLEAR_P = { 3: 0.6, 4: 0.45, 5: 0.35, 6: 0.25, 7: 0.2 }; // rough chance a dig reaches the bottom
function cellScore(s, i, pl) {
  const c = s.gc[i];
  if (c < 0) return 0;
  if (!s.gup[i]) return 2.2;
  if (c === s.vault) return hasKey(s) ? 900 : keyCount(s) >= P.L - 1 ? 6 : 1;
  if (isKey(s, c)) return !pl.want.has(rank(c)) ? 0.3 : s.hand.some((x) => rank(x) === rank(c)) ? 40 : 4;
  if (s.gdone[i]) return 0.2;
  return 1.5 + 0.9 * depthOf(c) + BW * biomePull(s, c) + TW * CLEAR_P[depthOf(c)] * trailVal(s, c, pl) + (SAFE ? SAFE * depthOf(c) * (safety(s, c) - 0.5) : 0); // biome: what it pays you now, and how safe it is for you
}
function carefulMove(s, moves) {
  const pl = plan(s), keyed = hasKey(s);
  let vi = -1;
  for (let i = 0; i < 9; i++) if (s.gup[i] && s.gc[i] === s.vault) vi = i;
  let best = null, bs = -Infinity;
  for (const m of moves) {
    // value of the cell you step on and the row/column you move toward, minus what falls off behind you
    const ahead = [[0, 1, 2], [6, 7, 8], [0, 3, 6], [2, 5, 8]][m.d];
    let sc = 1.0 * cellScore(s, TARGET[m.d], pl) + 0.3 * ahead.reduce((a, i) => a + cellScore(s, i, pl), 0) - 0.45 * EDGE_CELLS[m.d].reduce((a, i) => a + cellScore(s, i, pl), 0);
    if (keyed && vi >= 0) { const r = Math.floor(vi / 3), c = vi % 3; if ((m.d === 0 && r < 1) || (m.d === 1 && r > 1) || (m.d === 2 && c < 1) || (m.d === 3 && c > 1)) sc += 100; }
    sc += s.R() * 0.01;
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
const fallback = (acts) => acts.find((x) => x.t !== 'move') ?? acts[0];
const careful = (s, acts) => carefulRaw(s, acts) ?? fallback(acts);
function carefulRaw(s, acts) {
  if (s.dig) return carefulDig(s, acts);
  if (acts[0].t === 'discard') return { t: 'discard', i: lowest(s, 1)[0] };
  if (acts.some((a) => a.t === 'finish')) return { t: 'finish' };
  const pl = plan(s);
  if (acts.some((a) => a.t === 'claim') && pl.want.has(rank(s.gc[4]))) return { t: 'claim' };
  const moves = acts.filter((a) => a.t === 'move');
  const keyed = hasKey(s);
  let vi = -1;
  for (let i = 0; i < 9; i++) if (s.gup[i] && s.gc[i] === s.vault) vi = i;
  if (keyed) {
    if (vi < 0 && acts.some((a) => a.t === 'scout')) return { t: 'scout' };
    if (!moves.length) return acts.find((a) => a.t === 'zoom') ?? null; // no food to walk: dig for some
    return carefulMove(s, moves);
  }
  const zoom = acts.find((a) => a.t === 'zoom');
  if (zoom && (!P.ZCOST || s.hand.length >= 2)) return zoom; // digging is free: always worth it
  const down = s.gup.filter((u, i) => !u && s.gc[i] >= 0).length;
  if (acts.some((a) => a.t === 'scout') && down >= 6 && s.hand.length >= 4) return { t: 'scout' };
  return carefulMove(s, moves);
}
function beginner(s, acts) {
  // the obvious plan: dig whatever you stand on, flip to the bottom, fight whenever you can, claim every lock, step to the best-looking card
  if (s.dig) {
    if (s.dig.hostile >= 0) return acts.some((a) => a.t === 'fight') ? lowRankFight(s) : { t: 'flee' };
    return acts.find((a) => a.t === 'flip') ?? { t: 'stop' };
  }
  if (acts[0].t === 'discard') { let w = 0; s.hand.forEach((c, i) => { if (rank(c) < rank(s.hand[w])) w = i; }); return { t: 'discard', i: w }; }
  return beginnerMain(s, acts);
}
function beginnerMain(s, acts) {
  if (acts.some((a) => a.t === 'finish')) return { t: 'finish' };
  if (acts.some((a) => a.t === 'claim')) return { t: 'claim' };
  const moves = acts.filter((a) => a.t === 'move');
  let vi = -1;
  for (let i = 0; i < 9; i++) if (s.gup[i] && s.gc[i] === s.vault) vi = i;
  if (hasKey(s)) {
    if (vi >= 0) { const r = Math.floor(vi / 3), c = vi % 3; return moves.find((m) => m.d === (r < 1 ? 0 : r > 1 ? 1 : c < 1 ? 2 : 3)); }
    const sc = acts.find((a) => a.t === 'scout'); if (sc) return sc;
  }
  const z = acts.find((a) => a.t === 'zoom'); if (z) return z;
  return beginnerMove(s, moves);
}
function beginnerMove(s, moves) {
  const val = (i) => { const c = s.gc[i]; return (c < 0 || s.gdone[i] || c === s.vault ? -1 : s.gup[i] && isKey(s, c) ? (s.hand.some((x) => rank(x) === rank(c)) ? 50 : -1) : s.gup[i] ? rank(c) : 5) + s.R() * 0.1; };
  const m = moves.length ? moves.reduce((b, m) => (val(TARGET[m.d]) > val(TARGET[b.d]) ? m : b)) : null;
  return m && (SIMPLE.size && !SIMPLE.has('pay') ? m : { ...m, pay: [lowRankIdx(s)] }); // a beginner eats their lowest card
}
const randomP = (s, acts) => acts[Math.floor(s.R() * acts.length)];
// per-decision skill: careful bot, with SIMPLE=nav,zoom,push,fight,pay,scout swapping one decision for the beginner's
const SIMPLE = new Set((E.SIMPLE ?? '').split(',').filter(Boolean));
const mix = (s, acts) => mixRaw(s, acts) ?? fallback(acts);
function mixRaw(s, acts) {
  if (s.dig) {
    const d = s.dig;
    if (d.hostile >= 0) {
      if (SIMPLE.has('fight')) { const f = acts.find((a) => a.t === 'fight'); if (!f) return { t: 'flee' }; return SIMPLE.has('pay') ? lowRankFight(s) : { t: 'fight', pay: cheapestFight(s, d.hostile).pay }; }
      const a = carefulDig(s, acts);
      return a.t === 'fight' && SIMPLE.has('pay') ? lowRankFight(s) : a;
    }
    if (E.PUSH_RULE) { // push family: 'n' = stop once the dig holds n loot; 'r0.2' = flip only while the bust chance is below 0.2
      if (!acts.some((a) => a.t === 'flip')) return { t: 'stop' };
      const r = E.PUSH_RULE;
      if (r[0] === 'r') return bustP(s) < +r.slice(1) ? { t: 'flip' } : { t: 'stop' };
      return d.loot.length < +r ? { t: 'flip' } : { t: 'stop' };
    }
    return SIMPLE.has('push') ? (acts.find((a) => a.t === 'flip') ?? { t: 'stop' }) : carefulDig(s, acts);
  }
  if (acts[0].t === 'discard') return SIMPLE.has('pay') ? beginner(s, acts) : careful(s, acts);
  if (hasKey(s) || acts.some((a) => a.t === 'finish' || a.t === 'claim')) return careful(s, acts);
  const c = careful(s, acts);
  const z = acts.find((a) => a.t === 'zoom');
  if (SIMPLE.has('zoom') && z) return SIMPLE.has('pay') ? { t: 'zoom', pay: [lowRankIdx(s)] } : z;
  if (SIMPLE.has('scout') && c.t === 'scout') return SIMPLE.has('nav') ? beginnerMove(s, acts.filter((a) => a.t === 'move')) : carefulMove(s, acts.filter((a) => a.t === 'move'));
  if (c.t === 'zoom' && SIMPLE.has('pay')) return { t: 'zoom', pay: [lowRankIdx(s)] };
  if (c.t === 'move' && SIMPLE.has('nav')) return beginnerMove(s, acts.filter((a) => a.t === 'move'));
  if (c.t === 'move' && SIMPLE.has('pay')) return { ...c, pay: [lowRankIdx(s)] };
  if (!SIMPLE.has('zoom') || c.t !== 'zoom') return c;
  return carefulMove(s, acts.filter((a) => a.t === 'move'));
}
const lowRankIdx = (s) => { let w = 0; s.hand.forEach((c, i) => { if (rank(c) < rank(s.hand[w])) w = i; }); return w; };
function lowRankFight(s) { // pay with the lowest card that wins, ignoring what it opens
  const h = s.dig.hostile;
  const ok = s.hand.map((c, i) => i).filter((i) => beats(s.hand[i], h)).sort((a, b) => rank(s.hand[a]) - rank(s.hand[b]));
  return ok.length ? { t: 'fight', pay: [ok[0]] } : { t: 'fight', pay: cheapestFight(s, h).pay };
}
// Monte-Carlo: guess the hidden cards, play each option out with the careful bot, keep the best
function determinize(s, R) {
  const t = clone(s, R);
  const slots = [], pool = [];
  for (let i = 0; i < 9; i++) if (!t.gup[i] && t.gc[i] >= 0) { slots.push(['g', i]); pool.push(t.gc[i]); }
  t.pile.forEach((c, i) => { slots.push(['p', i]); pool.push(c); });
  shuffle(pool, R);
  slots.forEach(([w, i], k) => { if (w === 'g') t.gc[i] = pool[k]; else t.pile[i] = pool[k]; });
  return t;
}
function mc(s, acts) {
  if (acts.length === 1) return acts[0];
  const f = acts.find((a) => a.t === 'finish'); if (f) return f;
  const opts = acts.map((a) => (a.t === 'fight' ? { t: 'fight', pay: cheapestFight(s, s.dig.hostile).pay } : a));
  const N = +(E.MC_N ?? 16), tot = opts.map(() => 0);
  for (let k = 0; k < N; k++) {
    const w = determinize(s, mkRng((s.R() * 4e9) >>> 0));
    opts.forEach((a, ai) => {
      const t = clone(w, mkRng((s.R() * 4e9) >>> 0));
      apply(t, a);
      let n = 0;
      while (!t.over && n < 250) { const l = legal(t); if (!l.length) break; apply(t, careful(t, l)); n++; }
      tot[ai] += t.over === 'win' ? 1 : 0.15 * keyCount(t) / P.L;
    });
  }
  let b = 0;
  tot.forEach((v, i) => { if (v > tot[b]) b = i; });
  return opts[b];
}
export const POLICIES = { careful, beginner, random: randomP, mix, mc };

// ---------- running ----------
export function play(seed, policy, log) {
  const s = newGame(seed);
  s.R = mkRng(seed * 7919 + 13 + +(E.RS ?? 0) * 104729);
  const pol = POLICIES[policy];
  while (!s.over) {
    if (s.steps > P.MAX_STEPS) { s.over = 'stall'; break; }
    const acts = legal(s);
    if (!acts.length) { s.over = 'lose'; s.why = 'starved'; log && log('You have nothing left to spend: you cannot move or dig. You lose.', s); break; }
    const a = (E.NOISE && s.R() < +E.NOISE ? randomP(s, acts) : pol(s, acts)) ?? fallback(acts); // no affordable move: do anything else that is legal
    if (a.t === 'move' && acts.some((x) => x.t === 'zoom')) s.stats.skips++;
    apply(s, a, log && ((x) => log(x, s)));
    if (log && !s.dig && ['move', 'scout', 'claim', 'stop', 'flee'].includes(a.t)) log(null, s);
    if (log && !s.dig && a.t === 'flip') log(null, s);
  }
  return s;
}
export function render(s) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    let line = '';
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c, k = s.gc[i];
      let cell = k < 0 ? '..' : !s.gup[i] ? '??' : nm(k) + (s.gdone[i] ? '✓' : '');
      line += (i === 4 ? `[${cell}]` : ` ${cell} `).padEnd(7);
    }
    rows.push('   ' + line);
  }
  rows.push(`   Hand(${s.hand.length}): ${s.hand.slice().sort((a, b) => suit(a) - suit(b) || rank(a) - rank(b)).map(nm).join(' ')}`);
  rows.push(`   Key row: ${s.keys.slice().sort((a, b) => rank(a) - rank(b)).map(nm).join(' ')}   Pile: ${s.pile.length}${s.wait.length ? `   Waiting: ${s.wait.map(nm).join(' ')}` : ''}   Gone: ${s.gone.length}`);
  return rows.join('\n');
}
function run(policy, games, seed0) {
  const res = { win: 0, lose: 0, stall: 0 }, why = {};
  let steps = 0, flips = 0, fights = 0, flees = 0, digs = 0, moves = 0, lostKeys = 0, skips = 0, keysAtLoss = [0, 0, 0, 0, 0];
  const digsBy = [0, 0, 0, 0], clearsBy = [0, 0, 0, 0];
  for (let g = 0; g < games; g++) {
    const s = play(seed0 + g, policy);
    res[s.over]++;
    if (s.over === 'lose') { why[s.why] = (why[s.why] ?? 0) + 1; keysAtLoss[keyCount(s)]++; }
    skips += s.stats.skips;
    for (let k = 0; k < 4; k++) { digsBy[k] += s.stats.digsBy[k]; clearsBy[k] += s.stats.clearsBy[k]; }
    steps += s.steps; flips += s.stats.flips; fights += s.stats.fights; flees += s.stats.flees; digs += s.stats.digs; moves += s.stats.moves; lostKeys += s.stats.lostKeys;
  }
  return { policy, win: (100 * res.win) / games, steps: steps / games, why, keysAtLoss,
    digRate: digs / Math.max(1, digs + skips), digsBy: digsBy.map((x) => x / games), clearsBy: clearsBy.map((x) => x / games),
    perGame: { digs: digs / games, flips: flips / games, fights: fights / games, flees: flees / games, moves: moves / games, lostWantedKeys: lostKeys / games }, stall: res.stall };
}
const fmt = (r) => `${r.policy.padEnd(9)} win ${r.win.toFixed(1).padStart(5)}%  actions ${r.steps.toFixed(1)}  per game: ${Object.entries(r.perGame).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}  losses: ${Object.entries(r.why).map(([k, v]) => `${k} ${v}`).join(' ')} keys-at-loss (0/1/2/3/4) ${r.keysAtLoss.join('/')}${r.stall ? `  STALL ${r.stall}` : ''}`;

const args = process.argv.slice(2);
if (args[0] === 'run') {
  const policy = args[1] ?? 'careful', seed = +(args[2] ?? 1);
  const s0 = newGame(seed);
  const out = [`LOCK ${nm(s0.lock)}: build ${P.L} in a row of ${GLYPH[s0.S]} (the lock starts your key row); finish card A${GLYPH[s0.S]}`, '', 'START', render(s0), ''];
  const s = play(seed, policy, (x, st) => out.push(x === null ? render(st) + '\n' : x));
  out.push('', `RESULT: ${s.over.toUpperCase()} after ${s.steps} actions.`);
  console.log(out.join('\n'));
} else if (args[0] === 'report') {
  const G = +(args[1] ?? 3000);
  for (const p of ['careful', 'beginner', 'random']) console.log(fmt(run(p, G, 1)));
  for (const x of ['nav', 'zoom', 'push', 'fight', 'pay', 'scout']) { SIMPLE.clear(); SIMPLE.add(x); console.log(`swap ${x.padEnd(6)} ${run('mix', G, 1).win.toFixed(1)}%`); }
  SIMPLE.clear();
} else if (args.length && POLICIES[args[0]]) {
  console.log(fmt(run(args[0], +(args[1] ?? 2000), +(args[2] ?? 1))));
}
if (args[0] === 'bylock') { // win rate by lock rank and by key suit
  const G = +(args[1] ?? 4000), pol = args[2] ?? 'careful', br = {}, bs = {};
  for (let g = 1; g <= G; g++) {
    const s = play(g, pol), r = RK[rank(s.lock)] ?? rank(s.lock), k = GLYPH[s.S];
    (br[r] ??= [0, 0])[1]++; (bs[k] ??= [0, 0])[1]++;
    if (s.over === 'win') { br[r][0]++; bs[k][0]++; }
  }
  const f = (m) => Object.entries(m).sort((a, b) => (+a[0] || 20 + a[0].charCodeAt(0)) - (+b[0] || 20 + b[0].charCodeAt(0))).map(([k, [w, n]]) => `${k}:${(100 * w / n).toFixed(0)}%`).join(' ');
  console.log(`${pol} by lock rank: ${f(br)}\n${pol} by key suit: ${f(bs)}`);
}
if (args[0] === 'biome') { // BIOME=1 check: skill ladder, what biome choice is worth, how often the bot digs, which biomes it uses
  const G = +(args[1] ?? 3000), pct = (x) => (100 * x).toFixed(0) + '%', per = (a) => a.map((x, k) => `${GLYPH[k]} ${x.toFixed(2)}`).join('  ');
  for (const p of ['careful', 'beginner']) {
    const r = run(p, G, 1);
    console.log(fmt(r));
    console.log(`          digs when standing on a region ${pct(r.digRate)} · digs per game ${per(r.digsBy)} · cleared per game ${per(r.clearsBy)}`);
  }
  P.BLIND = 1; console.log(`careful, blind to biomes: win ${run('careful', G, 1).win.toFixed(1)}%`); P.BLIND = 0;
}
if (args[0] === 'luck') { // replay each deal with different random streams: how many deals can be won at all?
  const G = +(args[1] ?? 300), N = +(args[2] ?? 20), rates = [];
  for (let g = 1; g <= G; g++) { let w = 0; for (let k = 0; k < N; k++) { E.RS = String(k); E.NOISE = E.NOISE ?? '0.05'; if (play(g, 'careful').over === 'win') w++; } rates.push(w / N); }
  E.RS = '0';
  const b = (lo, hi) => rates.filter((r) => r >= lo && r < hi).length;
  console.log(`deals ${G} x ${N} replays: never won ${b(0, 1e-9)}  1-25% ${b(1e-9, 0.25)}  25-50% ${b(0.25, 0.5)}  50-75% ${b(0.5, 0.75)}  75-99% ${b(0.75, 1)}  always ${b(1, 2)}`);
}
