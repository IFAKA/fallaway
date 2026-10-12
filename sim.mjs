// Zoom — solo 52-card exploration game, v0 simulator.
// Usage: node sim.mjs [policy=random|heur|heur05..heur50|mc|abl|ablN] [games=300] [seed0=1]
//        node sim.mjs luck [deals] [replays] [policy]   -> how much the deal decides
//        ABL=zoom-n,nav-n,pay-n,site-n,zoom,nav,pay node sim.mjs abl ...   -> skill per decision
//        node sim.mjs run [policy] [seed]      -> narrated run with ASCII maps

const GLYPH = ['♠', '♥', '♦', '♣']; // suit id 0..3 (♠ monster, ♥ ally, ♦ treasure, ♣ obstacle)
const RK = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const suit = (c) => c & 3;
const rank = (c) => (c >> 2) + 2;
const red = (c) => suit(c) === 1 || suit(c) === 2;
const nm = (c) => (c < 0 ? ' . ' : (RK[rank(c)] ?? rank(c)) + GLYPH[suit(c)]);

export const P = {
  PACK_START: +(process.env.PACK_START ?? 5),
  PACK_LIMIT: +(process.env.LIMIT ?? 8),
  PUSH: +(process.env.PUSH ?? 0), // spread is flipped one card at a time (press your luck)
  TAKE_TAX: +(process.env.TAKE_TAX ?? 0), // each card taken from a spread adds this to the NEXT zoom's price
  MON_DIV: +(process.env.MON_DIV ?? 2), // monster strength = ceil(rank / MON_DIV)
  MAX_STEPS: 400,
  MOVE_COST: +(process.env.MOVE_COST ?? 0),
  MAX_RECYCLES: +(process.env.MAX_RECYCLES ?? 99), // 99 = the pile loops forever (rule v1)
  // escalation per lap (each time the pile has been reshuffled): zoom costs more / monsters stronger / spreads shrink
  ESC_ZOOM: +(process.env.ESC_ZOOM ?? 1), TOLL: +(process.env.TOLL ?? 0), ESC_MON: +(process.env.ESC_MON ?? 0), ESC_K: +(process.env.ESC_K ?? 0),
  SITE_BONUS: +(process.env.SITE_BONUS ?? 0),
  // LOCKS=1: key cards live only on the map, locked by their rank: claim one by paying a hand card of the same rank.
  // Claimed key cards go to a separate KEY ROW (never spent, not counted in the hand limit).
  LOCKS: +(process.env.LOCKS ?? 0),
  lockLen: () => +(process.env.LOCK_LEN ?? 4),
  siteK: (r) => (r <= 5 ? 1 : r <= 10 ? 2 : 3) + +(process.env.SITE_BONUS ?? 0),
};
let HOME = +(process.env.HOME_TURF ?? 0);
// ablation (analysis only): ABL=site,zoom,nav,pay makes those decisions random inside the 'abl' policy
const ABL = new Set((process.env.ABL ?? '').split(',').filter(Boolean));
const AR = mkRng(+(process.env.RS ?? 0) + 99991);
const payVals = (s) => (ABL.has('pay') ? s.pack.map(() => AR()) : ABL.has('pay-n') ? s.pack.map((c) => rank(c) + (suit(c) === s.S ? 20 : 0)) : keepVals(s));
const K = (c, S = 9) => P.siteK(rank(c)) + (HOME && suit(c) === S ? HOME : 0);

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
function newGame(seed) {
  const R = mkRng(seed);
  const deck = shuffle([...Array(52).keys()], R);
  const li = deck.findIndex((c) => rank(c) !== 14);
  const lock = deck.splice(li, 1)[0]; // lock card: shown face-up, then shuffled back into the deck
  const S = suit(lock);
  const L = P.lockLen(rank(lock));
  const vault = (12 << 2) | S; // Ace of the lock's suit
  deck.splice(deck.indexOf(vault), 1);
  if (!process.env.LOCK_OUT) deck.splice(Math.floor(R() * (deck.length + 1)), 0, lock); // LOCK_OUT=1: lock stays face-up beside the table, out of play
  const pack = deck.splice(0, P.PACK_START - (process.env.LOCK_OUT === 'hand' ? 1 : 0));
  if (process.env.LOCK_OUT === 'hand') pack.unshift(lock); // variant: the lock starts in your hand
  const grid = deck.splice(0, 9);
  const depth = 8 + Math.floor(R() * 22); // vault sits somewhere in the middle of the pile
  deck.splice(depth, 0, vault);
  const s = {
    R, S, L, lock, vault,
    draw: deck.reverse(), // top = end
    behind: [], ashes: [], pack,
    gc: grid, gup: Array(9).fill(0), gdone: Array(9).fill(0),
    site: null, steps: 0, over: null, recycles: 0,
    seen: new Uint8Array(52), stats: { fights: 0, passes: 0, zooms: 0, moves: 0, scouts: 0, overflow: 0 },
  };
  if (P.LOCKS) { // key cards dealt to the hand go to the bottom of the pile; deal another
    s.keys = [];
    for (let i = 0; i < s.pack.length; i++) while (isKeyCard(s, s.pack[i])) { s.draw.unshift(s.pack[i]); s.pack[i] = s.draw.pop(); }
  }
  for (const c of pack) s.seen[c] = 1;
  reveal(s, 4);
  return s;
}
function clone(s, R) {
  return {
    ...s, R,
    draw: s.draw.slice(), behind: s.behind.slice(), ashes: s.ashes.slice(), pack: s.pack.slice(),
    gc: s.gc.slice(), gup: s.gup.slice(), gdone: s.gdone.slice(),
    site: s.site && { cards: s.site.cards.slice(), done: s.site.done.slice() },
    seen: s.seen.slice(), stats: { ...s.stats }, keys: s.keys && s.keys.slice(),
  };
}
function reveal(s, i) {
  if (!s.gup[i] && s.gc[i] >= 0) { s.gup[i] = 1; s.seen[s.gc[i]] = 1; }
}
const isKeyCard = (s, c) => P.LOCKS && c >= 0 && suit(c) === s.S && c !== s.vault;
function drawCard(s, skipVault) {
  for (let t = 0; t < 60; t++) {
    if (!s.draw.length) {
      if (!s.behind.length || s.recycles >= P.MAX_RECYCLES) { s.exhausted = true; return -1; } // the world has no cards left to deal
      if (process.env.LOCK_OUT === 'lap' && !s.recycles) s.behind.push(s.lock); // variant: the lock marker rejoins the world at the first reshuffle
      s.draw = shuffle(s.behind, s.R);
      s.behind = [];
      s.recycles++;
      for (let k = 0; k < P.TOLL && s.pack.length; k++) payOne(s); // the world takes a toll each lap
    }
    const c = s.draw.pop();
    if (skipVault && (c === s.vault || isKeyCard(s, c))) { s.draw.unshift(c); continue; } // spreads never hold the finish card (or, with LOCKS, key cards)
    return c;
  }
  return -1;
}

