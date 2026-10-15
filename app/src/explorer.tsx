import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { WorldId } from './menu/worlds'

// The explorer: "you are here" on the map, one little character per world, standing on the middle region's top-right
// corner (clear of the rank + suit corner and the dig tag). Flavour only. Flat shapes in a 28 × 44 viewBox, like
// regionArt.tsx: a head (helmet or hat), a body, and arms and legs that swing when it walks.

const VW = 28, VH = 44
const SKIN = '#f1c6a0', INK = '#2a2238'

interface Look {
  name: string
  head: ReactNode
  /** the head seen from behind (no face) */
  headBack: ReactNode
  /** drawn behind the body: a backpack */
  back?: ReactNode
  /** drawn over the torso: a scarf, a belt, a badge */
  front?: ReactNode
  suit: string; edge: string; arms: string; legs: string; boots: string
}

const LOOKS: Record<WorldId, Look> = {
  // Moon: an astronaut in a white suit, round helmet with a gold visor, life-support pack
  moon: {
    name: 'astronaut',
    suit: '#eef0f8', edge: '#8d93bf', arms: '#e2e5f2', legs: '#e2e5f2', boots: '#8d93bf',
    back: <rect x={6} y={17} width={16} height={12} rx={2} fill="#c9cce0" stroke="#8d93bf" strokeWidth={0.8} />,
    front: <><rect x={11.5} y={20} width={5} height={3} rx={0.8} fill="#e85d5d" /><rect x={11.5} y={24} width={5} height={1.4} rx={0.6} fill="#7fc4ff" /></>,
    head: <>
      <line x1={19} y1={4} x2={21} y2={0.8} stroke="#8d93bf" strokeWidth={1} />
      <circle cx={21} cy={0.9} r={1.1} fill="#e85d5d" />
      <circle cx={14} cy={10} r={8.5} fill="#f6f7fc" stroke="#8d93bf" strokeWidth={1} />
      <rect x={8} y={6.5} width={12} height={8} rx={4} fill="#e3ad45" stroke="#a87a22" strokeWidth={0.8} />
      <path d="M10 8.6q1.6-1.1 4-1.1" stroke="#fff6dc" strokeWidth={1.3} strokeLinecap="round" fill="none" />
    </>,
    headBack: <>
      <line x1={9} y1={4} x2={7} y2={0.8} stroke="#8d93bf" strokeWidth={1} />
      <circle cx={7} cy={0.9} r={1.1} fill="#e85d5d" />
      <circle cx={14} cy={10} r={8.5} fill="#f6f7fc" stroke="#8d93bf" strokeWidth={1} />
      <path d="M6 12.5q8 3 16 0" stroke="#c9cce0" strokeWidth={1.4} fill="none" />
    </>,
  },
  // Earth: a hiker in a wide-brim hat, green shirt, red scarf, a pack on the back
  earth: {
    name: 'hiker',
    suit: '#5c8a3e', edge: '#3f6629', arms: '#5c8a3e', legs: '#8a6a44', boots: '#5a3a1e',
    back: <rect x={6.5} y={17.5} width={15} height={11} rx={3} fill="#a0703c" stroke="#6e4520" strokeWidth={0.8} />,
    front: <><path d="M9 17.5q5 3 10 0l-.8 2.6q-4.2 1.8-8.4 0z" fill="#d6453b" /><rect x={8} y={27} width={12} height={1.6} fill="#6e4520" /></>,
    head: <>
      <circle cx={14} cy={11} r={6.5} fill={SKIN} />
      <circle cx={12} cy={11.6} r={0.8} fill={INK} /><circle cx={16} cy={11.6} r={0.8} fill={INK} />
      <path d="M12.4 14q1.6 1.1 3.2 0" stroke={INK} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      <path d="M9 7q0-6 5-6t5 6z" fill="#b07a3e" />
      <rect x={9} y={5.4} width={10} height={1.6} fill="#6e4520" />
      <ellipse cx={14} cy={7} rx={10.5} ry={2.1} fill="#8f5f2c" />
    </>,
    headBack: <>
      <circle cx={14} cy={11} r={6.5} fill="#6b4423" />
      <path d="M9 7q0-6 5-6t5 6z" fill="#b07a3e" />
      <rect x={9} y={5.4} width={10} height={1.6} fill="#6e4520" />
      <ellipse cx={14} cy={7} rx={10.5} ry={2.1} fill="#8f5f2c" />
    </>,
  },
  // Sugar Rose: a candy kid in a gumdrop helmet dusted with sugar, mint overalls, pink boots
  candy: {
    name: 'candy kid',
    suit: '#7fd9c0', edge: '#4fae95', arms: SKIN, legs: '#7fd9c0', boots: '#c93a76',
    front: <><rect x={10} y={19} width={8} height={7} rx={1.5} fill="#5fc4a8" /><circle cx={11.5} cy={19.8} r={0.8} fill="#fff" /><circle cx={16.5} cy={19.8} r={0.8} fill="#fff" /></>,
    head: <>
      <circle cx={14} cy={11.5} r={6.5} fill={SKIN} />
      <circle cx={10.8} cy={13.6} r={1.3} fill="#ff9cbf" /><circle cx={17.2} cy={13.6} r={1.3} fill="#ff9cbf" />
      <circle cx={12} cy={11.6} r={0.8} fill={INK} /><circle cx={16} cy={11.6} r={0.8} fill={INK} />
      <path d="M12.6 14.4q1.4 1 2.8 0" stroke={INK} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      <path d="M6.2 10q0-9.4 7.8-9.4t7.8 9.4q-7.8-2.6-15.6 0z" fill="#ff5f9e" stroke="#c93a76" strokeWidth={0.8} />
      <circle cx={10} cy={5.2} r={0.7} fill="#fff" /><circle cx={14} cy={3.2} r={0.7} fill="#fff" />
      <circle cx={17.8} cy={5.6} r={0.7} fill="#fff" /><circle cx={12.4} cy={7.2} r={0.7} fill="#fff" />
    </>,
    headBack: <>
      <circle cx={14} cy={11.5} r={6.5} fill="#8a4a2e" />
      <path d="M6.2 12q0-11.4 7.8-11.4t7.8 11.4q-7.8-2.6-15.6 0z" fill="#ff5f9e" stroke="#c93a76" strokeWidth={0.8} />
      <circle cx={10} cy={5.2} r={0.7} fill="#fff" /><circle cx={14} cy={3.2} r={0.7} fill="#fff" />
      <circle cx={17.8} cy={5.6} r={0.7} fill="#fff" /><circle cx={12.4} cy={8.2} r={0.7} fill="#fff" />
    </>,
  },
}

