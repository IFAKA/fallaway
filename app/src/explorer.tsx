import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { WorldId } from './menu/worlds'

// The explorer: "you are here" on the map, one character per world, standing on the middle region's top-right corner
// (clear of the rank + suit corner and the dig tag). Flavour only. Flat shapes in a 32 × 32 viewBox, like regionArt.tsx.

const SKIN = '#f1c6a0', INK = '#2a2238'

/** Moon: an astronaut in a round helmet with a gold visor */
const ASTRONAUT = <>
  <path d="M5 32q0-8 11-8t11 8z" fill="#eef0f8" stroke="#8d93bf" strokeWidth="1" />
  <rect x="13" y="26" width="6" height="3" rx="1" fill="#e85d5d" />
  <line x1="23" y1="6" x2="25" y2="1.5" stroke="#8d93bf" strokeWidth="1.2" />
  <circle cx="25" cy="1.8" r="1.4" fill="#e85d5d" />
  <circle cx="16" cy="14" r="11" fill="#f6f7fc" stroke="#8d93bf" strokeWidth="1.2" />
  <rect x="8" y="9" width="16" height="11" rx="5.5" fill="#e3ad45" stroke="#a87a22" strokeWidth="1" />
  <path d="M11 11.5q2-1.5 5-1.5" stroke="#fff6dc" strokeWidth="1.6" strokeLinecap="round" fill="none" />
</>

/** Earth: a hiker in a wide-brim explorer hat and a red scarf */
const HIKER = <>
  <path d="M5 32q0-8 11-8t11 8z" fill="#5c8a3e" stroke="#3f6629" strokeWidth="1" />
  <path d="M10 25q6 3 12 0l-1 3q-5 2-10 0z" fill="#d6453b" />
  <circle cx="16" cy="16" r="8" fill={SKIN} />
  <circle cx="13" cy="16.5" r="1" fill={INK} /><circle cx="19" cy="16.5" r="1" fill={INK} />
  <path d="M13.5 19.5q2.5 1.6 5 0" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
  <path d="M10 11q0-7 6-7t6 7z" fill="#b07a3e" />
  <rect x="10" y="9.5" width="12" height="2" fill="#6e4520" />
  <ellipse cx="16" cy="11.5" rx="13" ry="2.6" fill="#8f5f2c" />
</>

/** Sugar Rose: a candy kid in a gumdrop helmet dusted with sugar */
const CANDY_KID = <>
  <path d="M5 32q0-8 11-8t11 8z" fill="#7fd9c0" stroke="#4fae95" strokeWidth="1" />
  <circle cx="16" cy="17" r="8" fill={SKIN} />
  <circle cx="12" cy="19.5" r="1.6" fill="#ff9cbf" /><circle cx="20" cy="19.5" r="1.6" fill="#ff9cbf" />
  <circle cx="13" cy="17" r="1" fill={INK} /><circle cx="19" cy="17" r="1" fill={INK} />
  <path d="M14 20.5q2 1.4 4 0" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
  <path d="M6.5 14q0-11 9.5-11t9.5 11q-9.5-3-19 0z" fill="#ff5f9e" stroke="#c93a76" strokeWidth="1" />
  <circle cx="11" cy="8" r=".9" fill="#fff" /><circle cx="16" cy="5.5" r=".9" fill="#fff" />
  <circle cx="20.5" cy="8.5" r=".9" fill="#fff" /><circle cx="14" cy="10.5" r=".9" fill="#fff" />
</>

const LOOK: Record<WorldId, ReactNode> = { moon: ASTRONAUT, earth: HIKER, candy: CANDY_KID }
const NAME: Record<WorldId, string> = { moon: 'astronaut', earth: 'hiker', candy: 'candy kid' }

/**
 * The explorer at `left`, `top` (stage coordinates). It hops each time the map moves under it (`step` changes), and
 * climbs down into the region while you dig there (it comes back out when the dig ends).
 */
export function Explorer({ world, left, top, step, digging }: { world: WorldId; left: number; top: number; step: number; digging: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="explorer"
      style={{ left, top }}
      initial={false}
      animate={digging ? (reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.4 }) : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduce ? 0.2 : 0.35, ease: 'easeOut' }}
      role="img"
      aria-label={`You are here (the ${NAME[world]})`}
    >
      <motion.svg key={step} viewBox="0 0 32 32" width="32" height="32" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 0.45, ease: 'easeOut' }}>
        {LOOK[world]}
      </motion.svg>
    </motion.div>
  )
}