// ---------- card values ----------
// LOCKS: which key ranks are worth chasing? Score each 4-run by key cards held (and, lightly, key cards visible on the map).
function lockPlan(s) {
  const lr = suit(s.lock) === s.S && process.env.LOCK_OUT ? rank(s.lock) : -1; // the lock card is out of play: runs through it are dead
  const vis = new Set();
  for (let i = 0; i < 9; i++) if (s.gup[i] && isKeyCard(s, s.gc[i])) vis.add(rank(s.gc[i]));
  const held = new Set(s.keys.map(rank));
  let best = -1, want = new Set();
  for (let a = 2; a + s.L - 1 <= 13; a++) {
    if (lr >= a && lr < a + s.L) continue;
    let sc = 0;
    for (let r = a; r < a + s.L; r++) sc += held.has(r) ? 1 : vis.has(r) ? 0.4 : 0;
    if (sc > best + 1e-9) { best = sc; want = new Set(); }
    if (Math.abs(sc - best) < 1e-9) for (let r = a; r < a + s.L; r++) if (!held.has(r)) want.add(r);
  }
  return { want, vis, held };
}
function keepVals(s) {
  if (P.LOCKS) { // hand cards are tools; a card whose rank opens a wanted key card is precious, more so if that key card is on the map now
    const { want, vis } = lockPlan(s);
    return s.pack.map((c) => 1 + ((rank(c) - 2) / 12) * 0.4 + (want.has(rank(c)) ? (vis.has(rank(c)) ? 3.5 : 1.2) : 0));
  }
  const { pack, S, L } = s;
  const kv = pack.map((c) => 1 + ((rank(c) - 2) / 12) * 0.4);
  let best = 0, wins = [];
  for (let a = 2; a + L - 1 <= 13; a++) {
    let h = 0;
    for (let r = a; r < a + L; r++) if (pack.some((c) => suit(c) === S && rank(c) === r)) h++;
    if (h > best) { best = h; wins = [a]; } else if (h === best && h > 0) wins.push(a);
  }
  pack.forEach((c, i) => {
    if (suit(c) !== S) return;
    const r = rank(c);
    kv[i] += best > 0 && wins.some((a) => r >= a && r < a + L) ? 2.5 + 0.6 * best : 0.8;
  });
  return kv;
}
function keyProgress(s) {
  let best = 0;
  const src = P.LOCKS ? s.keys : s.pack;
  for (let a = 2; a + s.L - 1 <= 13; a++) {
    let h = 0;
    for (let r = a; r < a + s.L; r++) if (src.some((c) => suit(c) === s.S && rank(c) === r)) h++;
    best = Math.max(best, h);
  }
  return best / s.L;
}
const hasKey = (s) => keyProgress(s) >= 1;
const power = (c) => rank(c) * (suit(c) === 0 ? 2 : 1);
const strength = (m, s) => Math.ceil(rank(m) / P.MON_DIV) + P.ESC_MON * s.recycles;
const zoomCost = (s) => 1 + P.ESC_ZOOM * s.recycles + (s.tax ?? 0);
const scoutCost = (s) => (process.env.FREE_SCOUT_KEYED && hasKey(s) ? 0 : zoomCost(s)); // FREE_SCOUT_KEYED=1: once you hold the key, zooming out is free
const spreadK = (c, s) => Math.max(1, K(c, s.S) - P.ESC_K * s.recycles);
function payN(s, n) { const out = []; for (let i = 0; i < n; i++) out.push(payOne(s)); return out; }

