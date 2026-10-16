import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { WorldId } from './menu/worlds'
import { FLAP } from './menu/transition'
import { PACK_MOUTH } from './explorerPack'

// The explorer: "you are here" on the map, one little character per world, standing on the middle region's top-right
// corner (clear of the rank + suit corner and the dig tag). Flavour only. Chibi style, like the hostile creatures
// (creatures.tsx): a big head, a small body, a thick dark outline and a darker side for shading. Flat shapes in a
// 28 × 44 viewBox: a head (helmet or hat), a body, and arms and legs that swing when it walks.

const VW = 28, VH = 44
const SKIN = '#f1c6a0', INK = '#2a2238'
/** every shape gets the outline; shading and shine opt out */
const LINE = { stroke: INK, strokeWidth: 1.1, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const NO = { stroke: 'none' } as const

/** the darker right side of a round shape */
const Shade = ({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) =>
  <path {...NO} d={`M${cx} ${cy - ry}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}A${rx * 0.55} ${ry} 0 0 0 ${cx} ${cy - ry}Z`} fill="#000" opacity={0.16} />
/** a face: big eyes with a glint, rosy cheeks, a smile */
const Face = ({ y = 13.6 }: { y?: number }) => <>
  {[10.4, 17.6].map(x => <g key={x}>
    <ellipse {...NO} cx={x} cy={y} rx={1.4} ry={1.9} fill={INK} />
    <circle {...NO} cx={x - 0.45} cy={y - 0.7} r={0.55} fill="#fff" />
  </g>)}
  <ellipse {...NO} cx={8.2} cy={y + 2.6} rx={1.5} ry={0.95} fill="#ff8f9c" opacity={0.7} />
  <ellipse {...NO} cx={19.8} cy={y + 2.6} rx={1.5} ry={0.95} fill="#ff8f9c" opacity={0.7} />
  <path d={`M12.4 ${y + 3}q1.6 1.5 3.2 0`} fill="none" strokeWidth={0.9} />
</>

interface Look {
  name: string
  head: ReactNode
  /** the head seen from behind (no face) */
  headBack: ReactNode
  /** its backpack's colours: the bag, its flap, the front pocket */
  pack: { bag: string; flap: string; pocket: string }
  /** drawn over the torso: a scarf, a belt, a badge */
  front?: ReactNode
  suit: string; arms: string; legs: string; boots: string
}

const LOOKS: Record<WorldId, Look> = {
  // Moon: an astronaut in a white suit, round helmet with a gold visor, life-support pack
  moon: {
    name: 'astronaut',
    suit: '#eef0f8', arms: '#e2e5f2', legs: '#e2e5f2', boots: '#8d93bf',
    pack: { bag: '#c9cce0', flap: '#a9aecb', pocket: '#e85d5d' },
    front: <><rect x={11.5} y={22.5} width={5} height={3} rx={0.8} fill="#e85d5d" /><rect x={11.5} y={26.5} width={5} height={1.4} rx={0.6} fill="#7fc4ff" /></>,
    head: <>
      <path d="M20 4.5L22.5 0.8" fill="none" /><circle cx={22.6} cy={0.9} r={1.2} fill="#e85d5d" />
      <circle cx={14} cy={12} r={10.4} fill="#f6f7fc" /><Shade cx={14} cy={12} rx={10.4} ry={10.4} />
      <rect x={6.5} y={7.2} width={15} height={10} rx={5} fill="#e3ad45" />
      <path {...NO} d="M9 9.8q2 -1.4 5 -1.4" stroke="#fff6dc" strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </>,
    headBack: <>
      <path d="M8 4.5L5.5 0.8" fill="none" /><circle cx={5.4} cy={0.9} r={1.2} fill="#e85d5d" />
      <circle cx={14} cy={12} r={10.4} fill="#f6f7fc" /><Shade cx={14} cy={12} rx={10.4} ry={10.4} />
      <path d="M5 14.5q9 3.4 18 0" fill="none" stroke="#c9cce0" strokeWidth={1.4} />
    </>,
  },
  // Earth: a hiker in a wide-brim hat, green shirt, red scarf, a pack on the back
  earth: {
    name: 'hiker',
    suit: '#5c8a3e', arms: '#5c8a3e', legs: '#8a6a44', boots: '#5a3a1e',
    pack: { bag: '#a0703c', flap: '#7a4f24', pocket: '#8a5e30' },
    front: <><path d="M9.4 20.6q4.6 2.6 9.2 0l-.6 2.4q-4 1.6 -8 0z" fill="#d6453b" /><rect x={8.6} y={28.4} width={10.8} height={1.6} fill="#6e4520" /></>,
    head: <>
      <circle cx={14} cy={12.4} r={9.6} fill={SKIN} /><Shade cx={14} cy={12.4} rx={9.6} ry={9.6} />
      <path {...NO} d="M6 9.6q3 2 6 0.6q2 1.6 5 0.4q3 1.4 5 -0.6v-2h-16z" fill="#6b4423" />
      <Face />
      <path d="M8 7.4q0 -6.8 6 -6.8t6 6.8z" fill="#b07a3e" />
      <rect x={8} y={5.6} width={12} height={1.8} fill="#6e4520" />
      <ellipse cx={14} cy={7.6} rx={12.4} ry={2.4} fill="#8f5f2c" />
    </>,
    headBack: <>
      <circle cx={14} cy={12.4} r={9.6} fill="#6b4423" /><Shade cx={14} cy={12.4} rx={9.6} ry={9.6} />
      <path d="M8 7.4q0 -6.8 6 -6.8t6 6.8z" fill="#b07a3e" />
      <rect x={8} y={5.6} width={12} height={1.8} fill="#6e4520" />
      <ellipse cx={14} cy={7.6} rx={12.4} ry={2.4} fill="#8f5f2c" />
    </>,
  },
  // Sugar Rose: a candy kid in a gumdrop helmet dusted with sugar, mint overalls, pink boots
  candy: {
    name: 'candy kid',
    suit: '#7fd9c0', arms: SKIN, legs: '#7fd9c0', boots: '#c93a76',
    pack: { bag: '#ff9ccf', flap: '#c93a76', pocket: '#fff3b0' },
    front: <><rect x={10} y={22} width={8} height={6.4} rx={1.5} fill="#5fc4a8" /><circle {...NO} cx={11.6} cy={22.9} r={0.8} fill="#fff" /><circle {...NO} cx={16.4} cy={22.9} r={0.8} fill="#fff" /></>,
    head: <>
      <circle cx={14} cy={12.6} r={9.4} fill={SKIN} /><Shade cx={14} cy={12.6} rx={9.4} ry={9.4} />
      <Face y={14} />
      <path d="M4 10.6q0 -10 10 -10t10 10q-10 -3 -20 0z" fill="#ff5f9e" />
      {[[9.4, 4.8], [14, 2.8], [18.4, 5.2], [12, 7.2], [16.4, 7.6]].map(([x, y]) => <circle key={`${x}`} {...NO} cx={x} cy={y} r={0.75} fill="#fff" />)}
    </>,
    headBack: <>
      <circle cx={14} cy={12.6} r={9.4} fill="#8a4a2e" /><Shade cx={14} cy={12.6} rx={9.4} ry={9.4} />
      <path d="M4 13q0 -12.4 10 -12.4t10 12.4q-10 -3 -20 0z" fill="#ff5f9e" />
      {[[9.4, 4.8], [14, 2.8], [18.4, 5.2], [12, 8.2], [16.4, 8.6]].map(([x, y]) => <circle key={`${x}`} {...NO} cx={x} cy={y} r={0.75} fill="#fff" />)}
    </>,
  },
}

/** a limb that swings from its top end while walking */
const SWING = { originX: '50%', originY: '0%', transformBox: 'fill-box' } as const
const STEP = { duration: 0.6, ease: 'easeInOut' } as const

/**
 * The backpack seen from behind: straps over the shoulders, the bag, a flap with a buckle, a front pocket.
 * `stash` > 0: for that many seconds the flap flips up (showing the bag's opening), stays open, then closes.
 */
function Pack({ bag, flap, pocket, stash = 0 }: Look['pack'] & { stash?: number }) {
  return <>
    <rect x={7.4} y={21.4} width={13.2} height={11} rx={3.4} fill={bag} /><Shade cx={14} cy={26.9} rx={6.6} ry={5.5} />
    <ellipse {...NO} cx={PACK_MOUTH.x} cy={PACK_MOUTH.y} rx={5} ry={1.5} fill={INK} />
    <motion.g
      style={{ originX: '50%', originY: '0%', transformBox: 'fill-box' }}
      animate={stash > 0 ? { scaleY: [1, -1, -1, 1] } : { scaleY: 1 }}
      transition={stash > 0 ? { duration: stash, times: [0, FLAP.open / stash, 1 - FLAP.close / stash, 1], ease: 'easeInOut' } : { duration: 0 }}
    >
      <path d="M7.6 25V23.6q0 -2.2 2.2 -2.2h8.4q2.2 0 2.2 2.2V25q-6.4 2.4 -12.8 0z" fill={flap} />
      <rect x={13} y={24.6} width={2} height={2.4} rx={0.5} fill="#f2c230" strokeWidth={0.7} />
    </motion.g>
    <rect x={9.6} y={28} width={8.8} height={3.8} rx={1.4} fill={pocket} strokeWidth={0.8} />
  </>
}

/** a sword in the hand at the end of an arm hanging from the shoulder at 7, 21 */
const Sword = () => <>
  <path d="M5.9 31.2H8.1V42L7 44.6L5.9 42Z" fill="#e6ecf3" />
  <path {...NO} d="M7 32v10" stroke="#fff" strokeWidth={0.7} />
  <rect x={4.2} y={29.6} width={5.6} height={1.6} rx={0.7} fill="#c9932a" />
</>

/**
 * The explorer, from the front (its pack behind it), or from `behind` (its pack on its back, no face).
 * `swing` > 0 (from behind only): its left arm draws a sword and slashes to the left for that many seconds.
 */
function Figure({ world, walking, behind = false, stash = 0, swing = 0 }: { world: WorldId; walking: boolean; behind?: boolean; stash?: number; swing?: number }) {
  const L = LOOKS[world]
  const leg = (a: number) => walking ? { rotate: [0, a, -a, a, 0] } : { rotate: 0 }
  const leftArm = <motion.rect x={5} y={21} width={4} height={8.6} rx={2} fill={L.arms} style={SWING} animate={leg(-22)} transition={STEP} />
  return <g {...LINE}>
    {!behind && <rect x={5.6} y={20.4} width={16.8} height={10} rx={3.4} fill={L.pack.bag} />}
    <motion.rect x={9.4} y={30} width={4} height={7.4} rx={2} fill={L.legs} style={SWING} animate={leg(26)} transition={STEP} />
    <motion.rect x={14.6} y={30} width={4} height={7.4} rx={2} fill={L.legs} style={SWING} animate={leg(-26)} transition={STEP} />
    <rect x={8.4} y={36.2} width={5.8} height={4.4} rx={2} fill={L.boots} />
    <rect x={13.8} y={36.2} width={5.8} height={4.4} rx={2} fill={L.boots} />
    {!swing && leftArm}
    <motion.rect x={19} y={21} width={4} height={8.6} rx={2} fill={L.arms} style={SWING} animate={leg(22)} transition={STEP} />
    <rect x={8.4} y={19.6} width={11.2} height={11.4} rx={4.4} fill={L.suit} /><Shade cx={14} cy={25.3} rx={5.6} ry={5.7} />
    {behind ? <Pack {...L.pack} stash={stash} /> : L.front}
    {behind ? L.headBack : L.head}
    {/* raised over the head as it swings, so drawn last */}
    {swing > 0 && <g className="sword-swing" style={{ animationDuration: `${swing}s` }}>{leftArm}<Sword /></g>}
  </g>
}

/** the explorer standing still, `size` tall: the map legend's "you are here" */
export function ExplorerIcon({ world, size = 22 }: { world: WorldId; size?: number }) {
  return <svg viewBox={`0 0 ${VW} ${VH}`} width={(size * VW) / VH} height={size} overflow="visible" aria-hidden="true"><Figure world={world} walking={false} /></svg>
}

/**
 * The explorer at `left`, `top` (stage coordinates), `height` tall (seen from behind when `back`), fading in after `delay` seconds. When `step` changes and
 * `toward` gives the way it went (x, y), the explorer faces that way and walks: legs and arms swing and it strides part
 * of the way there. On the map that is toward the next region while the map slides under it; inside a biome (see
 * Practice) it walks along the trail while the ground scrolls past.
 */
export function Explorer({ world, left, top, step, toward, delay, height = 41, back = false, leave, stash = 0, swing = 0 }: {
  world: WorldId; left: number; top: number; step: number | string; toward: readonly number[] | null; delay: number; height?: number; back?: boolean
  /** leaving the biome across the field to the left (seen from behind): running when you flee, walking when you stop */
  leave?: { pace: 'run' | 'walk'; seconds: number }
  /** stopping a dig: for this many seconds the backpack opens, bounces as the loot drops in, and closes */
  stash?: number
  /** fighting a hostile card (seen from behind): for this many seconds it lunges and slashes with its sword */
  swing?: number
}) {
  const reduce = useReducedMotion()
  const walking = !!toward && !reduce
  const [dx, dy] = toward ?? [0, 0]
  return (
    <motion.div
      className={`explorer ${leave ? 'leaving' : ''}`}
      style={{ left, top }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: leave ? -height * 1.3 : 0 }}
      transition={{ opacity: { duration: 0.3, ease: 'easeOut', delay }, x: { duration: leave?.seconds ?? 0.6, ease: leave?.pace === 'walk' ? 'easeInOut' : 'easeIn' } }}
      role="img"
      aria-label={`You are here (the ${LOOKS[world].name})`}
    >
      {/* remounted on every step, so each move plays its walk once */}
      <motion.div
        key={step}
        // from behind it walks away from you: two steps, a bob on each and the shoulders swaying side to side;
        // otherwise it strides toward the next region
        style={back ? { originX: 0.5, originY: 1 } : undefined}
        animate={!walking ? undefined : swing
          ? { x: [0, 4, -14, -12, 0], y: [0, 2, -5, -4, 0] }
          : stash
          ? { y: [0, 0, 4, 0, 4, 0, 4, 0, 0], scaleY: [1, 1, 0.97, 1, 0.97, 1, 0.97, 1, 1] }
          : leave?.pace === 'run'
          ? { y: [0, -9, 0, -9, 0, -9, 0], rotate: -14 }
          : leave
          ? { y: [0, -6, 0, -6, 0, -6, 0, -6, 0], rotate: [0, -5, -2, -5, -2, -5, -2, -5, -3] }
          : back
          ? { y: [0, -7, 0, -7, 0], rotate: [0, -3, 0, 3, 0], x: [0, -3, 0, 3, 0] }
          : { x: [0, dx * 0.35, 0], y: [0, dy * 0.35 - 5, dy * 0.2, 0] }}
        transition={swing
          ? { duration: swing, times: [0, 0.3, 0.5, 0.75, 1], ease: 'easeOut' }
          : { duration: stash || leave?.seconds || (back ? 0.8 : 0.6), ease: leave ? 'linear' : 'easeInOut', delay }}
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} width={(height * VW) / VH} height={height} style={{ transform: dx < 0 ? 'scaleX(-1)' : undefined }}>
          {/* from behind it bobs as it walks; swinging arms that close up would look like flapping */}
          <Figure world={world} walking={walking && !back} behind={back} stash={reduce ? 0 : stash} swing={reduce || !back ? 0 : swing} />
        </svg>
      </motion.div>
    </motion.div>
  )
}
