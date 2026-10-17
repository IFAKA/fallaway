import { useId } from 'react'
import type { ReactNode } from 'react'
import type { WorldId } from './menu/worlds'

// The map's background: the world you are on, seen from above, filling the map zone with its edge just past the
// corner regions. Colours follow the menu's planets (menu/planets/*). Flavour only, behind the cards.
// One copy on screen, so it may use ids (made unique with useId).

const W = 326, H = 404, CX = W / 2, CY = H / 2, R = 192

/** a smooth closed blob around cx, cy: one radius factor per point, joined with quadratic curves through the midpoints */
function blob(cx: number, cy: number, r: number, k: readonly number[]): string {
  const p = k.map((f, i) => { const a = (i / k.length) * Math.PI * 2; return [cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f] })
  const mid = (i: number) => { const a = p[i % p.length], b = p[(i + 1) % p.length]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }
  const m0 = mid(0)
  let d = `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`
  for (let i = 1; i <= p.length; i++) { const c = p[i % p.length], m = mid(i); d += `Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}` }
  return d + 'Z'
}

const MOON: ReactNode = <>
  <rect width={W} height={H} fill="#9a9bab" />
  {/* the dark plains (maria) */}
  <path d={blob(108, 140, 62, [1, 0.8, 1.1, 0.9, 1.2, 0.85, 1])} fill="#7b7c8e" />
  <path d={blob(222, 250, 54, [0.9, 1.15, 0.8, 1.1, 0.95, 1.2])} fill="#7b7c8e" />
  <path d={blob(140, 305, 38, [1, 0.8, 1.2, 0.9, 1.1])} fill="#828396" />
  <path d={blob(238, 118, 30, [1.1, 0.9, 1, 0.8, 1.2])} fill="#828396" />
  {/* craters: a shadowed bowl with a lit rim */}
  {([[86, 236, 17], [204, 84, 11], [262, 306, 15], [132, 104, 8], [176, 200, 7], [60, 168, 9], [292, 196, 10], [190, 348, 9], [110, 270, 6], [236, 176, 5], [150, 50, 7], [280, 252, 6]] as const).map(([x, y, r], i) => (
    <g key={i}>
      <circle cx={x} cy={y} r={r} fill="#6e6f80" stroke="#c4c5d2" strokeWidth={1.4} />
      <circle cx={x + r * 0.18} cy={y + r * 0.18} r={r * 0.72} fill="#85869a" />
    </g>
  ))}
</>

const EARTH: ReactNode = <>
  <rect width={W} height={H} fill="#2a6fae" />
  <path d={blob(96, 150, 70, [1, 1.2, 0.8, 1.1, 0.7, 1, 1.3, 0.9])} fill="#4f8f3a" />
  <path d={blob(84, 160, 30, [1, 0.8, 1.1, 0.9])} fill="#d9c88f" />
  <path d={blob(232, 236, 64, [0.9, 1.2, 1, 0.75, 1.1, 1.25, 0.8])} fill="#3b7533" />
  <path d={blob(250, 250, 24, [1, 1.2, 0.8, 1])} fill="#8a7a66" />
  <path d={blob(132, 312, 34, [1, 0.8, 1.2, 1, 0.9])} fill="#5a9a3c" />
  <path d={blob(236, 104, 22, [1, 1.3, 0.8, 1.1])} fill="#5a9a3c" />
  {/* ice caps */}
  <path d={blob(CX, 6, 110, [1, 0.35, 0.3, 1, 0.3, 0.35])} fill="#eef3f6" />
  <path d={blob(CX, H - 4, 100, [1, 0.3, 0.35, 1, 0.35, 0.3])} fill="#eef3f6" />
  {/* clouds */}
  <g fill="#fff" opacity={0.45}>
    <ellipse cx={150} cy={220} rx={60} ry={6} /><ellipse cx={176} cy={230} rx={40} ry={5} />
    <ellipse cx={90} cy={92} rx={44} ry={5} /><ellipse cx={250} cy={330} rx={50} ry={6} /><ellipse cx={210} cy={160} rx={30} ry={4} />
  </g>
</>

const SPRINKLES = ['#06d6a0', '#4cc9f0', '#ffd166', '#8e7dff', '#fafafa']
const CANDY: ReactNode = <>
  <rect width={W} height={H} fill="#ff86b3" />
  {/* candy swirls: wide bands across the globe */}
  <g fill="none" stroke="#ff5d95" strokeWidth={22} strokeLinecap="round" opacity={0.8}>
    <path d="M-20 120Q80 60 170 130T360 110" /><path d="M-20 230Q90 180 170 250T360 220" /><path d="M-20 340Q80 290 170 350T360 330" />
  </g>
  <g fill="none" stroke="#ffb3cf" strokeWidth={8} strokeLinecap="round">
    <path d="M-20 165Q80 115 170 185T360 160" /><path d="M-20 285Q80 235 170 300T360 275" />
  </g>
  {/* frosting cap with drips */}
  <path d="M0 0H326V52q-14 16-24 0t-30 6-28 18-26-14-34 10-30-4-32 16-30-12-28 6-26-10-38 4z" fill="#fff3f8" />
  {/* sprinkles */}
  {Array.from({ length: 38 }, (_, i) => {
    const x = (i * 97) % W, y = 70 + ((i * 53) % (H - 80)), a = (i * 47) % 180
    return <rect key={i} x={x - 4} y={y - 1.5} width={8} height={3} rx={1.5} fill={SPRINKLES[i % SPRINKLES.length]} transform={`rotate(${a} ${x} ${y})`} />
  })}
</>

const LOOK: Record<WorldId, ReactNode> = { moon: MOON, earth: EARTH, candy: CANDY }
const GLOW: Record<WorldId, string> = { moon: '#c4c5d2', earth: '#7cc4ff', candy: '#ffb3cf' }

/** the planet under the map: surface, latitude and longitude lines, light from the top left, a soft glow at its edge */
export function PlanetMap({ world }: { world: WorldId }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg className="planetmap" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <clipPath id={`${id}c`}><circle cx={CX} cy={CY} r={R} /></clipPath>
        <radialGradient id={`${id}s`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
          <stop offset=".45" stopColor="#fff" stopOpacity={0} />
          <stop offset=".8" stopColor="#000" stopOpacity={0.25} />
          <stop offset="1" stopColor="#000" stopOpacity={0.6} />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R + 3} fill="none" stroke={GLOW[world]} strokeWidth={6} opacity={0.35} />
      <g clipPath={`url(#${id}c)`}>
        {LOOK[world]}
        {/* latitude and longitude */}
        <g fill="none" stroke="#fff" strokeWidth={1} opacity={0.14}>
          {[0.35, 0.7].map(f => <ellipse key={f} cx={CX} cy={CY} rx={R * f} ry={R} />)}
          <line x1={CX} y1={0} x2={CX} y2={H} />
          {[-0.66, -0.33, 0, 0.33, 0.66].map(f => <line key={f} x1={0} y1={CY + R * f} x2={W} y2={CY + R * f} />)}
        </g>
        <circle cx={CX} cy={CY} r={R} fill={`url(#${id}s)`} />
      </g>
    </svg>
  )
}