function cheapestFight(s, need) {
  const kv = payVals(s), n = s.pack.length;
  let best = null, bc = Infinity;
  for (let m = 1; m < 1 << n; m++) {
    let pw = 0, cost = 0;
    for (let i = 0; i < n; i++) if (m >> i & 1) { pw += power(s.pack[i]); cost += kv[i]; }
    if (pw >= need && cost < bc) { bc = cost; best = m; }
  }
  return best === null ? null : { mask: best, cost: bc };
}
function cheapestPass(s, ob) {
  const kv = payVals(s), n = s.pack.length;
  let best = null, bc = Infinity;
  for (let i = 0; i < n; i++) if (red(s.pack[i]) === red(ob) && kv[i] < bc) { bc = kv[i]; best = 1 << i; }
  const idx = [...Array(n).keys()].sort((a, b) => kv[a] - kv[b]);
  if (n >= 2 && kv[idx[0]] + kv[idx[1]] < bc) { bc = kv[idx[0]] + kv[idx[1]]; best = (1 << idx[0]) | (1 << idx[1]); }
  return best === null ? null : { mask: best, cost: bc };
}
function spend(s, mask) {
  const out = [];
  for (let i = s.pack.length - 1; i >= 0; i--) if (mask >> i & 1) out.push(s.pack.splice(i, 1)[0]);
  s.ashes.push(...out);
}
function payOne(s) {
  const kv = payVals(s);
  let w = 0;
  kv.forEach((v, i) => { if (v < kv[w]) w = i; });
  const c = s.pack.splice(w, 1)[0];
  s.ashes.push(c);
  return c;
}
function gain(s, c) {
  s.pack.push(c);
  s.seen[c] = 1;
  while (s.pack.length > P.PACK_LIMIT) {
    const kv = payVals(s);
    let w = 0;
    kv.forEach((v, i) => { if (v < kv[w]) w = i; });
    s.ashes.push(s.pack.splice(w, 1)[0]);
    s.stats.overflow++;
  }
}

