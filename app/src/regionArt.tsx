import type { ReactNode } from 'react'
import type { WorldId } from './menu/worlds'

// Region art: a small landscape on face-up map regions, one per suit per world (the terrain table in menu/worlds.ts).
// Flavour only: it shows nothing the card face does not, and the rank + suit corner always stays clear of it.
// Flat shapes, no gradients or ids, so nine copies on the board can't clash. viewBox 54 × 46, the card's lower half.

const W = 54, H = 46

/** a pine: a tall triangle on a short trunk, standing on y */
const pine = (x: number, y: number, h: number) => `M${x} ${y - h}L${x - h * 0.32} ${y - 2}H${x + h * 0.32}Z`
/** a 4-point sparkle centred on x, y */
const spark = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`
/** a soft wave across the card from height y, `n` bumps of height `a` */
const wave = (y: number, a: number, n: number) => `M0 ${y}${Array.from({ length: n }, (_, i) => `q${W / n / 2} ${i % 2 ? a : -a} ${W / n} 0`).join('')}V${H}H0Z`
const sky = (fill: string) => <rect width={W} height={H} fill={fill} />
const stars = (fill: string, at: readonly (readonly [number, number])[]) => at.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.7} fill={fill} />)

const STARS = [[6, 6], [15, 12], [27, 4], [34, 13], [47, 7], [21, 9]] as const

/** in SUITS order: ♠ ♥ ♦ ♣ */
type Set4 = readonly [spades: ReactNode, hearts: ReactNode, diamonds: ReactNode, clubs: ReactNode]

const EARTH: Set4 = [
  // ♠ mountains
  <>
    {sky('#cde8f3')}
    <path d="M-2 46L16 12L34 46Z" fill="#7d8fa6" />
    <path d="M16 12L11.8 20L14.5 18.5L16.5 21L18.5 18.5L20.2 20Z" fill="#fff" />
    <path d="M20 46L38 8L58 46Z" fill="#5f7189" />
    <path d="M38 8L32.6 19.5L35.8 18L38.2 21L40.8 18L44 19.5Z" fill="#fff" />
    <rect y={40} width={W} height={6} fill="#5e9e5a" />
  </>,
  // ♥ meadow
  <>
    {sky('#cde8f3')}
    <circle cx={43} cy={10} r={5} fill="#ffd45c" />
    <path d={wave(28, 4, 2)} fill="#8fcf6a" />
    <path d={wave(36, 3, 3)} fill="#5fb04f" />
    {[[7, 41, '#e8434e'], [15, 38.5, '#fff'], [23, 43, '#ffd45c'], [31, 40, '#e8434e'], [40, 42.5, '#fff'], [47, 39.5, '#ffd45c']].map(([x, y, c]) => (
      <circle key={`${x}`} cx={x} cy={y} r={1.4} fill={c as string} />
    ))}
  </>,
  // ♦ desert
  <>
    {sky('#f7e7c4')}
    <circle cx={41} cy={11} r={6} fill="#ffb43a" />
    <path d="M0 32Q16 22 32 30T54 26V46H0Z" fill="#e8b765" />
    <path d="M0 40Q20 32 38 40T54 38V46H0Z" fill="#d49a45" />
    <g fill="#4f8a44">
      <rect x={14} y={24} width={4} height={16} rx={2} />
      <rect x={10} y={27} width={3} height={8} rx={1.5} /><rect x={10} y={32.5} width={6} height={2.5} />
      <rect x={19} y={25} width={3} height={7} rx={1.5} /><rect x={16} y={29.5} width={6} height={2.5} />
    </g>
  </>,
  // ♣ forest
  <>
    {sky('#cde8f3')}
    <path d={[pine(6, 36, 18), pine(19, 34, 22), pine(33, 35, 20), pine(47, 34, 23)].join('')} fill="#4f9a52" />
    <rect y={38} width={W} height={8} fill="#3f7a3a" />
    <path d={[pine(12, 44, 22), pine(27, 45, 26), pine(41, 44, 21)].join('')} fill="#2f6b35" />
  </>,
]

const CANDY: Set4 = [
  // ♠ rock-candy peaks
  <>
    {sky('#ffe3ef')}
    <path d="M4 46L14 16L24 46Z" fill="#b9a4ff" /><path d="M14 16L24 46H17Z" fill="#d8ccff" />
    <path d="M34 46L45 20L56 46Z" fill="#ff9ccf" /><path d="M45 20L56 46H48Z" fill="#ffc6e3" />
    <path d="M17 46L29 6L41 46Z" fill="#7fc8f5" /><path d="M29 6L41 46H32Z" fill="#c4ebff" />
    <path d={[spark(10, 9, 3), spark(47, 11, 2.5), spark(36, 30, 2)].join('')} fill="#fff" />
  </>,
  // ♥ frosting plains
  <>
    {sky('#ffe3ef')}
    <path d="M40 9q0-4 4-6" stroke="#4f8a44" strokeWidth={1.2} fill="none" />
    <circle cx={40} cy={13} r={4} fill="#e8344e" />
    <path d={wave(26, 3, 6)} fill="#fff6fa" />
    <path d={wave(37, 3, 6)} fill="#ffb7d3" />
    {[[6, 31, 30, '#7fc8f5'], [15, 33, -40, '#ffd45c'], [24, 30, 10, '#e8344e'], [33, 33, 60, '#8fd17a'], [42, 31, -20, '#b9a4ff'], [49, 34, 45, '#7fc8f5']].map(([x, y, r, c]) => (
      <rect key={`${x}`} x={(x as number) - 1.8} y={(y as number) - 0.6} width={3.6} height={1.2} rx={0.6} fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
    ))}
  </>,
  // ♦ caramel dunes
  <>
    {sky('#ffe9d6')}
    <circle cx={12} cy={11} r={5} fill="#fff3b0" />
    <path d="M0 30Q18 20 34 28T54 24V46H0Z" fill="#d98c3f" />
    <path d="M30 27.5q1.5 4 0 7q-1.5-3 0-7Z M42 25q1.3 3 0 5.5q-1.3-2.5 0-5.5Z" fill="#d98c3f" />
    <path d="M0 39Q20 31 38 39T54 37V46H0Z" fill="#b8692a" />
    <path d="M6 37q8-4 16-2" stroke="#f2b56b" strokeWidth={1.2} strokeLinecap="round" fill="none" />
  </>,
  // ♣ candy-cane woods
  <>
    {sky('#ffe3ef')}
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
    {sky('#1d2150')}
    {stars('#f2f0ff', STARS)}
    <path d="M0 46V30L8 22L13 27L21 14L28 24L34 19L42 28L48 21L54 26V46Z" fill="#8a8fa8" />
    <path d="M21 14L28 24L24 24ZM48 21L54 26L50 27Z" fill="#5c6080" />
    <path d="M0 46V38L10 32L18 37L28 30L38 38L46 33L54 36V46Z" fill="#5c6080" />
  </>,
  // ♥ ice flats
  <>
    {sky('#1d2150')}
    {stars('#f2f0ff', STARS)}
    <rect y={18} width={W} height={28} fill="#cfe3f5" />
    <rect y={18} width={W} height={1.5} fill="#eef6ff" />
    <path d="M3 26l9 3l6-2l10 4M30 23l7 4l-2 6M38 37l7-4l9 1M8 36l6 3" stroke="#8fb5d9" strokeWidth={0.9} fill="none" />
    <path d={spark(22, 23, 2.6)} fill="#fff" />
  </>,
  // ♦ dust sea
  <>
    {sky('#1d2150')}
    {stars('#f2f0ff', STARS)}
    <circle cx={42} cy={10} r={4.5} fill="#4d8fd6" />
    <path d="M39.5 7.5q2 -1 2.5 1.5t2 2.5q-2 1.5-3.5-0.5z" fill="#6fbf6a" />
    <path d="M0 22Q27 18 54 22V46H0Z" fill="#6e6a80" />
    <path d="M4 28q6-2 12 0M26 26q7-2 14 0M12 33q7-2 14 0M34 32q7-2 14 0M2 38q7-2 14 0" stroke="#8f8ba6" strokeWidth={0.9} strokeLinecap="round" fill="none" />
  </>,
  // ♣ crater field
  <>
    {sky('#1d2150')}
    {stars('#f2f0ff', STARS)}
    <path d="M0 22Q27 18 54 22V46H0Z" fill="#9a9cb0" />
    {[[12, 30, 7], [36, 27, 5], [28, 39, 9], [48, 38, 4.5], [5, 41, 3.5]].map(([x, y, r]) => (
      <g key={`${x}`}>
        <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill="#7a7c92" />
        <ellipse cx={x + r * 0.12} cy={y + r * 0.06} rx={r * 0.78} ry={r * 0.3} fill="#5f6178" />
      </g>
    ))}
  </>,
]

const ART: Record<WorldId, Set4> = { earth: EARTH, candy: CANDY, moon: MOON }

/** the landscape of a region of suit `suit` (0–3, SUITS order) in a world */
export function RegionArt({ world, suit }: { world: WorldId; suit: number }) {
  return (
    <svg className="art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {ART[world][suit]}
    </svg>
  )
}
