import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { WorldId } from './menu/worlds'
import { ExplorerIcon } from './explorer'
import { Ground } from './regionArt'

// The end of a game, in its world: a small scene over your key suit's ground (the terrain the finish card stands in),
// played once when the game ends. Win: Earth's sun comes up, Sugar Rose rains sweets, Earth rises over the Moon.
// Lose: night falls, the sugar sun melts, Earth sets. Look only: the result and the record are the same everywhere.
// Flat shapes like regionArt.tsx; reduced motion shows the last frame, faded in.

/** the scene: four ground tiles (54 × 46 each, see regionArt.tsx) along the bottom of a wide sky */
const SW = 216, SH = 108, GY = SH - 46
/** where the sun (or Earth) hangs in the sky when it is up, and where it is when it is down behind the ground */
const BODY = { x: 156, up: 34, down: SH + 14, r: 11 }
/** how long the sky takes to change; the explorer reacts once it has */
const SKY_SECONDS = 1.6

interface Look {
  /** the sky before and after */
  sky: { win: [string, string]; lose: [string, string] }
  /** stars over the sky: always (the Moon), or coming out as night falls (Earth) */
  stars?: 'always' | 'night'
  /** the sun or Earth, drawn around 0, 0 */
  body: ReactNode
}

const LOOKS: Record<WorldId, Look> = {
  earth: {
    sky: { win: ['#f3a96b', '#cde8f3'], lose: ['#cde8f3', '#2c3358'] },
    stars: 'night',
    body: <><circle r={BODY.r + 5} fill="#ffd45c" opacity={0.3} /><circle r={BODY.r} fill="#ffd45c" /></>,
  },
  candy: {
    sky: { win: ['#ffe3ef', '#ffe3ef'], lose: ['#ffe3ef', '#b98aa0'] },
    body: <><circle r={BODY.r + 4} fill="#fff3b0" opacity={0.45} /><circle r={BODY.r} fill="#fff3b0" /></>,
  },
  moon: {
    sky: { win: ['#1d2150', '#1d2150'], lose: ['#1d2150', '#0c0e26'] },
    stars: 'always',
    body: <>
      <circle r={BODY.r + 3} fill="#7fb4ff" opacity={0.25} />
      <circle r={BODY.r} fill="#4d8fd6" />
      <path d="M-6 -5q4 -2 5 3t4 5q-4 3 -7 -1z M3 -9q4 1 5 5q-3 0 -5 -5z" fill="#6fbf6a" />
    </>,
  },
}

/** where the stars sit */
const STARS = [[12, 10], [34, 22], [58, 8], [80, 18], [104, 6], [126, 24], [150, 12], [178, 20], [200, 8], [22, 34], [92, 36], [190, 38]] as const
/** sweets falling on a Sugar Rose win: x, colour, shape (a sprinkle or a gumdrop), spin; spread by index, the same every time */
const SWEETS = Array.from({ length: 30 }, (_, i) => ({
  x: (i * 47 + 9) % SW,
  colour: ['#ff5f9e', '#7fc8f5', '#ffd45c', '#8fd17a', '#b9a4ff', '#e8344e'][i % 6],
  round: i % 3 === 0,
  spin: (i % 2 ? 1 : -1) * (200 + (i % 4) * 60),
  delay: (i % 7) * 0.14 + Math.floor(i / 7) * 0.05,
  fall: 1.5 + (i % 5) * 0.18,
}))
/** sugar drips running down from the top of the sky on a Sugar Rose loss */
const DRIPS = [[10, 18], [38, 30], [64, 14], [96, 26], [124, 20], [186, 32], [208, 16]] as const