// ---------- actions ----------
const DIRS = ['up', 'down', 'left', 'right'];
const TARGET = [1, 7, 3, 5];
function legal(s) {
  const acts = [];
  if (s.site && P.PUSH) {
    const st = s.site;
    if (st.pend >= 0) {
      const t = suit(st.pend);
      if (t === 0) { if (cheapestFight(s, strength(st.pend, s))) acts.push({ t: 'fight' }); acts.push({ t: 'flee' }); }
      else { if (cheapestPass(s, st.pend)) acts.push({ t: 'swap' }); acts.push({ t: 'skip' }); }
      return acts;
    }
    if (st.n < st.k) acts.push({ t: 'flip' });
    acts.push({ t: 'stop' });
    return acts;
  }
  if (s.site) {
    s.site.cards.forEach((m, j) => {
      if (s.site.done[j]) return;
      const t = suit(m);
      let ok = true;
      if (t === 3) ok = !!cheapestPass(s, m);
      if (t === 0) ok = !!cheapestFight(s, strength(m, s));
      if (ok) acts.push({ t: 'take', j });
    });
    if (!acts.length || process.env.FREE_LEAVE) acts.push({ t: 'leave' }); // rule v2: you must take every card you can pay for

    return acts;
  }
  const ctr = s.gc[4];
  if (ctr === s.vault && hasKey(s)) acts.push({ t: 'open' });
  if (!P.MOVE_COST || s.pack.length >= 1) for (let d = 0; d < 4; d++) acts.push({ t: 'move', d });
  if (isKeyCard(s, ctr) && s.pack.some((c) => rank(c) === rank(ctr))) acts.push({ t: 'claim' });
  if (s.pack.length >= zoomCost(s) && ctr >= 0 && s.gup[4] && !s.gdone[4] && ctr !== s.vault && !isKeyCard(s, ctr)) acts.push({ t: 'zoom' });
  if (s.pack.length >= scoutCost(s) && s.gup.some((u, i) => !u && s.gc[i] >= 0)) acts.push({ t: 'scout' });
  return acts;
}
function shift(s, d) {
  const old = s.gc, od = s.gdone, ou = s.gup;
  const nc = Array(9).fill(-1), nd = Array(9).fill(0), nu = Array(9).fill(0);
  const fresh = [];
  for (let k = 0; k < 3; k++) fresh.push(drawCard(s, false));
  const put = (to, from) => { nc[to] = old[from]; nd[to] = od[from]; nu[to] = ou[from]; };
  const gone = [];
  if (d === 0) { for (let i = 0; i < 6; i++) put(i + 3, i); for (let k = 0; k < 3; k++) nc[k] = fresh[k]; gone.push(6, 7, 8); }
  if (d === 1) { for (let i = 0; i < 6; i++) put(i, i + 3); for (let k = 0; k < 3; k++) nc[6 + k] = fresh[k]; gone.push(0, 1, 2); }
  if (d === 2) { for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) put(r * 3 + c + 1, r * 3 + c); nc[r * 3] = fresh[r]; gone.push(r * 3 + 2); } }
  if (d === 3) { for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) put(r * 3 + c, r * 3 + c + 1); nc[r * 3 + 2] = fresh[r]; gone.push(r * 3); } }
  for (const g of gone) if (old[g] >= 0) s.behind.push(old[g]);
  s.gc = nc; s.gdone = nd; s.gup = nu;
}
function finishSite(s) {
  const st = s.site;
  if (st.done.every((x) => x)) {
    gain(s, s.gc[4]);
    s.gc[4] = -1;
    s.gdone[4] = 2;
  } else s.gdone[4] = 1;
  s.site = null;
}
function bank(s, full) {
  const st = s.site;
  for (const c of st.loot) gain(s, c);
  if (full && st.kept) { gain(s, s.gc[4]); s.gc[4] = -1; s.gdone[4] = 2; } else s.gdone[4] = 1;
  s.site = null;
}
function apply(s, a, log) {
  const say = (x) => log && log(x);
  switch (a.t) {
    case 'scout': {
      const c = payN(s, scoutCost(s)).map(nm).join('+') || 'nothing';
      s.tax = 0;
      say(`Zoom OUT: spend ${c} to survey the whole map.`);
      for (let i = 0; i < 9; i++) reveal(s, i);
      s.stats.scouts++;
      break;
    }
    case 'move': {
      const c = P.MOVE_COST ? payOne(s) : -1;
      shift(s, a.d);
      reveal(s, 4);
      say(`Move ${DIRS[a.d]}${c >= 0 ? ': spend ' + nm(c) : ''}. You arrive at ${nm(s.gc[4])}.`);
      s.stats.moves++;
      break;
    }
    case 'zoom': {
      const c = payN(s, zoomCost(s)).map(nm).join('+');
      s.tax = 0;
      const k = spreadK(s.gc[4], s), cards = [];
      if (P.PUSH) { s.site = { k, n: 0, loot: [], pend: -1, kept: true }; s.stats.zooms++; say(`Zoom IN on ${nm(s.gc[4])}: spend ${c}, up to ${k} flips.`); break; }
      for (let i = 0; i < k; i++) { const x = drawCard(s, true); if (x >= 0) { cards.push(x); s.seen[x] = 1; } }
      s.site = { cards, done: cards.map(() => 0) };
      s.stats.zooms++;
      say(`Zoom IN on ${nm(s.gc[4])}: spend ${c}, spread ${k} card${k === 1 ? "" : "s"}: ${cards.map(nm).join(' ')}`);
      if (!cards.length) finishSite(s);
      break;
    }
    case 'take': {
      const st = s.site, m = st.cards[a.j], t = suit(m);
      if (t === 1 || t === 2) {
        gain(s, m);
        say(`  Take ${nm(m)} (${t === 1 ? 'ally' : 'treasure'}) -> hand.`);
      } else if (t === 3) {
        const p = cheapestPass(s, m);
        const spent = s.pack.filter((_, i) => p.mask >> i & 1);
        spend(s, p.mask);
        gain(s, m);
        s.stats.passes++;
        say(`  Take ${nm(m)} (obstacle): swap it for ${spent.map(nm).join('+')} from your hand.`);
      } else {
        const f = cheapestFight(s, strength(m, s));
        const spent = s.pack.filter((_, i) => f.mask >> i & 1);
        spend(s, f.mask);
        gain(s, m);
        s.stats.fights++;
        say(`  Take ${nm(m)} (monster, strength ${strength(m, s)}): beat it with ${spent.map(nm).join('+')}; it joins your hand.`);
      }
      st.done[a.j] = 1;
      s.tax = (s.tax ?? 0) + P.TAKE_TAX;
      if (st.done.every((x) => x)) {
        const r = s.gc[4];
        finishSite(s);
        say(`  Site cleared: region ${nm(r)} joins your hand.`);
      }
      break;
    }
    case 'flip': {
      const st = s.site, x = drawCard(s, true);
      if (x < 0) { bank(s, false); break; }
      s.seen[x] = 1; st.n++;
      const t = suit(x);
      say(`  Flip ${nm(x)}.`);
      if (t === 1 || t === 2) { st.loot.push(x); if (st.n >= st.k) bank(s, true); }
      else st.pend = x;
      break;
    }
    case 'fight': {
      const st = s.site, m = st.pend, f = cheapestFight(s, strength(m, s));
      spend(s, f.mask); st.loot.push(m); st.pend = -1; s.stats.fights++;
      say(`  Beat ${nm(m)}.`);
      if (st.n >= st.k) bank(s, true);
      break;
    }
    case 'flee': {
      const st = s.site;
      say(`  Flee from ${nm(st.pend)}: lose this site's loot ${st.loot.map(nm).join(' ')}.`);
      st.loot = []; st.pend = -1; s.gdone[4] = 1; s.site = null;
      break;
    }
    case 'swap': {
      const st = s.site, m = st.pend, p2 = cheapestPass(s, m);
      spend(s, p2.mask); st.loot.push(m); st.pend = -1; s.stats.passes++;
      if (st.n >= st.k) bank(s, true);
      break;
    }
    case 'skip': {
      const st = s.site; st.pend = -1; st.kept = false;
      if (st.n >= st.k) bank(s, true);
      break;
    }
    case 'stop': bank(s, false); say('  Stop and keep the loot.'); break;
    case 'leave':
      say('  Cannot pay for the rest: those cards are forgotten.');
      finishSite(s);
      break;
    case 'claim': { // pay the cheapest hand card of the same rank; the key card moves to the key row
      const ctr = s.gc[4], kv = payVals(s);
      let w = -1;
      s.pack.forEach((c, i) => { if (rank(c) === rank(ctr) && (w < 0 || kv[i] < kv[w])) w = i; });
      const paid = process.env.CLAIM_SHOW ? s.pack[w] : s.pack.splice(w, 1)[0]; // CLAIM_SHOW=1: you only show the matching rank, you keep it
      if (!process.env.CLAIM_SHOW) s.ashes.push(paid);
      s.keys.push(ctr);
      s.gc[4] = -1; s.gdone[4] = 2;
      s.stats.claims = (s.stats.claims ?? 0) + 1;
      say(`Claim ${nm(ctr)} with ${nm(paid)}: key row ${s.keys.slice().sort((a, b) => a - b).map(nm).join(' ')}.`);
      break;
    }
    case 'open':
      s.over = 'win';
      say('The finish card is the middle card and you hold your key: YOU WIN.');
      break;
  }
  s.steps++;
}

