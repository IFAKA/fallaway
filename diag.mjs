import { play } from './sim.mjs';
const pol = process.argv[2] ?? 'heur', N = +(process.argv[3] ?? 2000);
let vSeen = 0, win = 0, prog = [0,0,0,0,0,0], sSeen = 0, sites = 0, zooms = 0;
for (let g = 1; g <= N; g++) {
  const s = play(g, pol);
  const vs = s.seen[s.vault]; vSeen += vs;
  if (s.over === 'win') win++;
  else { let n=0; for (const c of s.pack) if ((c&3)===s.S) n++; prog[Math.min(n,5)]++; }
  let ss = 0; for (let c = 0; c < 52; c++) if (s.seen[c] && (c&3)===s.S) ss++;
  sSeen += ss; zooms += s.stats.zooms;
}
console.log({ pol, N, vaultSeen: (vSeen/N).toFixed(2), win: (win/N).toFixed(3), sCardsSeenAvg: (sSeen/N).toFixed(1), zoomsAvg: (zooms/N).toFixed(1), packSCountAtLoss: prog });