function Scene({ world, suit, win }: { world: WorldId; suit: number; win: boolean }) {
  const reduce = !!useReducedMotion()
  const L = LOOKS[world]
  const [from, to] = win ? L.sky.win : L.sky.lose
  const slow = { duration: reduce ? 0 : SKY_SECONDS, ease: 'easeOut' } as const
  const night = L.stars === 'always' || (L.stars === 'night' && !win)
  return (
    <div className="ending-scene" aria-hidden="true">
      <svg viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="xMidYMax slice">
        <motion.rect width={SW} height={SH} initial={{ fill: reduce ? to : from }} animate={{ fill: to }} transition={slow} />
        {night && (
          <motion.g fill="#f2f0ff" initial={{ opacity: L.stars === 'always' || reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ ...slow, delay: reduce ? 0 : SKY_SECONDS * 0.5 }}>
            {STARS.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.9} />)}
          </motion.g>
        )}
        {/* the sun or Earth: comes up from behind the ground on a win, goes down behind it on a loss (the sugar sun melts instead) */}
        <motion.g
          initial={{ x: BODY.x, y: reduce ? (win || world === 'candy' ? BODY.up : BODY.down) : win && world !== 'candy' ? BODY.down : BODY.up, scaleY: 1 }}
          animate={world === 'candy' && !win ? { x: BODY.x, y: BODY.up + 8, scaleY: 1.35 } : { x: BODY.x, y: win || world === 'candy' ? BODY.up : BODY.down }}
          transition={slow}
        >
          {world === 'candy' && !win ? <g fill="#fff3b0">{L.body}<path d={`M-6 ${BODY.r - 2}q1 9 3 0zM4 ${BODY.r - 3}q1 13 3 0z`} /></g> : L.body}
        </motion.g>
        {world === 'candy' && !win && DRIPS.map(([x, len], i) => (
          <motion.path key={x} d={`M${x - 3} 0h6v${len}a3 3 0 0 1 -6 0z`} fill="#ff9ccf"
            style={{ originX: '50%', originY: '0%', transformBox: 'fill-box' }}
            initial={{ scaleY: reduce ? 1 : 0 }} animate={{ scaleY: 1 }} transition={{ duration: reduce ? 0 : 1.2, ease: 'easeIn', delay: reduce ? 0 : 0.2 + i * 0.12 }} />
        ))}
        {[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${i * 54} ${GY})`}><Ground world={world} suit={suit} /></g>)}
        {/* night (or the melt) dims the ground too */}
        {!win && <motion.rect width={SW} height={SH} fill="#0c0e26" initial={{ opacity: reduce ? 0.35 : 0 }} animate={{ opacity: 0.35 }} transition={slow} />}
        {world === 'candy' && win && !reduce && SWEETS.map((c, i) => (
          <motion.g key={i} initial={{ x: c.x, y: -8, rotate: 0 }} animate={{ y: SH + 8, rotate: c.spin, x: c.x + (i % 2 ? 10 : -10) }}
            transition={{ duration: c.fall, delay: c.delay, ease: 'easeIn' }}>
            {c.round ? <circle r={2.6} fill={c.colour} /> : <rect x={-3} y={-1} width={6} height={2} rx={1} fill={c.colour} />}
          </motion.g>
        ))}
      </svg>
      {/* the explorer, standing on the ground: it jumps for joy once the sky has changed, or sits down */}
      <motion.div className="ending-explorer"
        initial={{ y: 0, scaleY: 1 }}
        animate={reduce ? undefined : win ? { y: [0, -14, 0, -14, 0] } : { scaleY: [1, 0.86], y: [0, 3] }}
        transition={{ duration: win ? 0.9 : 0.5, ease: 'easeOut', delay: SKY_SECONDS * 0.7 }}>
        <ExplorerIcon world={world} size={52} />
      </motion.div>
    </div>
  )
}

/**
 * The end-of-game dialog over the board: the world's scene, then `children` (the result, the record and the buttons).
 * `suit`: your key suit, whose ground the scene stands on. The first button inside takes the focus.
 * `onClose`: a click outside closes it; without it (a loss) only its own buttons lead on.
 */
export function Ending({ world, suit, win, onClose, children }: { world: WorldId; suit: number; win: boolean; onClose?: () => void; children: ReactNode }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.querySelector('button')?.focus({ preventScroll: true }), [])
  return (
    <motion.div className="modal ending-backdrop" role="dialog" aria-modal="true" aria-labelledby="ending-title" onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
      // the last move plays out on the board first
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0.2 : 0.3, delay: reduce ? 0 : 0.6 }}>
      <div ref={ref} className={`card-modal ending ${win ? 'won' : 'lost'}`}>
        <Scene world={world} suit={suit} win={win} />
        {children}
      </div>
    </motion.div>
  )
}