// ---------- policies ----------
function cellScore(s, i, keyed) {
  const c = s.gc[i];
  if (c < 0) return 0;
  if (!s.gup[i]) return 5.2;
  if (c === s.vault) return keyed ? 900 : keyProgress(s) >= 0.66 ? 8 : 2;
  if (s.gdone[i]) return 0.5;
  if (isKeyCard(s, c)) return !lockPlan(s).want.has(rank(c)) ? 0.5 : s.pack.some((x) => rank(x) === rank(c)) ? 40 : 3;
  return 4 + 1.6 * K(c, s.S) + (suit(c) === s.S ? 2 : 0);
}
const DISC = [[6, 7, 8], [0, 1, 2], [2, 5, 8], [0, 3, 6]];
function unseenSpadeRisk(s) {
  let n = 0, sp = 0, str = 0;
  for (let c = 0; c < 52; c++) if (!s.seen[c] && c !== s.vault) { n++; if (suit(c) === 0) { sp++; str += strength(c, s); } }
  return { p: n ? sp / n : 0, str: sp ? str / sp : 0 };
}
const lootVal = (s, cs) => cs.reduce((a, c) => a + keepVals({ ...s, pack: [...s.pack, c] })[s.pack.length], 0);
function pushAct(s, acts, R) {
  const st = s.site;
  if (st.pend >= 0) {
    const m = st.pend, worth = lootVal(s, [m]);
    if (suit(m) === 0) {
      const f = acts.find((a) => a.t === 'fight') && cheapestFight(s, strength(m, s));
      return f && f.cost < worth + lootVal(s, st.loot) + 0.3 ? { t: 'fight' } : { t: 'flee' };
    }
    const p2 = acts.find((a) => a.t === 'swap') && cheapestPass(s, m);
    return p2 && p2.cost < worth ? { t: 'swap' } : { t: 'skip' };
  }
  if (!acts.some((a) => a.t === 'flip')) return { t: 'stop' };
  const { p, str } = unseenSpadeRisk(s);
  const loot = lootVal(s, st.loot);
  const f = cheapestFight(s, Math.ceil(str));
  const lossIfSpade = f ? Math.min(f.cost - 1.2, loot) : loot; // pay to fight (monster joins) or lose loot
  const last = st.n + 1 >= st.k && st.kept ? 1.3 : 0;
  const gain = (1 - p) * (1.2 + last) + p * last * (f ? 1 : 0);
  return gain > p * Math.max(0, lossIfSpade) + (R() * 0.02) ? { t: 'flip' } : { t: 'stop' };
}
const popc = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
function pushAllAct(s, acts) { // simple rule: always flip, always fight/swap if you can
  for (const t of ['fight', 'swap', 'flip']) if (acts.some((a) => a.t === t)) return { t };
  return acts.find((a) => a.t === 'flee' || a.t === 'skip') ?? { t: 'stop' };
}
function heurAct(s, acts, R) {
  if (s.site && P.PUSH && process.env.RULE) { // threshold family: STOPAT loot size, MAXFIGHT cards
    const st = s.site, stopAt = +(process.env.STOPAT ?? 99), maxF = +(process.env.MAXFIGHT ?? 99);
    if (st.pend >= 0) {
      if (suit(st.pend) === 0) { const f = acts.some((a) => a.t === 'fight') && cheapestFight(s, strength(st.pend, s)); return f && popc(f.mask) <= maxF ? { t: 'fight' } : { t: 'flee' }; }
      return acts.some((a) => a.t === 'swap') ? { t: 'swap' } : { t: 'skip' };
    }
    return st.loot.length < stopAt && acts.some((a) => a.t === 'flip') ? { t: 'flip' } : { t: 'stop' };
  }
  if (s.site && P.PUSH) return ABL.has('push-all') ? pushAllAct(s, acts) : ABL.has('push-1') ? (s.site.pend >= 0 ? pushAllAct(s, acts) : { t: s.site.n < 1 && acts.some((a) => a.t === 'flip') ? 'flip' : 'stop' }) : pushAct(s, acts, R);
  if (s.site && !process.env.FREE_LEAVE) { // rule v2: loot everything you can pay for; free cards first, then the cheapest
    let b = null, bc = Infinity;
    for (const a of acts) {
      if (a.t !== 'take') continue;
      const m = s.site.cards[a.j], t = suit(m);
      const c = t === 3 ? cheapestPass(s, m).cost : t === 0 ? cheapestFight(s, strength(m, s)).cost : -1;
      if (c < bc) { bc = c; b = a; }
    }
    return b ?? { t: 'leave' };
  }
  if (s.site) {
    const st = s.site;
    let bestN = 0.05, bestA = { t: 'leave' };
    const open = st.done.filter((x) => !x).length;
    for (const a of acts) {
      if (a.t !== 'take') continue;
      const m = st.cards[a.j], t = suit(m);
      let cost = 0;
      if (t === 3) cost = cheapestPass(s, m).cost;
      if (t === 0) cost = cheapestFight(s, strength(m, s)).cost;
      // value of holding m: keep value as the last card of pack+m
      const hyp = { ...s, pack: [...s.pack, m] };
      const worth = keepVals(hyp)[s.pack.length] + (open === 1 ? 0.8 : 0);
      const net = worth - cost + R() * 0.01;
      if (net > bestN) { bestN = net; bestA = a; }
    }
    return bestA;
  }
  const keyed = hasKey(s);
  if (acts.some((a) => a.t === 'open')) return { t: 'open' };
  const down = s.gup.filter((u, i) => !u && s.gc[i] >= 0).length;
  let vi = -1;
  for (let i = 0; i < 9; i++) if (s.gup[i] && s.gc[i] === s.vault) vi = i;
  let bestS = -Infinity, bestA = null;
  for (const a of acts) {
    let sc;
    if (a.t === 'claim') sc = lockPlan(s).want.has(rank(s.gc[4])) ? 100 : -1;
    else if (a.t === 'zoom') sc = s.pack.length >= zoomCost(s) + 1 ? 5 + 1.6 * spreadK(s.gc[4], s) : 1;
    else if (a.t === 'scout') sc = !scoutCost(s) ? (vi < 0 ? 50 : -1) : s.pack.length >= zoomCost(s) + 2 ? 0.55 * down : 0;
    else {
      sc = cellScore(s, TARGET[a.d], keyed) - 0.25 * DISC[a.d].reduce((x, g) => x + cellScore(s, g, keyed), 0);
      if (keyed && vi >= 0) {
        const r = Math.floor(vi / 3), c = vi % 3;
        if ((a.d === 0 && r < 1) || (a.d === 1 && r > 1) || (a.d === 2 && c < 1) || (a.d === 3 && c > 1)) sc += 30;
      }
    }
    sc += R() * 0.05;
    if (sc > bestS) { bestS = sc; bestA = a; }
  }
  return bestA;
}
function randAct(s, acts, R) {
  return acts[Math.floor(R() * acts.length)];
}