/** a limb that swings from its top end while walking */
const SWING = { originX: '50%', originY: '0%', transformBox: 'fill-box' } as const
const STEP = { duration: 0.6, ease: 'easeInOut' } as const

/** the explorer, from the front, or from `behind` (its pack on its back, no face) */
function Figure({ world, walking, behind = false }: { world: WorldId; walking: boolean; behind?: boolean }) {
  const L = LOOKS[world]
  const leg = (a: number) => walking ? { rotate: [0, a, -a, a, 0] } : { rotate: 0 }
  return <>
    {!behind && L.back}
    <motion.rect x={9} y={28} width={4.6} height={11} rx={2} fill={L.legs} stroke={L.edge} strokeWidth={0.6} style={SWING} animate={leg(26)} transition={STEP} />
    <motion.rect x={14.4} y={28} width={4.6} height={11} rx={2} fill={L.legs} stroke={L.edge} strokeWidth={0.6} style={SWING} animate={leg(-26)} transition={STEP} />
    <rect x={8} y={38} width={6} height={4.5} rx={1.8} fill={L.boots} />
    <rect x={14} y={38} width={6} height={4.5} rx={1.8} fill={L.boots} />
    <motion.rect x={4.2} y={18} width={4.2} height={10.5} rx={2} fill={L.arms} stroke={L.edge} strokeWidth={0.6} style={SWING} animate={leg(-22)} transition={STEP} />
    <motion.rect x={19.6} y={18} width={4.2} height={10.5} rx={2} fill={L.arms} stroke={L.edge} strokeWidth={0.6} style={SWING} animate={leg(22)} transition={STEP} />
    <rect x={8} y={16.5} width={12} height={13} rx={3.5} fill={L.suit} stroke={L.edge} strokeWidth={0.8} />
    {behind ? L.back : L.front}
    {behind ? L.headBack : L.head}
  </>
}

/** the explorer standing still, `size` tall: the map legend's "you are here" */
export function ExplorerIcon({ world, size = 22 }: { world: WorldId; size?: number }) {
  return <svg viewBox={`0 0 ${VW} ${VH}`} width={(size * VW) / VH} height={size} aria-hidden="true"><Figure world={world} walking={false} /></svg>
}

/**
 * The explorer at `left`, `top` (stage coordinates), `height` tall (seen from behind when `back`), fading in after `delay` seconds. When `step` changes and
 * `toward` gives the way it went (x, y), the explorer faces that way and walks: legs and arms swing and it strides part
 * of the way there. On the map that is toward the next region while the map slides under it; inside a biome (see
 * Practice) it walks along the trail while the ground scrolls past.
 */
export function Explorer({ world, left, top, step, toward, delay, height = 41, back = false }: {
  world: WorldId; left: number; top: number; step: number | string; toward: readonly number[] | null; delay: number; height?: number; back?: boolean
}) {
  const reduce = useReducedMotion()
  const walking = !!toward && !reduce
  const [dx, dy] = toward ?? [0, 0]
  return (
    <motion.div
      className="explorer"
      style={{ left, top }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay }}
      role="img"
      aria-label={`You are here (the ${LOOKS[world].name})`}
    >
      {/* remounted on every step, so each move plays its walk once */}
      <motion.div
        key={step}
        // from behind it walks away from you: two steps, a bob on each and the shoulders swaying side to side;
        // otherwise it strides toward the next region
        style={back ? { originX: 0.5, originY: 1 } : undefined}
        animate={!walking ? undefined : back
          ? { y: [0, -7, 0, -7, 0], rotate: [0, -3, 0, 3, 0], x: [0, -3, 0, 3, 0] }
          : { x: [0, dx * 0.35, 0], y: [0, dy * 0.35 - 5, dy * 0.2, 0] }}
        transition={{ duration: back ? 0.8 : 0.6, ease: 'easeInOut', delay }}
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} width={(height * VW) / VH} height={height} style={{ transform: dx < 0 ? 'scaleX(-1)' : undefined }}>
          {/* from behind it bobs as it walks; swinging arms that close up would look like flapping */}
          <Figure world={world} walking={walking && !back} behind={back} />
        </svg>
      </motion.div>
    </motion.div>
  )
}
