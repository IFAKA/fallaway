import type { CSSProperties, ReactNode } from 'react'
import type { WorldId } from './menu/worlds'

// Region art: a small landscape on face-up map regions, one per suit per world (the terrain table in menu/worlds.ts).
// Flavour only: it shows nothing the card face does not, and the rank + suit corner always stays clear of it.
// Flat shapes, no gradients or ids, so nine copies on the board can't clash. viewBox 54 × 46, the card's lower half.
// Every biome of a world shares one sky, so a scene draws only its ground; the ground meets itself at both edges, so
// a biome's backdrop can repeat it across the screen (see Panorama).

const W = 54, H = 46

/** a pine: a tall triangle on a short trunk, standing on y */
const pine = (x: number, y: number, h: number) => `M${x} ${y - h}L${x - h * 0.32} ${y - 2}H${x + h * 0.32}Z`
/** a 4-point sparkle centred on x, y */
const spark = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`
/** a soft wave across the card from height y, `n` bumps of height `a` */
const wave = (y: number, a: number, n: number) => `M0 ${y}${Array.from({ length: n }, (_, i) => `q${W / n / 2} ${i % 2 ? a : -a} ${W / n} 0`).join('')}V${H}H0Z`

/** in SUITS order: ♠ ♥ ♦ ♣ */
type Set4 = readonly [spades: ReactNode, hearts: ReactNode, diamonds: ReactNode, clubs: ReactNode]

/** a world's one sky: its colour, maybe stars, and one body hanging in it (a sun, or Earth seen from the Moon),
 *  drawn around cx, cy within radius r */
interface Sky { colour: string; stars?: string; body: { cx: number; cy: number; r: number; node: ReactNode } }

/** where a card's stars sit; a backdrop scatters them over the whole sky instead */
const STARS = [[6, 6], [15, 12], [27, 4], [34, 13], [47, 7], [21, 9]] as const

const EARTH_SKY: Sky = { colour: '#cde8f3', body: { cx: 8, cy: 9, r: 5, node: <circle cx={8} cy={9} r={5} fill="#ffd45c" /> } }
const CANDY_SKY: Sky = { colour: '#ffe3ef', body: { cx: 8, cy: 9, r: 5, node: <circle cx={8} cy={9} r={5} fill="#fff3b0" /> } }
const MOON_SKY: Sky = {
  colour: '#1d2150',
  stars: '#f2f0ff',
  body: {
    cx: 8, cy: 9, r: 4.5,
    node: <><circle cx={8} cy={9} r={4.5} fill="#4d8fd6" /><path d="M5.5 6.5q2 -1 2.5 1.5t2 2.5q-2 1.5-3.5-0.5z" fill="#6fbf6a" /></>,
  },
}

const EARTH: Set4 = [
  // ♠ mountains
  <>
    <path d="M-2 46L16 12L34 46Z" fill="#7d8fa6" />
    <path d="M16 12L11.8 20L14.5 18.5L16.5 21L18.5 18.5L20.2 20Z" fill="#fff" />
    <path d="M20 46L38 8L58 46Z" fill="#5f7189" />
    <path d="M38 8L32.6 19.5L35.8 18L38.2 21L40.8 18L44 19.5Z" fill="#fff" />
    <rect y={40} width={W} height={6} fill="#5e9e5a" />
  </>,
  // ♥ meadow
  <>
    <path d={wave(28, 4, 2)} fill="#8fcf6a" />
    <path d={wave(36, 3, 3)} fill="#5fb04f" />
    {[[7, 41, '#e8434e'], [15, 38.5, '#fff'], [23, 43, '#ffd45c'], [31, 40, '#e8434e'], [40, 42.5, '#fff'], [47, 39.5, '#ffd45c']].map(([x, y, c]) => (
      <circle key={`${x}`} cx={x} cy={y} r={1.4} fill={c as string} />
    ))}
  </>,
  // ♦ desert
  <>
    <path d="M0 30Q14 21 27 27T54 30V46H0Z" fill="#e8b765" />
    <path d="M0 39Q14 33 27 38T54 39V46H0Z" fill="#d49a45" />
    <g fill="#4f8a44">
      <rect x={14} y={24} width={4} height={16} rx={2} />
      <rect x={10} y={27} width={3} height={8} rx={1.5} /><rect x={10} y={32.5} width={6} height={2.5} />
      <rect x={19} y={25} width={3} height={7} rx={1.5} /><rect x={16} y={29.5} width={6} height={2.5} />
    </g>
  </>,
  // ♣ forest
  <>
    <path d={[pine(6, 40, 18), pine(19, 40, 24), pine(33, 40, 21), pine(47, 40, 25)].join('')} fill="#4f9a52" />
    <rect y={37} width={W} height={9} fill="#3f7a3a" />
    <path d={[pine(12, 44, 22), pine(27, 45, 26), pine(41, 44, 21)].join('')} fill="#2f6b35" />
  </>,
]

const CANDY: Set4 = [
  // ♠ rock-candy peaks
  <>
    <path d="M4 46L14 16L24 46Z" fill="#b9a4ff" /><path d="M14 16L24 46H17Z" fill="#d8ccff" />
    <path d="M34 46L45 20L56 46Z" fill="#ff9ccf" /><path d="M45 20L56 46H48Z" fill="#ffc6e3" />
    <path d="M17 46L29 6L41 46Z" fill="#7fc8f5" /><path d="M29 6L41 46H32Z" fill="#c4ebff" />
    <path d={[spark(47, 11, 2.5), spark(36, 30, 2), spark(10, 34, 1.8)].join('')} fill="#fff" />
  </>,
  // ♥ frosting plains, a cherry on top
  <>
    <path d={wave(26, 3, 6)} fill="#fff6fa" />
    <path d="M40 18q0-4 4-6" stroke="#4f8a44" strokeWidth={1.2} fill="none" />
    <circle cx={40} cy={21} r={3.5} fill="#e8344e" />
    <path d={wave(37, 3, 6)} fill="#ffb7d3" />
    {[[6, 31, 30, '#7fc8f5'], [15, 33, -40, '#ffd45c'], [24, 30, 10, '#e8344e'], [33, 33, 60, '#8fd17a'], [42, 31, -20, '#b9a4ff'], [49, 34, 45, '#7fc8f5']].map(([x, y, r, c]) => (
      <rect key={`${x}`} x={(x as number) - 1.8} y={(y as number) - 0.6} width={3.6} height={1.2} rx={0.6} fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
    ))}
  </>,
  // ♦ caramel dunes
  <>
    <path d="M0 28Q14 20 27 26T54 28V46H0Z" fill="#d98c3f" />
    <path d="M30 27q1.5 4 0 7q-1.5-3 0-7Z M42 29.5q1.3 3 0 5.5q-1.3-2.5 0-5.5Z" fill="#d98c3f" />
    <path d="M0 38Q14 32 27 37T54 38V46H0Z" fill="#b8692a" />
    <path d="M6 36q8-4 16-2" stroke="#f2b56b" strokeWidth={1.2} strokeLinecap="round" fill="none" />
  </>,
  // ♣ candy-cane woods
  <>
    <circle cx={46} cy={36} r={6} fill="#8fd17a" /><circle cx={30} cy={38} r={4.5} fill="#ffb7d3" />
    <rect y={39} width={W} height={7} fill="#9be0b0" />
    <g fill="none" strokeWidth={3.2} strokeLinecap="round">
      {[[8, 16], [22, 10], [37, 18]].map(([x, top]) => (
        <g key={x}>
          <path d={`M${x} 42V${top + 4}a4 4 0 0 1 8 0`} stroke="#fff" />
          <path d={`M${x} 42V${top + 4}a4 4 0 0 1 8 0`} stroke="#e8344e" strokeDasharray="2.6 2.6" strokeLinecap="butt" />
        </g>
      ))}
    </g>
  </>,
]

const MOON: Set4 = [
  // ♠ ridges
  <>
    <path d="M0 46V30L8 22L13 27L21 14L28 24L34 19L42 28L48 21L54 30V46Z" fill="#8a8fa8" />
    <path d="M21 14L28 24L24 24ZM48 21L54 30L50 29Z" fill="#5c6080" />
    <path d="M0 46V38L10 32L18 37L28 30L38 38L46 33L54 38V46Z" fill="#5c6080" />
  </>,
  // ♥ ice flats
  <>
    <rect y={18} width={W} height={28} fill="#cfe3f5" />
    <rect y={18} width={W} height={1.5} fill="#eef6ff" />
    <path d="M3 26l9 3l6-2l10 4M30 23l7 4l-2 6M38 37l7-4l9 1M8 36l6 3" stroke="#8fb5d9" strokeWidth={0.9} fill="none" />
    <path d={spark(22, 23, 2.6)} fill="#fff" />
  </>,
  // ♦ dust sea
  <>
    <path d="M0 22Q27 18 54 22V46H0Z" fill="#6e6a80" />
    <path d="M4 28q6-2 12 0M26 26q7-2 14 0M12 33q7-2 14 0M34 32q7-2 14 0M2 38q7-2 14 0" stroke="#8f8ba6" strokeWidth={0.9} strokeLinecap="round" fill="none" />
  </>,
  // ♣ crater field
  <>
    <path d="M0 22Q27 18 54 22V46H0Z" fill="#9a9cb0" />
    {[[12, 30, 7], [36, 27, 5], [28, 39, 9], [48, 38, 4.5], [5, 41, 3.5]].map(([x, y, r]) => (
      <g key={`${x}`}>
        <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill="#7a7c92" />
        <ellipse cx={x + r * 0.12} cy={y + r * 0.06} rx={r * 0.78} ry={r * 0.3} fill="#5f6178" />
      </g>
    ))}
  </>,
]

/** each biome's nearest ground colour (its scene's bottom edge), in SUITS order: the field in front of you while you dig */
const FIELD: Record<WorldId, readonly [string, string, string, string]> = {
  earth: ['#5e9e5a', '#5fb04f', '#d49a45', '#3f7a3a'],
  candy: ['#c9b8ff', '#ffb7d3', '#b8692a', '#9be0b0'],
  moon: ['#5c6080', '#cfe3f5', '#6e6a80', '#9a9cb0'],
}

const ART: Record<WorldId, { sky: Sky; scenes: Set4 }> = {
  earth: { sky: EARTH_SKY, scenes: EARTH },
  candy: { sky: CANDY_SKY, scenes: CANDY },
  moon: { sky: MOON_SKY, scenes: MOON },
}

/** the landscape of a region of suit `suit` (0–3, SUITS order) in a world, cropped to fill its box (the sky gives way first) */
export function Scene({ world, suit, className }: { world: WorldId; suit: number; className?: string }) {
  const { sky, scenes } = ART[world]
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <rect width={W} height={H} fill={sky.colour} />
      {sky.stars && STARS.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.7} fill={sky.stars} />)}
      {sky.body.node}
      {scenes[suit]}
    </svg>
  )
}

/** enough copies of the ground to span a wide window */
const TILES = 16

/** a sky's colour, with its stars scattered over all of it */
const skyFill = ({ colour, stars }: Sky): CSSProperties['background'] => stars
  ? `radial-gradient(circle, ${stars} 0 1px, transparent 1.5px) 0 0 / 53px 47px, radial-gradient(circle, ${stars} 0 0.8px, transparent 1.3px) 26px 21px / 71px 67px, ${colour}`
  : colour

/**
 * A biome filling a window: its world's sky with its sun (or Earth) at a natural size, and the region's ground
 * repeated in a strip along the bottom, so a forest is a row of pines rather than one pine as tall as the screen.
 * `walked`: how many pixels the ground has scrolled past to the left, as you walk through the biome.
 * `field`: the ground also runs on toward you below the strip, in the biome's nearest ground colour (a close-up view).
 */
export function Panorama({ world, suit, walked = 0, field = false }: { world: WorldId; suit: number; walked?: number; field?: boolean }) {
  const { sky, scenes } = ART[world]
  const { cx, cy, r, node } = sky.body
  return (
    <div className="panorama" style={{ background: skyFill(sky) }}>
      <svg className="panorama-body" viewBox={`${cx - r} ${cy - r} ${r * 2} ${r * 2}`} aria-hidden="true" focusable="false">{node}</svg>
      <div className="panorama-ground">
        <div className="panorama-strip" style={walked ? { transform: `translateX(${-walked}px)` } : undefined}>
          {Array.from({ length: TILES }, (_, i) => (
            <svg key={i} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">{scenes[suit]}</svg>
          ))}
        </div>
      </div>
      {field && <div className="panorama-field" style={{ backgroundColor: FIELD[world][suit], backgroundPositionX: -walked }} />}
    </div>
  )
}

/** the small landscape on a map card */
export const RegionArt = ({ world, suit }: { world: WorldId; suit: number }) => <Scene world={world} suit={suit} className="art" />