// Monte-Carlo policy: determinize hidden cards, roll out with heuristic, pick best first action.
function determinize(s, R) {
  const t = clone(s, R);
  const slots = [];
  const known = (c) => s.seen[c];
  const pool = [];
  for (let i = 0; i < 9; i++) if (!t.gup[i] && t.gc[i] >= 0) { slots.push(['g', i]); pool.push(t.gc[i]); }
  t.draw.forEach((c, i) => { slots.push(['d', i]); pool.push(c); });
  t.behind.forEach((c, i) => { if (!known(c)) { slots.push(['b', i]); pool.push(c); } });
  shuffle(pool, R);
  slots.forEach(([w, i], k) => {
    if (w === 'g') t.gc[i] = pool[k]; else if (w === 'd') t.draw[i] = pool[k]; else t.behind[i] = pool[k];
  });
  return t;
}
function rollout(t, depth, R) {
  let n = 0;
  while (!t.over && n < depth) {
    if (t.exhausted && !t.site) break;
    const acts = legal(t);
    if (!acts.length) break;
    apply(t, heurAct(t, acts, R), null);
    n++;
  }
  if (t.over === 'win') return 1 + (depth - n) * 0.001;
  return 0.6 * keyProgress(t) * keyProgress(t) + 0.02 * t.pack.length;
}
function mcAct(s, acts, R, N = +(process.env.MC_N ?? 12), depth = 70) {
  if (acts.length === 1) return acts[0];
  const opens = acts.find((a) => a.t === 'open');
  if (opens) return opens;
  const tot = acts.map(() => 0);
  for (let k = 0; k < N; k++) {
    const world = determinize(s, R);
    acts.forEach((a, ai) => {
      const t = clone(world, mkRng((R() * 4e9) >>> 0));
      apply(t, a, null);
      tot[ai] += rollout(t, depth, t.R);
    });
  }
  let b = 0;
  tot.forEach((v, i) => { if (v > tot[b]) b = i; });
  return acts[b];
}
function ablAct(s, acts, R) {
  if (s.site && P.PUSH) return heurAct(s, acts, R);
  if (s.site) {
    if (ABL.has('site-n')) return acts.find((x) => x.t === 'take' && (suit(s.site.cards[x.j]) % 3 !== 0)) ?? acts.find((x) => x.t === 'take') ?? { t: 'leave' };
    return ABL.has('site') ? randAct(s, acts, R) : heurAct(s, acts, R);
  }
  if (acts.some((a) => a.t === 'open')) return { t: 'open' };
  const moves = acts.filter((x) => x.t === 'move');
  let a = heurAct(s, acts, R);
  if (ABL.has('zoom-n')) { const z = acts.find((x) => x.t === 'zoom'); a = z ?? heurAct(s, moves, R); }
  if (ABL.has('nav-n') && a.t === 'move') {
    let vi = -1; for (let i = 0; i < 9; i++) if (s.gup[i] && s.gc[i] === s.vault) vi = i;
    if (vi >= 0 && hasKey(s) && vi !== 4) { const r = Math.floor(vi / 3), c = vi % 3; a = moves.find((m) => m.d === (r < 1 ? 0 : r > 1 ? 1 : c < 1 ? 2 : 3)); }
    else {
      const sc = (i) => (s.gc[i] < 0 || s.gdone[i] ? -1 : s.gup[i] ? rank(s.gc[i]) : 0) + R() * 0.1;
      a = moves.reduce((b, m) => (sc(TARGET[m.d]) > sc(TARGET[b.d]) ? m : b));
    }
  }
  if (ABL.has('zoom')) {
    const kinds = [...new Set(acts.map((x) => x.t))];
    const k = kinds[Math.floor(R() * kinds.length)];
    if (k !== a.t) a = k === 'move' ? heurAct(s, moves, R) : acts.find((x) => x.t === k);
  }
  if (ABL.has('nav') && a.t === 'move') a = moves[Math.floor(R() * moves.length)];
  return a;
}
// The obvious beginner plan (the skill baseline): loot whatever you stand on, step to the next unlooted neighbour, repeat.
// Pays with the lowest card that is not the key suit. Once keyed: zoom out if the finish card is not visible, then walk to it.
function obviousAct(s, acts, R) {
  if (s.site) return heurAct(s, acts, R); // looting is mandatory; free first, then cheapest
  if (acts.some((a) => a.t === 'open')) return { t: 'open' };
  if (acts.some((a) => a.t === 'claim')) return { t: 'claim' }; // a beginner opens every lock they can
  const moves = acts.filter((a) => a.t === 'move');
  let vi = -1;
  for (let i = 0; i < 9; i++) if (s.gup[i] && s.gc[i] === s.vault) vi = i;
  if (hasKey(s)) {
    if (vi >= 0) { const r = Math.floor(vi / 3), c = vi % 3; return moves.find((m) => m.d === (r < 1 ? 0 : r > 1 ? 1 : c < 1 ? 2 : 3)); }
    const sc = acts.find((a) => a.t === 'scout');
    if (sc) return sc;
  }
  const z = acts.find((a) => a.t === 'zoom');
  if (z) return z;
  return obviousMove(s, moves, R);
}
function obviousMove(s, moves, R) {
  const val = (i) => (s.gc[i] < 0 || s.gdone[i] || s.gc[i] === s.vault ? -1
    : s.gup[i] && isKeyCard(s, s.gc[i]) ? (s.pack.some((c) => rank(c) === rank(s.gc[i])) ? 50 : -1) // go open a lock you can open
    : s.gup[i] ? rank(s.gc[i]) : 1) + R() * 0.1;
  return moves.reduce((b, m) => (val(TARGET[m.d]) > val(TARGET[b.d]) ? m : b));
}
// Skill check: careful bot, but SIMPLE=nav,zoom,claim,end swaps those decisions for the beginner's (pay: use ABL=pay-n).
const SIMPLE = new Set((process.env.SIMPLE ?? '').split(',').filter(Boolean));
function mixAct(s, acts, R) {
  if (s.site || acts.some((a) => a.t === 'open')) return heurAct(s, acts, R);
  if (hasKey(s)) return SIMPLE.has('end') ? obviousAct(s, acts, R) : heurAct(s, acts, R);
  const h = heurAct(s, acts, R), moves = acts.filter((a) => a.t === 'move');
  if (acts.some((a) => a.t === 'claim') && (SIMPLE.has('claim') || h.t === 'claim')) return { t: 'claim' };
  if (SIMPLE.has('zoom')) { const z = acts.find((a) => a.t === 'zoom'); if (z) return z; }
  else if (h.t === 'zoom' || h.t === 'scout') return h;
  return SIMPLE.has('nav') ? obviousMove(s, moves, R) : heurAct(s, moves, R);
}
const noisy = (e) => (s, acts, R) => (R() < e ? randAct(s, acts, R) : heurAct(s, acts, R));
const POLICIES = { random: randAct, heur: heurAct, mc: mcAct, obvious: obviousAct, mix: mixAct, heur10: noisy(0.1), heur25: noisy(0.25), heur50: noisy(0.5), heur05: noisy(0.05), abl: ablAct,
  ablN: (s, acts, R) => (R() < +(process.env.NOISE ?? 0.1) ? randAct(s, acts, R) : ablAct(s, acts, R)) };

// ---------- running ----------
export function play(seed, policy, log) {
  const s = newGame(seed);
  const pol = POLICIES[policy], R = mkRng(seed * 7919 + 13 + +(process.env.RS ?? 0) * 104729);
  while (!s.over) {
    if (s.steps > P.MAX_STEPS) { s.over = 'stall'; break; }
    const acts = legal(s);
    if (!acts.length) { s.over = 'dry'; break; }
    if (s.exhausted && !s.site) { s.over = 'exhausted'; break; }
    if (P.MAX_RECYCLES > 50 && !s.site && !hasKey(s) && s.pack.length < zoomCost(s)) { s.over = 'dry'; break; } // loop mode: you can no longer afford to explore and have no key
    const before = !s.site;
    const a = pol(s, acts, R);
    apply(s, a, log && ((x) => log(x, s)));
    if (log && before && !s.site && s.over !== 'win') log(null, s);
  }
  return s;
}

export function render(s) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    let line = '';
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c, k = s.gc[i];
      let cell = k < 0 ? ' .. ' : !s.gup[i] ? ' ?? ' : nm(k).padStart(3) + (s.gdone[i] ? '✓' : ' ');
      if (i === 4) cell = '[' + cell.trim().padStart(3) + ']';
      else cell = ' ' + cell.trim().padEnd(3) + ' ';
      line += cell.padEnd(6);
    }
    rows.push('   ' + line);
  }
  rows.push(`   Hand(${s.pack.length}): ${s.pack.slice().sort((a, b) => suit(a) - suit(b) || rank(a) - rank(b)).map(nm).join(' ')}`);
  if (s.keys) rows.push(`   Key row: ${s.keys.slice().sort((a, b) => a - b).map(nm).join(' ') || '-'}`);
  rows.push(`   Pile: ${s.draw.length}   Behind: ${s.behind.length}   Gone: ${s.ashes.length}   Lap: ${s.recycles + 1} (zoom costs ${zoomCost(s)})`);
  return rows.join('\n');
}
export const lockText = (s) => `LOCK card ${nm(s.lock)} -> need ${s.L} consecutive ${GLYPH[s.S]} (finish card = A${GLYPH[s.S]})`;

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args[0] === 'luck') {
  // per deal: replay with N different random streams; how much does the deal decide?
  const G = +(args[1] ?? 300), N = +(args[2] ?? 40), pol = args[3] ?? 'ablN';
  const rates = [], feats = [];
  for (let g = 1; g <= G; g++) {
    let w = 0;
    for (let k = 0; k < N; k++) { process.env.RS = String(k); if (play(g, pol).over === 'win') w++; }
    process.env.RS = '0';
    const base = play(g, 'abl').over === 'win';
    const s0 = newGame(g);
    const depth = s0.draw.length - 1 - s0.draw.indexOf(s0.vault);
    feats.push({ kp: keyProgress(s0), suitN: s0.pack.filter((c) => suit(c) === s0.S).length, depth, base });
    rates.push(w / N);
  }
  const b = (lo, hi) => rates.filter((r) => r >= lo && r < hi).length;
  console.log(`deals ${G}, ${N} replays each with policy ${pol} (noise ${process.env.NOISE ?? 0.1})`);
  console.log(`never won: ${b(0, 1e-9)}   won 1-25%: ${b(1e-9, 0.25)}   25-50%: ${b(0.25, 0.5)}   50-75%: ${b(0.5, 0.75)}   75-99%: ${b(0.75, 1)}   always: ${b(1, 2)}`);
  console.log(`avg replay win ${(100 * rates.reduce((a, x) => a + x, 0) / G).toFixed(1)}%   won at least once: ${(100 * rates.filter((r) => r > 0).length / G).toFixed(1)}%   clean bot: ${(100 * feats.filter((f) => f.base).length / G).toFixed(1)}%`);
  const by = (f, key) => { const m = {}; feats.forEach((x, i) => { const k = f(x); (m[k] ??= []).push(rates[i]); }); return Object.keys(m).sort((a, b) => a - b).map((k) => `${key}=${k}: ${(100 * m[k].reduce((a, x) => a + x, 0) / m[k].length).toFixed(0)}% (n${m[k].length})`).join('  '); };
  console.log('by key-suit cards in starting hand:', by((x) => x.suitN, 's'));
  console.log('by finish-card depth:', by((x) => (x.depth < 15 ? 8 : x.depth < 22 ? 15 : 22), 'd>='));
} else if (args[0] === 'run') {
  const policy = args[1] ?? 'heur', seed = +(args[2] ?? 1);
  const out = [];
  const s0 = newGame(seed);
  out.push(lockText(s0), '', 'START', render(s0), '');
  let n = 0;
  const s = play(seed, policy, (x, st) => {
    if (x === null) out.push(render(st), '');
    else out.push(x);
    n++;
  });
  out.push('', `RESULT: ${s.over.toUpperCase()} after ${s.steps} actions. ${render(s)}`);
  console.log(out.join('\n'));
} else if (args.length || import.meta.url.endsWith(process.argv[1])) {
  const policy = args[0] ?? 'heur', games = +(args[1] ?? 300), seed0 = +(args[2] ?? 1);
  const res = { win: 0, dry: 0, stall: 0, exhausted: 0 }, steps = [], lens = {}, wl = {};
  const t0 = Date.now();
  for (let g = 0; g < games; g++) {
    const s = play(seed0 + g, policy);
    res[s.over]++;
    steps.push(s.steps);
    lens[s.L] = lens[s.L] || [0, 0];
    lens[s.L][1]++;
    if (s.over === 'win') lens[s.L][0]++;
  }
  const avg = steps.reduce((a, b) => a + b, 0) / games;
  console.log(`${policy}: win ${(100 * res.win / games).toFixed(1)}%  dry ${res.dry}  exhausted ${res.exhausted}  stall ${res.stall}  avg actions ${avg.toFixed(1)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log('win by lock length:', Object.entries(lens).map(([l, [w, n]]) => `L${l}: ${(100 * w / n).toFixed(0)}% of ${n}`).join('  '));
}
