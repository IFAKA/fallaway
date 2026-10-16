import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SUITS, depthOf, suit } from '../../core/engine'
import { WORLDS, type WorldId } from './menu/worlds'
import { Scene } from './regionArt'

// Hostile creatures: the face of a hostile card while you dig. Each biome has three, picked by the card's rank in the
// same bands that set a region's dig depth (2–5 small, 6–10 medium, J–A big), so a bigger creature is a higher card.
// Look only: the card is the rule, the creature stands beside it. Chibi style like the explorer (explorer.tsx):
// big head, thick dark outline, a darker side for shading, angry brows, one prop each. No ids, so copies can't clash.
// viewBox 60 × 60, standing on y = 58.

const INK = '#2a2238'
/** every shape gets the outline; shading and shine opt out with `none` */
const LINE = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const NO = { stroke: 'none' } as const

/** the darker right side of a round shape: a crescent inside the ellipse at cx, cy */
const Shade = ({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) =>
  <path {...NO} d={`M${cx} ${cy - ry}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}A${rx * 0.55} ${ry} 0 0 0 ${cx} ${cy - ry}Z`} fill="#000" opacity={0.16} />
/** a soft highlight, top left */
const Shine = ({ cx, cy, rx, ry = rx * 0.6 }: { cx: number; cy: number; rx: number; ry?: number }) =>
  <ellipse {...NO} cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={0.45} transform={`rotate(-30 ${cx} ${cy})`} />
/** two big eyes with a glint, under angry brows slanting down to the middle */
function Eyes({ x, y, gap, s = 1 }: { x: number; y: number; gap: number; s?: number }) {
  return <>
    {[-1, 1].map(side => {
      const ex = x + side * gap
      return <g key={side}>
        <ellipse {...NO} cx={ex} cy={y} rx={2 * s} ry={2.6 * s} fill={INK} />
        <circle {...NO} cx={ex - 0.6 * s} cy={y - 0.9 * s} r={0.8 * s} fill="#fff" />
        <path d={`M${ex + side * 2.8 * s} ${y - 4.8 * s}L${ex - side * 1.8 * s} ${y - 3.2 * s}`} strokeWidth={1.9 * s} fill="none" />
      </g>
    })}
  </>
}
/** a cross mouth: a frown with one fang */
const Frown = ({ x, y, w = 5 }: { x: number; y: number; w?: number }) => <>
  <path d={`M${x - w / 2} ${y + 1}q${w / 2} -2.4 ${w} 0`} fill="none" />
  <path d={`M${x + w * 0.15} ${y - 0.2}l1 2.2l1 -2.4z`} fill="#fff" strokeWidth={0.9} />
</>
/** the shadow it casts on the ground */
const Ground = ({ w }: { w: number }) => <ellipse {...NO} cx={30} cy={58} rx={w} ry={2.2} fill="#000" opacity={0.22} />
/** a rope or a strap: a dark line under a coloured one, so it keeps the outline */
const Rope = ({ d, colour, w = 2.4 }: { d: string; colour: string; w?: number }) => <>
  <path d={d} fill="none" strokeWidth={w + 2} />
  <path d={d} fill="none" stroke={colour} strokeWidth={w} />
</>
/** spines over the top half of an ellipse, `n` points */
const spines = (cx: number, cy: number, rx: number, ry: number, n: number) => {
  const pts = Array.from({ length: n * 2 + 1 }, (_, i) => {
    const a = Math.PI + (i / (n * 2)) * Math.PI, k = i % 2 ? 1.28 : 1
    return `${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`
  })
  return `M${pts.join('L')}Q${cx + rx} ${cy + ry} ${cx} ${cy + ry}Q${cx - rx} ${cy + ry} ${pts[0]}Z`
}

/** several overlapping parts filled as one shape with one outline around the whole: outlined parts under plain ones */
const Blob = ({ fill, children }: { fill: string; children: ReactNode }) => <><g fill={fill}>{children}</g><g fill={fill} stroke="none">{children}</g></>
/** a fuzzy ball: a zigzag all round the circle at cx, cy, `n` tufts */
const fuzz = (cx: number, cy: number, r: number, n: number) =>
  `M${Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2, k = i % 2 ? 1.16 : 1
    return `${(cx + Math.cos(a) * r * k).toFixed(1)} ${(cy + Math.sin(a) * r * k).toFixed(1)}`
  }).join('L')}Z`
/** a 4-point sparkle centred on x, y */
const spark = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`
/** a candy-cane stripe along a path: white under red dashes, outlined */
const Cane = ({ d, w = 3 }: { d: string; w?: number }) => <>
  <path d={d} fill="none" strokeWidth={w + 2} />
  <path d={d} fill="none" stroke="#fff" strokeWidth={w} />
  <path d={d} fill="none" stroke="#e8344e" strokeWidth={w} strokeDasharray="2.4 2.4" strokeLinecap="butt" />
</>

// ---------- Earth ----------

/** ♠ mountains, small: a goat with a coil of climbing rope slung across it */
const Goat = <>
  <Ground w={14} />
  {[19, 36].map(x => <g key={x}><rect x={x} y={49} width={5} height={8} rx={2} fill="#ece7dd" /><rect x={x} y={54.5} width={5} height={3} rx={1} fill="#5a4a3e" /></g>)}
  <ellipse cx={30} cy={47} rx={14} ry={8.5} fill="#ece7dd" /><Shade cx={30} cy={47} rx={14} ry={8.5} />
  {/* the climbing rope: a coil at its hip on a strap across its body */}
  <Rope d="M21 40L41 52" colour="#c99556" w={1.8} />
  <Rope d="M34 50a6 3.6 0 1 0 12 0a6 3.6 0 1 0 -12 0M35.4 49.4a4.6 2.4 0 1 0 9.2 0" colour="#c99556" w={1.8} />
  {/* long horns swept back, ridged */}
  <path d="M25 17q-9 -5 -7 -15q4 7 10 11z M35 17q9 -5 7 -15q-4 7 -10 11z" fill="#b8a07a" />
  <path {...NO} d="M20 8l2.4 -0.6M21 11.4l2.6 -0.4M40 8l-2.4 -0.6M39 11.4l-2.6 -0.4" stroke="#8a7350" strokeWidth={1} />
  {/* floppy ears, drooping out to the sides */}
  <ellipse cx={17} cy={28} rx={6.5} ry={2.6} fill="#ece7dd" transform="rotate(25 17 28)" /><ellipse {...NO} cx={17.4} cy={28.2} rx={4} ry={1.2} fill="#d3c9b8" transform="rotate(25 17.4 28.2)" />
  <ellipse cx={43} cy={28} rx={6.5} ry={2.6} fill="#ece7dd" transform="rotate(-25 43 28)" /><ellipse {...NO} cx={42.6} cy={28.2} rx={4} ry={1.2} fill="#d3c9b8" transform="rotate(-25 42.6 28.2)" />
  {/* a long face with a grey muzzle and a beard */}
  <path d="M26.5 40q3.5 12 3.5 13q0 -1 3.5 -13z" fill="#d3c9b8" />
  <ellipse cx={30} cy={28} rx={10} ry={13} fill="#ece7dd" /><Shade cx={30} cy={28} rx={10} ry={13} /><Shine cx={25} cy={20} rx={2.6} />
  <ellipse cx={30} cy={36.5} rx={6.6} ry={4.6} fill="#bdb3a3" />
  <path d="M27.4 35.4l1.4 1M32.6 35.4l-1.4 1" fill="none" strokeWidth={1.2} />
  {/* goat eyes: yellow, with a sideways pupil, under angry brows */}
  {[-1, 1].map(side => <g key={side}>
    <ellipse cx={30 + side * 5} cy={26} rx={2.6} ry={2.2} fill="#f2dc7a" strokeWidth={1.1} />
    <rect {...NO} x={30 + side * 5 - 1.8} y={25.4} width={3.6} height={1.3} rx={0.6} fill={INK} />
    <path d={`M${30 + side * 8} 21.4L${30 + side * 3} 23`} strokeWidth={1.9} fill="none" />
  </g>)}
</>

/** ♠ mountains, medium: an eagle with flying goggles pushed up */
const Eagle = <>
  <Ground w={13} />
  {[24, 36].map(x => <path key={x} d={`M${x - 4} 58l2 -5h4l2 5z`} fill="#f2b230" />)}
  <ellipse cx={14.5} cy={40} rx={5} ry={11} fill="#5a3a1e" transform="rotate(15 14.5 40)" />
  <ellipse cx={45.5} cy={40} rx={5} ry={11} fill="#5a3a1e" transform="rotate(-15 45.5 40)" />
  <ellipse cx={30} cy={42} rx={13} ry={13} fill="#7a4f2c" /><Shade cx={30} cy={42} rx={13} ry={13} />
  <path d="M24 34q6 4 12 0q-1 9 -6 11q-5 -2 -6 -11z" fill="#f7f3ea" />
  <circle cx={30} cy={22} r={12} fill="#f7f3ea" /><Shade cx={30} cy={22} rx={12} ry={12} /><Shine cx={24.5} cy={15.5} rx={2.8} />
  <Rope d="M18.5 14.5q11.5 -5 23 0" colour="#5a3a1e" w={1.6} />
  <circle cx={25} cy={13} r={3.6} fill="#9fd8f0" /><circle cx={35} cy={13} r={3.6} fill="#9fd8f0" />
  <path {...NO} d="M23.4 11.8q1.2 -1.4 2.8 -1.2M33.4 11.8q1.2 -1.4 2.8 -1.2" stroke="#fff" strokeWidth={1} fill="none" />
  <Eyes x={30} y={22} gap={5} />
  <path d="M26 26q4 -3 8 0q0 5 -4 7q-1 -3 -4 -7z" fill="#f2b230" />
</>

/** ♠ mountains, big: a yeti with an ice axe */
const Yeti = <>
  <Ground w={20} />
  <ellipse cx={22} cy={55} rx={6.5} ry={3.2} fill="#a9bcd6" /><ellipse cx={38} cy={55} rx={6.5} ry={3.2} fill="#a9bcd6" />
  <Rope d="M51 54L53 13" colour="#8a5a2c" w={2.6} />
  <path d="M46 14q7 -6 13 -2l-5 2l1 4q-4 -3 -9 -1z" fill="#c9d3de" />
  <path d="M12 52q-4 -14 2 -26q0 -18 16 -20q16 2 16 20q6 12 2 26q-4 4 -18 4q-14 0 -18 -4z" fill="#eef3f8" />
  <Shade cx={30} cy={31} rx={18} ry={25} /><Shine cx={20} cy={16} rx={4} />
  <path d="M14 28l-3 3l3 1M46 28l3 3l-3 1M24 7l2 -3l2 3M32 7l2 -3l2 3" fill="none" strokeWidth={1.2} />
  <ellipse cx={8.5} cy={38} rx={5} ry={9} fill="#eef3f8" transform="rotate(12 8.5 38)" />
  <ellipse cx={50.5} cy={36} rx={5} ry={8} fill="#eef3f8" transform="rotate(-25 50.5 36)" />
  <ellipse cx={30} cy={27} rx={11} ry={9.5} fill="#a9bcd6" />
  <Eyes x={30} y={25} gap={5} />
  <path d="M25 31q5 3 10 0" fill="none" />
  <path d="M26.5 31.6l1 2.4l1.2 -2zM31.4 31.6l1.2 2.4l1 -2.4z" fill="#fff" strokeWidth={0.9} />
</>

/** ♥ meadow, small: a bee with a tiny spear, hovering */
const Bee = <>
  <Ground w={10} />
  {/* a long spear held low, pointing ahead, clear of the antennae */}
  <Rope d="M36 48L6 41" colour="#a0703c" w={1.6} />
  <path d="M6.5 39L0 39.4L5.5 43z" fill="#c9d3de" />
  <ellipse cx={37} cy={22} rx={6} ry={9} fill="#e6f6ff" opacity={0.85} transform="rotate(20 37 22)" />
  <ellipse cx={45} cy={25} rx={4.5} ry={7} fill="#e6f6ff" opacity={0.85} transform="rotate(40 45 25)" />
  <path d="M48.5 36l5 2l-5 2z" fill={INK} />
  <ellipse cx={39} cy={38} rx={11} ry={9} fill="#ffd23f" />
  <rect {...NO} x={36} y={29.2} width={3.6} height={17.6} rx={1.8} fill={INK} />
  <rect {...NO} x={43} y={31} width={3.2} height={14} rx={1.6} fill={INK} />
  <ellipse cx={39} cy={38} rx={11} ry={9} fill="none" />
  <Shade cx={39} cy={38} rx={11} ry={9} />
  <path d="M18 21q-2 -7 -6 -9M26 20q2 -7 6 -9" fill="none" /><circle cx={12} cy={12} r={1.8} fill={INK} /><circle cx={32} cy={11} r={1.8} fill={INK} />
  <circle cx={22} cy={31} r={11} fill="#ffd23f" /><Shade cx={22} cy={31} rx={11} ry={11} /><Shine cx={17} cy={25} rx={2.6} />
  <Eyes x={22} y={30} gap={4.5} s={0.9} />
  <Frown x={22} y={35.5} w={4} />
</>

/** ♥ meadow, medium: a boar with a club */
const Boar = <>
  <Ground w={17} />
  {[17, 24, 36, 43].map(x => <rect key={x} x={x} y={49} width={5} height={8} rx={2} fill="#5a3a24" />)}
  {/* the club, resting against its side */}
  <path d="M40 45L53 12q5 0 6 4L45 47z" fill="#b07a3e" /><path {...NO} d="M52 20l2.4 1M49 28l2.4 1" stroke="#7a4f24" strokeWidth={1.2} />
  <ellipse cx={32} cy={45} rx={17} ry={10.5} fill="#8a5a3c" /><Shade cx={32} cy={45} rx={17} ry={10.5} />
  <path d="M30 35l3 -4l2 3l3 -4l2 3l3 -3l1 4" fill="#5a3a24" />
  {/* a short front leg raised in front of the club, its hoof gripping it */}
  <rect x={42.6} y={38.4} width={6} height={9.6} rx={3} fill="#8a5a3c" transform="rotate(28 45.6 43.2)" />
  <rect x={42.6} y={37.6} width={6} height={3.4} rx={1.4} fill="#3a2a22" transform="rotate(28 45.6 43.2)" />
  {/* ears on the top corners of the head, pink inside */}
  <path d="M12.2 22.8Q7.6 16.4 8.6 12.2Q15 13.2 18.7 17.3Z M27.3 17.3Q31 13.2 37.4 12.2Q38.4 16.4 33.8 22.8Z" fill="#8a5a3c" />
  <path {...NO} d="M13.2 20.6Q10.6 16.4 11 14.6Q14.8 15.4 16.8 17.6Z M29.2 17.6Q31.2 15.4 35 14.6Q35.4 16.4 32.8 20.6Z" fill="#c98a74" />
  <circle cx={23} cy={29} r={12.5} fill="#9a6646" /><Shade cx={23} cy={29} rx={12.5} ry={12.5} /><Shine cx={17.5} cy={22.5} rx={2.8} />
  {/* a darker snout than the bull's */}
  <ellipse cx={17} cy={35} rx={6.5} ry={5} fill="#c98a74" />
  <ellipse {...NO} cx={15} cy={35} rx={1} ry={1.3} fill={INK} /><ellipse {...NO} cx={19} cy={35} rx={1} ry={1.3} fill={INK} />
  <path d="M12 38q-2 -4 0 -7l1.5 4zM23 38q2 -4 0 -7l-1.5 4z" fill="#fff" strokeWidth={1.1} />
  <Eyes x={21} y={26} gap={4.6} s={0.95} />
</>

/** ♥ meadow, big: a bull with a nose ring and a mallet */
const Bull = <>
  <Ground w={20} />
  {[16, 39].map(x => <g key={x}><rect x={x} y={47} width={6} height={9} rx={2.4} fill="#7a3b2e" /><rect x={x} y={53.5} width={6} height={3.5} rx={1} fill="#3a2a22" /></g>)}
  <ellipse cx={30} cy={45} rx={18} ry={10} fill="#7a3b2e" /><Shade cx={30} cy={45} rx={18} ry={10} />
  {/* the mallet: a handle and a thick barrel-shaped head with iron bands */}

  {/* horns growing out of the top of the head, curving up */}
  <path d="M24 17Q11 18 7 5Q15 11 22 10.4Z M36 17Q49 18 53 5Q45 11 38 10.4Z" fill="#f4ecd8" />
  <path {...NO} d="M12 12.6l2 -1.6M48 12.6l-2 -1.6" stroke="#cbbf9f" strokeWidth={1.1} />
  <ellipse cx={13} cy={24} rx={5.5} ry={3} fill="#7a3b2e" transform="rotate(-15 13 24)" />
  <ellipse cx={47} cy={24} rx={5.5} ry={3} fill="#7a3b2e" transform="rotate(15 47 24)" />
  <Rope d="M56 55L56 32" colour="#a0703c" w={2.6} />
  <rect x={49} y={20} width={15} height={12} rx={5} fill="#9a6a3e" /><Shade cx={56.5} cy={26} rx={7.5} ry={6} />
  <path d="M53 20.4v11.2M60 20.4v11.2" fill="none" stroke="#5a4a3e" strokeWidth={1.6} />
  <path {...NO} d="M50.8 23.2q2.4 -1.8 5 -1.4" stroke="#fff" strokeWidth={1.1} opacity={0.5} fill="none" />
  <circle cx={30} cy={25} r={15} fill="#8a4636" /><Shade cx={30} cy={25} rx={15} ry={15} /><Shine cx={23} cy={17} rx={3.4} />
  <path {...NO} d="M27 11.6q3 -3 6 0q-3 3 -6 0z" fill="#f4ecd8" />
  <ellipse cx={30} cy={33} rx={9} ry={6} fill="#e8b4a0" />
  <ellipse {...NO} cx={26.5} cy={32.5} rx={1.3} ry={1.8} fill={INK} /><ellipse {...NO} cx={33.5} cy={32.5} rx={1.3} ry={1.8} fill={INK} />
  <Rope d="M27.6 36.8a2.4 2.4 0 1 0 4.8 0" colour="#f2c230" w={1.4} />
  <Eyes x={30} y={23} gap={6} s={1.1} />
</>

/** ♦ desert, small: a scorpion in a bandana */
const Scorpion = <>
  <Ground w={16} />
  {[22, 28, 34, 40].map(x => <path key={x} d={`M${x} 52l-2 5`} fill="none" />)}
  <circle cx={46} cy={46} r={4.6} fill="#e0913a" /><circle cx={50} cy={37.5} r={4.2} fill="#e0913a" /><circle cx={49} cy={29} r={3.8} fill="#e0913a" />
  <circle cx={44} cy={23} r={3.5} fill="#e0913a" /><path d="M41 22.5q-5 -2 -4 3q2 -1 4 -1z" fill="#5a3a24" />
  <ellipse cx={32} cy={48} rx={13} ry={7} fill="#e0913a" /><Shade cx={32} cy={48} rx={13} ry={7} />
  <path d="M6 44q-4 -6 2 -9l3 3l-3 1l4 2q-2 4 -6 3z" fill="#e0913a" /><path d="M10 54q-5 -4 0 -8l2 3l-3 1l4 2q-1 3 -3 2z" fill="#e0913a" />
  <path d="M12 42l5 1M13 51l5 -1" fill="none" />
  <circle cx={21} cy={40} r={10} fill="#eba04a" /><Shade cx={21} cy={40} rx={10} ry={10} /><Shine cx={16.5} cy={34.5} rx={2.4} />
  <path d="M15 47q6 4 13 0l1 4q-8 4 -15 0z" fill="#d6453b" /><path {...NO} d="M18 49.5h1M22 50.5h1M26 49.5h1" stroke="#fff" strokeWidth={1.2} />
  <Eyes x={21} y={39} gap={4} s={0.85} />
  <Frown x={21} y={43.5} w={3.6} />
</>

/** ♦ desert, medium: a rattlesnake in a cowboy hat */
const Snake = <>
  <Ground w={18} />
  <ellipse cx={30} cy={52} rx={18} ry={5.5} fill="#c9a24a" /><Shade cx={30} cy={52} rx={18} ry={5.5} />
  <ellipse cx={51} cy={47} rx={2.6} ry={1.8} fill="#e8d6a0" /><ellipse cx={52} cy={43.5} rx={2.4} ry={1.7} fill="#e8d6a0" /><ellipse cx={53} cy={40.2} rx={2.1} ry={1.5} fill="#e8d6a0" />
  <ellipse cx={30} cy={45} rx={14} ry={5} fill="#c9a24a" /><Shade cx={30} cy={45} rx={14} ry={5} />
  {[[18, 52], [30, 53.5], [42, 52], [21, 45], [39, 45]].map(([x, y]) => <path key={`${x},${y}`} {...NO} d={`M${x} ${y - 2}l2.4 2l-2.4 2l-2.4 -2z`} fill="#8a6a2a" />)}
  {/* its body rises thick out of the coil to the head, a pale belly down the front */}
  <path d="M22 47C20 40 25.6 36.4 22.6 30H32C34.4 36.4 37.6 40 35.6 47Z" fill="#c9a24a" />
  <path {...NO} d="M26.4 46.6C25.4 40.4 29 36.6 26.8 31H29.4C31.8 36.6 31.8 40.4 31.4 46.6Z" fill="#e8d6a0" />
  <Shade cx={31} cy={38.5} rx={4.8} ry={8.5} />
  <ellipse cx={27} cy={25} rx={12} ry={9.5} fill="#d4ae55" /><Shade cx={27} cy={25} rx={12} ry={9.5} /><Shine cx={21.5} cy={20} rx={2.6} />
  <path d="M19 13q1 -9 8 -9t8 9z" fill="#8a5a2c" /><rect {...NO} x={19.3} y={10.6} width={15.4} height={2} fill="#5a3a1e" />
  <ellipse cx={27} cy={13.8} rx={14} ry={2.8} fill="#a0703c" />
  <Eyes x={27} y={24} gap={5} s={0.95} />
  {/* an open mouth, the forked tongue flicking out of it */}
  <ellipse cx={27} cy={30.4} rx={2.6} ry={1.5} fill={INK} />
  <path d="M27 31v4.6l-1.6 2M27 35.6l1.6 2" stroke="#d6453b" strokeWidth={1.3} fill="none" />
</>

/** ♦ desert, big: a sandworm in a miner's helmet, coming up out of the sand */
const Worm = <>
  {/* the hole it comes out of */}
  <ellipse cx={30} cy={55.5} rx={20} ry={4.5} fill="#4a3220" />
  <path d="M15 57V30q0 -16 15 -16t15 16v27z" fill="#d98a6a" /><Shade cx={30} cy={36} rx={15} ry={22} />
  <path {...NO} d="M16 40q14 4 28 0M16 48q14 4 28 0" stroke="#a8604a" strokeWidth={1.6} fill="none" />
  <path d="M15 57V30q0 -16 15 -16t15 16v27" fill="none" />
  {/* the sand rim in front of it, piled up at both sides */}
  <path d="M4 56Q4 61.5 30 61.5Q56 61.5 56 56Q48 59 30 59Q12 59 4 56Z" fill="#e3b46a" />
  <path d="M2 58.5Q7 50 17 54.5Q15 58.6 2 58.5Z M58 58.5Q53 50 43 54.5Q45 58.6 58 58.5Z" fill="#e3b46a" />
  <path {...NO} d="M6 55.6q3 -2 6 -0.6M48 55q3 -1.4 6 0.6" stroke="#c9934a" strokeWidth={1.1} fill="none" />
  <path d="M14.5 22q0 -14 15.5 -14t15.5 14z" fill="#f2c230" /><rect x={14} y={20.5} width={32} height={3} rx={1.4} fill="#c9932a" />
  <circle cx={30} cy={13} r={3.6} fill="#fff7b0" /><circle {...NO} cx={30} cy={13} r={6.5} fill="#fff7b0" opacity={0.3} />
  <Eyes x={30} y={29} gap={5.5} />
  <ellipse cx={30} cy={37} rx={7.5} ry={3.8} fill={INK} />
  <path {...NO} d="M23.5 36l1.6 2l1.4 -2.6l1.4 2.8l1.4 -3l1.4 3l1.4 -2.8l1.4 2.6l1.6 -2" fill="#fff" />
</>

/** ♣ forest, small: a hedgehog in an acorn-cap helmet */
const Hedgehog = <>
  <Ground w={14} />
  <path d={spines(32, 47, 15, 11, 7)} fill="#6b4a2e" /><Shade cx={32} cy={47} rx={15} ry={11} />
  {[22, 36].map(x => <ellipse key={x} cx={x} cy={57} rx={3.4} ry={2} fill="#4a3220" />)}
  <ellipse cx={20} cy={47} rx={9} ry={8} fill="#f1d2a8" /><Shine cx={15.6} cy={44} rx={2} />
  <circle cx={11.4} cy={48.5} r={1.8} fill={INK} />
  {/* an acorn cap for a helmet: a scaly dome with a stem, sitting on its head */}
  <path d="M9.6 42.4Q9 30 20 30Q31 30 30.4 42.4Q20 39 9.6 42.4Z" fill="#a0703c" />
  <path {...NO} d="M13 37.6l2.6 -2.6l2.6 2.6l2.6 -2.6l2.6 2.6l2.6 -2.6l2.6 2.6M15.6 33.4l2.6 -2l2.6 2l2.6 -2" stroke="#7a4f24" strokeWidth={1} fill="none" />
  <path d="M9.6 42.4Q20 39 30.4 42.4" fill="none" />
  <Rope d="M20 30.4q0 -3 2.6 -4.4" colour="#6e4520" w={1.6} />
  <Eyes x={19.5} y={46} gap={3.3} s={0.75} />
  <path d="M15.4 52.4q2 -1.5 4 0" fill="none" strokeWidth={1.2} />
</>

/** ♣ forest, medium: a wolf with a lantern */
const Wolf = <>
  <Ground w={15} />
  <path d="M42 50q12 -2 12 -14q-6 6 -12 5z" fill="#6d7686" />
  <ellipse cx={32} cy={46} rx={13} ry={10.5} fill="#7d8796" /><Shade cx={32} cy={46} rx={13} ry={10.5} />
  <path d="M28 41q4 6 8 0q0 7 -4 9q-4 -2 -4 -9z" fill="#e8eaee" />
  {[24, 36].map(x => <ellipse key={x} cx={x} cy={56} rx={4} ry={2.4} fill="#6d7686" />)}
  <path d="M10 33q-1 -6 4 -6t4 6M14 27v-3" fill="none" />
  <circle {...NO} cx={14} cy={38} r={8} fill="#ffe08a" opacity={0.35} />
  <rect x={10} y={33} width={8} height={10} rx={2} fill="#ffd45c" /><rect x={9} y={31.5} width={10} height={2.4} rx={1} fill="#5a4a3e" /><rect x={9} y={42.5} width={10} height={2.4} rx={1} fill="#5a4a3e" />
  <path d="M17 18l-1 -13l8 7zM39 18l1 -13l-8 7z" fill="#6d7686" /><path {...NO} d="M17.6 15l-0.4 -6l3.6 3.4zM38.4 15l0.4 -6l-3.6 3.4z" fill="#f2a6b0" />
  <circle cx={28} cy={26} r={12.5} fill="#8a94a3" /><Shade cx={28} cy={26} rx={12.5} ry={12.5} /><Shine cx={22.5} cy={19.5} rx={2.8} />
  <ellipse cx={28} cy={32} rx={7} ry={5} fill="#e8eaee" />
  <ellipse cx={28} cy={29.6} rx={2.2} ry={1.5} fill={INK} />
  <path d="M25 34.5q3 2 6 0" fill="none" /><path d="M25.6 34.4l0.8 2l0.9 -1.8zM29.2 34.8l0.9 1.8l0.8 -2z" fill="#fff" strokeWidth={0.8} />
  <Eyes x={28} y={24} gap={5} s={0.95} />
</>

/** ♣ forest, big: a lumberjack bear with an axe */
const Bear = <>
  <Ground w={20} />
  {[20, 40].map(x => <ellipse key={x} cx={x} cy={55} rx={6} ry={3.4} fill="#7a4f2e" />)}
  <ellipse cx={30} cy={45} rx={18} ry={11.5} fill="#d6453b" />
  <path {...NO} d="M18 36v20M26 34v23M34 34v23M42 36v20M12 42h36M13 50h34" stroke="#8a1f1a" strokeWidth={1.4} opacity={0.6} />
  <ellipse cx={30} cy={45} rx={18} ry={11.5} fill="none" /><Shade cx={30} cy={45} rx={18} ry={11.5} />
  <Rope d="M51 55L51 17" colour="#a0703c" w={2.6} />
  <path d="M51 18q-10 -1 -12 6q4 6 12 4z" fill="#c9d3de" /><path {...NO} d="M41.5 23.5q2 -3 5 -3.5" stroke="#fff" strokeWidth={1} fill="none" />
  <ellipse cx={47.5} cy={40} rx={5} ry={4} fill="#8a5a3a" />
  <circle cx={17} cy={13} r={5} fill="#8a5a3a" /><circle {...NO} cx={17} cy={13} r={2.4} fill="#c99a74" />
  <circle cx={43} cy={13} r={5} fill="#8a5a3a" /><circle {...NO} cx={43} cy={13} r={2.4} fill="#c99a74" />
  <circle cx={30} cy={25} r={15} fill="#9a6644" /><Shade cx={30} cy={25} rx={15} ry={15} /><Shine cx={23} cy={17} rx={3.4} />
  <path d="M18 17q12 -12 24 0q-12 -3 -24 0z" fill="#2f6b35" /><circle cx={30} cy={8.6} r={2.2} fill="#f4ecd8" />
  <ellipse cx={30} cy={31} rx={8} ry={6} fill="#e2c39a" />
  <path d="M27.4 28.4h5.2l-2.6 3z" fill={INK} />
  <path d="M26.5 34.5q3.5 -2 7 0" fill="none" />
  <Eyes x={30} y={23} gap={6} s={1.1} />
</>

// ---------- Sugar Rose ----------

/** ♠ rock-candy peaks, small: a sugar cube on pink legs, with a toothpick spear */
const SugarCube = <>
  <Ground w={13} />
  <Rope d="M13 56L17 24" colour="#f4d79a" w={1.4} /><path d="M15.8 25L17.4 18.4L18.6 25.2z" fill="#f4d79a" />
  {[23, 32].map(x => <g key={x}><rect x={x} y={50} width={4.4} height={6} rx={2} fill="#ff9ccf" /><ellipse cx={x + 2.2} cy={56.6} rx={3.2} ry={1.8} fill="#c93a76" /></g>)}
  <path d="M18 30L24 24H46L40 30Z" fill="#fff" />
  <path d="M40 30L46 24V46L40 52Z" fill="#e3e0f0" />
  <rect x={18} y={30} width={22} height={22} rx={2} fill="#fbfaff" />
  {[[21, 33], [36, 34], [22, 49], [37, 48], [44, 30], [27, 26]].map(([x, y]) => <circle key={`${x},${y}`} {...NO} cx={x} cy={y} r={0.7} fill="#cfc9e6" />)}
  <path d="M30 25l2.4 -7l2.4 7z" fill="#b9a4ff" />
  <Eyes x={29} y={39} gap={4.5} s={0.85} />
  <Frown x={29} y={45} w={4} />
</>

/** ♠ rock-candy peaks, medium: a cotton-candy bat on a paper stick, flapping */
const CottonBat = <>
  <Ground w={9} />
  <Rope d="M30 40V52" colour="#f4ecd8" w={2} />
  <path d="M19 27Q8 16 1 22Q5 25 4 29Q8 28 10 32Q13 29 19 33Z M41 27Q52 16 59 22Q55 25 56 29Q52 28 50 32Q47 29 41 33Z" fill="#c46fa8" />
  <path d="M22 21l-2 -9l7 5zM38 21l2 -9l-7 5z" fill="#ff9ccf" />
  <Blob fill="#ffb3d9"><circle cx={30} cy={31} r={9} /><circle cx={22} cy={32} r={6.5} /><circle cx={38} cy={32} r={6.5} /><circle cx={30} cy={23.5} r={7.5} /><circle cx={25} cy={38} r={5} /><circle cx={35} cy={38} r={5} /></Blob>
  <Shade cx={33} cy={31} rx={10} ry={11} /><Shine cx={24} cy={23} rx={2.6} />
  <Eyes x={30} y={29} gap={4.5} s={0.9} />
  <Frown x={30} y={35} w={4.4} />
</>

/** ♠ rock-candy peaks, big: a rock-candy golem with a crystal on a stick */
const CandyGolem = <>
  <Ground w={20} />
  <Rope d="M54 56L54 22" colour="#fff" w={2.6} />
  <path d="M54 9l6 6l-2 8h-8l-2 -8z" fill="#c9b8ff" /><path {...NO} d="M54 9l2 6l-2 8z" fill="#fff" opacity={0.5} />
  <ellipse cx={8} cy={38} rx={5} ry={9} fill="#7fb0e0" transform="rotate(12 8 38)" />
  <ellipse cx={51} cy={36} rx={5} ry={8} fill="#7fb0e0" transform="rotate(-20 51 36)" />
  <path d="M15 22l-5 -11l8 6zM45 22l5 -11l-8 6z" fill="#c9b8ff" />
  <path d="M14 56L10 34L18 16L30 10L42 16L50 34L46 56Z" fill="#9fd0f5" />
  <path {...NO} d="M18 16L30 10L26 24ZM10 34L18 16L20 32ZM14 56L10 34L22 46Z" fill="#cfeaff" />
  <path {...NO} d="M42 16L50 34L40 30ZM46 56L50 34L38 46Z" fill="#7fb0e0" />
  <Eyes x={30} y={30} gap={6} s={1.1} />
  {/* a frown with two fangs, like the other big ones */}
  <path d="M24.6 40.4q5.4 -3.6 10.8 0" fill="none" />
  <path d="M25.8 39.6l1.2 2.6l1.4 -2.4zM31.6 38.6l1.4 2.4l1.2 -2.6z" fill="#fff" strokeWidth={0.9} />
</>

/** ♥ frosting plains, small: a cupcake with a cherry on top */
const Cupcake = <>
  <Ground w={12} />
  {[24, 36].map(x => <ellipse key={x} cx={x} cy={56.6} rx={3.4} ry={1.8} fill="#c93a76" />)}
  <path d="M18 40H42L39 56H21Z" fill="#7fc8f5" />
  <path {...NO} d="M23 41l1 14M28 41l0.4 14M32 41l-0.4 14M37 41l-1 14" stroke="#5aa8dc" strokeWidth={1.2} />
  <path d="M15.6 41Q13.6 34 19.6 33Q19.6 26 26.6 27Q30 21 34 26Q41 25 41 32Q46.4 34 44.4 41Z" fill="#fff0f6" />
  {[[20, 37, 30, '#ff5f9e'], [26, 31, -40, '#7fc8f5'], [34, 30, 20, '#ffd45c'], [39, 36, -30, '#8fd17a'], [30, 37, 70, '#b9a4ff']].map(([x, y, r, c]) => (
    <rect key={`${x}`} {...NO} x={(x as number) - 1.8} y={(y as number) - 0.6} width={3.6} height={1.2} rx={0.6} fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
  ))}
  <path d="M31 19.6q0 -4 3 -5" fill="none" /><circle cx={31} cy={22.4} r={3} fill="#e8344e" />
  <Eyes x={30} y={46} gap={4} s={0.8} />
  <Frown x={30} y={51} w={3.6} />
</>

/** ♥ frosting plains, medium: a marshmallow bunny with a toasting fork */
const MarshBunny = <>
  <Ground w={14} />
  <Rope d="M50 56L50 16" colour="#c9d3de" w={1.8} />
  <path d="M46.6 16.6H53.4M47 16.6V9M50 16.6V8M53 16.6V9" fill="none" strokeWidth={2.6} />
  <path d="M46.6 16.6H53.4M47 16.6V9M50 16.6V8M53 16.6V9" fill="none" stroke="#c9d3de" strokeWidth={1.2} />
  <rect x={18} y={1} width={7} height={18} rx={3.5} fill="#fffaf5" transform="rotate(-12 21.5 10)" />
  <rect {...NO} x={20} y={4} width={3} height={12} rx={1.5} fill="#ffc6dd" transform="rotate(-12 21.5 10)" />
  <rect x={35} y={1} width={7} height={18} rx={3.5} fill="#fffaf5" transform="rotate(12 38.5 10)" />
  <rect {...NO} x={37} y={4} width={3} height={12} rx={1.5} fill="#ffc6dd" transform="rotate(12 38.5 10)" />
  {[23, 37].map(x => <ellipse key={x} cx={x} cy={56} rx={4.4} ry={2.4} fill="#fffaf5" />)}
  <rect x={17} y={33} width={26} height={22} rx={9} fill="#fffaf5" /><Shade cx={30} cy={44} rx={13} ry={11} />
  <rect x={15} y={14} width={30} height={22} rx={10} fill="#fffaf5" /><Shade cx={30} cy={25} rx={15} ry={11} />
  <ellipse {...NO} cx={22} cy={46} rx={3} ry={2} fill="#f2d2b0" /><ellipse {...NO} cx={36} cy={41} rx={2.4} ry={1.6} fill="#f2d2b0" />
  <Eyes x={30} y={24} gap={5.5} />
  <ellipse {...NO} cx={30} cy={28.6} rx={1.4} ry={1} fill="#ff8fb0" />
  <path d="M27.6 30.4q2.4 1.6 4.8 0" fill="none" /><rect x={28.6} y={30.8} width={2.8} height={2.4} rx={0.6} fill="#fff" strokeWidth={0.9} />
</>

/** ♥ frosting plains, big: a gingerbread knight with a candy-cane sword and a peppermint shield */
const GingerKnight = <>
  <Ground w={18} />
  <Cane d="M49 34L56 6" w={3} />
  <path d="M20 26H40Q52 26 54 32Q54 36 48 35L42 34V44L46 55Q46 58 41 58L35 50H25L19 58Q14 58 14 55L18 44V34L12 35Q6 36 6 32Q8 26 20 26Z" fill="#c47a3a" />
  <Shade cx={34} cy={42} rx={9} ry={15} />
  <path {...NO} d="M9 30l2 2l2 -2M47 30l2 2l2 -2M17 52l2 2l2 -2M39 52l2 2l2 -2" stroke="#fff" strokeWidth={1.2} fill="none" />
  <circle cx={30} cy={32} r={1.8} fill="#e8344e" /><circle cx={30} cy={38} r={1.8} fill="#8fd17a" /><circle cx={30} cy={44} r={1.8} fill="#ffd45c" />
  <circle cx={10} cy={38} r={7.4} fill="#fff" />
  <path {...NO} d="M10 38L10 30.6A7.4 7.4 0 0 1 16.4 34.3ZM10 38L16.4 41.7A7.4 7.4 0 0 1 10 45.4ZM10 38L3.6 41.7A7.4 7.4 0 0 1 3.6 34.3Z" fill="#e8344e" />
  <circle cx={10} cy={38} r={7.4} fill="none" />
  <circle cx={30} cy={16} r={11} fill="#c47a3a" /><Shade cx={30} cy={16} rx={11} ry={11} /><Shine cx={25} cy={10} rx={2.6} />
  <Eyes x={30} y={15} gap={4.5} />
  <path d="M26 21.4q4 -2.4 8 0" fill="none" stroke="#fff" strokeWidth={1.4} />
</>

/** ♦ caramel dunes, small: a two-tone gummy worm, arching out of the sand */
const GummyWorm = <>
  <Ground w={12} />
  <path d="M12 56Q13 38 24 38Q32 38 34 30" fill="none" strokeWidth={11.6} />
  <path d="M12 56Q12.4 46 17 41.6" fill="none" stroke="#7ad66b" strokeWidth={9} />
  <path d="M17 41.6Q19.6 38 24 38Q32 38 34 30" fill="none" stroke="#ff8a3d" strokeWidth={9} />
  {[[14, 50], [18, 41], [26, 39.4], [31, 35]].map(([x, y]) => <circle key={`${x}`} {...NO} cx={x} cy={y} r={0.8} fill="#fff" />)}
  <circle cx={35} cy={26} r={8} fill="#ff8a3d" /><Shade cx={35} cy={26} rx={8} ry={8} /><Shine cx={31.4} cy={22} rx={2} />
  <Eyes x={35} y={25} gap={3.4} s={0.8} />
  <Frown x={35} y={30} w={3.4} />
</>

/** ♦ caramel dunes, medium: a donut beetle, its shell a frosted donut with sprinkles, two pincer horns up front */
const DonutBeetle = <>
  <Ground w={18} />
  {[20, 27, 36, 43].map(x => <path key={x} d={`M${x} 50l${x < 32 ? -2.6 : 2.6} 7`} fill="none" strokeWidth={2} />)}
  {/* the donut: dough all round, pink frosting dripping over the top, the hole in the middle */}
  <ellipse cx={33} cy={42} rx={17} ry={11} fill="#d9a05b" /><Shade cx={33} cy={42} rx={17} ry={11} />
  <path d="M18 40Q18 30 33 30Q48 30 48 40Q46 44 44 41Q42 46 39 42Q36 47 33 43Q30 47 27 42Q24 46 22 41Q20 44 18 40Z" fill="#ff8fc0" />
  <ellipse cx={34} cy={38} rx={4.6} ry={2.4} fill="#8a5428" />
  {[[23, 35, 30, '#7fc8f5'], [28, 33, -40, '#ffd45c'], [40, 33, 20, '#fff'], [44, 37, -30, '#8fd17a'], [26, 39, 70, '#b9a4ff'], [39, 41, 10, '#e8344e']].map(([x, y, r, c]) => (
    <rect key={`${x},${y}`} {...NO} x={(x as number) - 1.8} y={(y as number) - 0.6} width={3.6} height={1.2} rx={0.6} fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
  ))}
  <Shine cx={25} cy={33} rx={2.6} />
  {/* pincer horns, then the head in front of the shell */}
  <path d="M9.6 38.6Q4.6 28 14.6 23.6Q10.6 30 14 36.4Z M22.4 38.6Q27.4 28 17.4 23.6Q21.4 30 18 36.4Z" fill="#b8692a" />
  <circle cx={16} cy={44} r={8.4} fill="#8a5a34" /><Shade cx={16} cy={44} rx={8.4} ry={8.4} /><Shine cx={12.6} cy={40.4} rx={2} />
  <Eyes x={16} y={43.6} gap={3.4} s={0.78} />
  <Frown x={16} y={48.4} w={3.4} />
</>

/** ♦ caramel dunes, big: a chocolate-bar golem in its wrapper, with a big spoon */
const ChocoGolem = <>
  <Ground w={20} />
  <Rope d="M54 56L54 22" colour="#c99556" w={2.6} /><ellipse cx={54} cy={15} rx={5} ry={7} fill="#c99556" />
  <rect x={4} y={28} width={9} height={18} rx={4} fill="#6b3a1f" />
  <rect x={47} y={28} width={9} height={16} rx={4} fill="#6b3a1f" />
  {[19, 35].map(x => <rect key={x} x={x} y={50} width={7} height={7} rx={2} fill="#4a2814" />)}
  <rect x={12} y={14} width={36} height={40} rx={4} fill="#6b3a1f" />
  {[0, 1, 2].map(r => [0, 1].map(c => <rect key={`${r}${c}`} {...NO} x={15 + c * 15.5} y={17 + r * 8} width={14} height={6.4} rx={1.4} fill="#7d4626" />))}
  <Shade cx={34} cy={34} rx={14} ry={20} />
  <rect x={11} y={38} width={38} height={17} rx={2} fill="#c93a76" />
  <path d="M11 38l3 -3l3 3l3 -3l3 3l3 -3l3 3l3 -3l3 3l3 -3l3 3l3 -3l3 3z" fill="#f2c230" />
  <path {...NO} d="M18 45h24M18 49h24" stroke="#fff" strokeWidth={1.2} opacity={0.6} />
  <Eyes x={30} y={23} gap={6} s={1.05} />
  <Frown x={30} y={30.6} w={5} />
</>

/** ♣ candy-cane woods, small: a lollipop fairy on its stick, fluttering */
const Lollipop = <>
  <Ground w={8} />
  <Rope d="M30 36V50" colour="#fff" w={2.2} />
  <ellipse cx={18} cy={22} rx={5} ry={8} fill="#e6f6ff" opacity={0.85} transform="rotate(-30 18 22)" />
  <ellipse cx={42} cy={22} rx={5} ry={8} fill="#e6f6ff" opacity={0.85} transform="rotate(30 42 22)" />
  <circle cx={30} cy={26} r={11} fill="#ff5f9e" />
  <path {...NO} d="M30 26m-2 0a2 2 0 1 1 4 0a4 4 0 1 1 -8 0a6 6 0 1 1 12 0a8 8 0 1 1 -16 0" fill="none" stroke="#fff" strokeWidth={1.6} opacity={0.75} />
  <circle cx={30} cy={26} r={11} fill="none" /><Shade cx={30} cy={26} rx={11} ry={11} />
  <Eyes x={30} y={25} gap={4.4} s={0.85} />
  <Frown x={30} y={30.4} w={3.6} />
</>

/** ♣ candy-cane woods, medium: a jelly gummy bear with a candy-cane club */
const GummyBear = <>
  <Ground w={15} />
  <Cane d="M48 56V26a4.5 4.5 0 0 0 -9 0" w={3} />
  <Blob fill="#5fd38a">
    <circle cx={20} cy={13} r={4.4} /><circle cx={40} cy={13} r={4.4} />
    <circle cx={30} cy={22} r={11} /><ellipse cx={30} cy={42} rx={12} ry={13} />
    <ellipse cx={17} cy={38} rx={4} ry={6} transform="rotate(25 17 38)" /><ellipse cx={43} cy={38} rx={4} ry={6} transform="rotate(-25 43 38)" />
    <ellipse cx={22} cy={54} rx={5} ry={4} /><ellipse cx={38} cy={54} rx={5} ry={4} />
  </Blob>
  <Shade cx={30} cy={42} rx={12} ry={13} /><Shine cx={24} cy={15} rx={3.2} /><Shine cx={23} cy={36} rx={3} />
  <ellipse {...NO} cx={30} cy={44} rx={6} ry={7} fill="#fff" opacity={0.2} />
  <Eyes x={30} y={21} gap={5} />
  <Frown x={30} y={27} w={4.4} />
</>

/** ♣ candy-cane woods, big: a candy-cane dragon with mint wings */
const CaneDragon = <>
  <Ground w={20} />
  <path d="M44 48Q56 48 56 38" fill="none" strokeWidth={6} /><path d="M44 48Q56 48 56 38" fill="none" stroke="#e8344e" strokeWidth={4} />
  <circle cx={56} cy={35} r={4.4} fill="#fff" /><path {...NO} d="M56 35L56 30.6A4.4 4.4 0 0 1 60.2 36.4ZM56 35L51.8 36.4A4.4 4.4 0 0 1 56 30.6Z" fill="#e8344e" /><circle cx={56} cy={35} r={4.4} fill="none" />
  <path d="M18 34Q4 22 2 32Q6 33 6 37Q10 36 12 40Q15 37 18 40Z M42 34Q56 22 58 30Q54 32 54 35Q50 34 48 38Q45 35 42 38Z" fill="#8fd17a" />
  {[22, 38].map(x => <ellipse key={x} cx={x} cy={55} rx={5} ry={3} fill="#c41f3a" />)}
  <ellipse cx={30} cy={42} rx={15} ry={13} fill="#e8344e" /><Shade cx={30} cy={42} rx={15} ry={13} />
  <ellipse cx={30} cy={45} rx={8.6} ry={9} fill="#fff4f6" />
  <path {...NO} d="M22.6 40q7.4 2 14.8 0M22 45q8 2 16 0M23 50q7 2 14 0" stroke="#e8344e" strokeWidth={1.4} fill="none" />
  <Cane d="M22 14V8a3.4 3.4 0 0 0 -6.8 0" w={2.4} /><Cane d="M38 14V8a3.4 3.4 0 0 1 6.8 0" w={2.4} />
  {/* spiky frills at the cheeks */}
  <path d="M18.6 24l-4.6 -1l3.4 4l-3.6 2l4.8 1z M41.4 24l4.6 -1l-3.4 4l3.6 2l-4.8 1z" fill="#8fd17a" />
  <circle cx={30} cy={21} r={12} fill="#e8344e" /><Shade cx={30} cy={21} rx={12} ry={12} /><Shine cx={24.6} cy={14.6} rx={2.8} />
  <Eyes x={30} y={17.6} gap={5.5} />
  {/* a long dragon muzzle, the same red as its head, with slit nostrils and a puff of smoke */}
  <path d="M22.6 24.4Q22 31 30 31.4Q38 31 37.4 24.4Q30 22 22.6 24.4Z" fill="#f05a6e" />
  <path d="M26.2 25.2q1 -1.2 2 0M31.8 25.2q1 -1.2 2 0" fill="none" strokeWidth={1.2} />
  <path d="M26 30.4l1.2 2.6l1.2 -2.2zM31.6 30.6l1.2 2.2l1.2 -2.6z" fill="#fff" strokeWidth={0.9} />
  <circle cx={39.6} cy={27} r={1.7} fill="#eceaf2" strokeWidth={1} /><circle cx={42.6} cy={25} r={1.2} fill="#eceaf2" strokeWidth={1} />
</>

// ---------- Moon ----------

/** ♠ ridges, small: a rock mite with glowing feelers */
const RockMite = <>
  <Ground w={14} />
  {[20, 25, 35, 40].map(x => <path key={x} d={`M${x} 49l${x < 30 ? -3 : 3} 7`} fill="none" />)}
  <path d="M25 32q-3 -8 -7 -10M35 32q3 -8 7 -10" fill="none" />
  <circle cx={18} cy={22} r={2.2} fill="#7fffd4" /><circle cx={42} cy={22} r={2.2} fill="#7fffd4" />
  <circle {...NO} cx={18} cy={22} r={4} fill="#7fffd4" opacity={0.3} /><circle {...NO} cx={42} cy={22} r={4} fill="#7fffd4" opacity={0.3} />
  <path d="M16 50Q14 38 22 34Q30 28 38 33Q46 36 44 50Q30 54 16 50Z" fill="#8a8fa8" /><Shade cx={32} cy={42} rx={13} ry={10} /><Shine cx={22} cy={37} rx={2.4} />
  <ellipse {...NO} cx={38} cy={45} rx={2.6} ry={1.4} fill="#6e7390" /><ellipse {...NO} cx={20} cy={46} rx={1.8} ry={1} fill="#6e7390" />
  <Eyes x={30} y={41} gap={4} s={0.8} />
  <Frown x={30} y={46} w={3.6} />
</>

/** ♠ ridges, medium: a moon bat with a star on its antenna, flapping */
const MoonBat = <>
  <Ground w={9} />
  <path d="M21 28Q10 14 1 20Q5 24 3 28Q8 27 9 32Q13 28 20 34Z M39 28Q50 14 59 20Q55 24 57 28Q52 27 51 32Q47 28 40 34Z" fill="#4d3f95" />
  <path d="M30 20V12" fill="none" /><path d="M30 6.6l1.4 3l3.2 0.4l-2.4 2.2l0.6 3.2l-2.8 -1.6l-2.8 1.6l0.6 -3.2l-2.4 -2.2l3.2 -0.4z" fill="#ffd45c" strokeWidth={1} />
  <path d="M22.6 24l-2 -8l6.4 4zM37.4 24l2 -8l-6.4 4z" fill="#6d5fb5" />
  <circle cx={30} cy={31} r={10.5} fill="#6d5fb5" /><Shade cx={30} cy={31} rx={10.5} ry={10.5} /><Shine cx={25} cy={25} rx={2.6} />
  <ellipse {...NO} cx={30} cy={35} rx={5} ry={4} fill="#9b8fe0" />
  <Eyes x={30} y={29} gap={4.6} s={0.9} />
  <Frown x={30} y={35} w={4.4} />
</>

/** ♠ ridges, big: a ridge troll with a broken satellite dish for a shield */
const RidgeTroll = <>
  <Ground w={20} />
  {[21, 39].map(x => <ellipse key={x} cx={x} cy={55} rx={6.5} ry={3.2} fill="#5c6080" />)}
  <path d="M12 54Q6 40 12 26Q14 12 30 10Q46 12 48 26Q54 40 48 54Q30 58 12 54Z" fill="#7d8296" />
  <Shade cx={32} cy={34} rx={18} ry={23} /><Shine cx={20} cy={17} rx={3.6} />
  <ellipse {...NO} cx={38} cy={46} rx={4} ry={2} fill="#5c6080" /><ellipse {...NO} cx={20} cy={40} rx={2.6} ry={1.4} fill="#5c6080" />
  <ellipse cx={51} cy={36} rx={5} ry={9} fill="#7d8296" transform="rotate(-12 51 36)" />
  <ellipse cx={9} cy={38} rx={11} ry={8} fill="#d8dce8" transform="rotate(-70 9 38)" />
  <ellipse {...NO} cx={9.6} cy={38} rx={7} ry={4.6} fill="#b8bdd0" transform="rotate(-70 9.6 38)" />
  <path d="M9 38l6 -4" fill="none" /><circle cx={15.6} cy={33.6} r={1.6} fill="#e85d5d" />
  <path d="M17 22q13 -6 26 0" fill="none" strokeWidth={2.6} />
  <Eyes x={30} y={26} gap={5.5} />
  <path d="M23 34q7 4 14 0" fill="none" />
  <path d="M24.6 34.6l1 -3l1.4 3.2zM33 35l1.4 -3.2l1 3z" fill="#f4ecd8" strokeWidth={0.9} />
</>

/** ♥ ice flats, small: an ice slime with a frost crystal on top */
const IceSlime = <>
  <Ground w={15} />
  {/* a deep blue, so it stands out on the pale ice */}
  <path d="M14 55Q12 40 22 36Q30 30 38 36Q48 40 46 55Q42 58 38 55Q34 58 30 55Q26 58 22 55Q18 58 14 55Z" fill="#2f8fd8" />
  <Shade cx={32} cy={45} rx={14} ry={11} /><Shine cx={21} cy={40} rx={3} />
  <ellipse {...NO} cx={30} cy={48} rx={6} ry={3.6} fill="#9fe3ff" opacity={0.35} />
  <path d={spark(30, 29, 4.6)} fill="#fff" strokeWidth={1.3} />
  <Eyes x={30} y={43} gap={4.4} s={0.85} />
  <Frown x={30} y={49} w={4} />
</>

/** ♥ ice flats, medium: a crystal crab with eyes on stalks */
const CrystalCrab = <>
  <Ground w={17} />
  {[16, 21, 39, 44].map(x => <path key={x} d={`M${x} 48l${x < 30 ? -4 : 4} 8`} fill="none" />)}
  <path d="M20 40L16 32M40 40L44 32" fill="none" strokeWidth={2} />
  {/* a strong blue shell and claws with pale crystals, clear against the ice */}
  <path d="M6 30q-4 -8 4 -10l3 4l-3 1l5 3q-2 4 -9 2z M54 30q4 -8 -4 -10l-3 4l3 1l-5 3q2 4 9 2z" fill="#3a78c9" />
  <path d="M24 38V27M36 38V27" fill="none" />
  <circle cx={24} cy={25} r={3.6} fill="#fff" /><circle cx={36} cy={25} r={3.6} fill="#fff" />
  <circle {...NO} cx={24.6} cy={25.4} r={1.8} fill={INK} /><circle {...NO} cx={36.6} cy={25.4} r={1.8} fill={INK} />
  <path d="M19.6 20.6L27 22.4M40.4 20.6L33 22.4" fill="none" strokeWidth={1.8} />
  <path d="M22 37l3 -8l3 8zM28 36l3 -10l3 10zM34 37l3 -7l3 7z" fill="#d8f0ff" />
  <ellipse cx={30} cy={45} rx={15} ry={9} fill="#3a78c9" /><Shade cx={30} cy={45} rx={15} ry={9} /><Shine cx={22} cy={41} rx={2.6} />
  <Frown x={30} y={47} w={5} />
</>

/** ♥ ice flats, big: a frost alien with a crystal crown and an ice trident */
const FrostAlien = <>
  <Ground w={16} />
  <Rope d="M50 56L50 12" colour="#9fe3ff" w={2.2} />
  <path d="M45 14V7M50 13V4M55 14V7M45 14H55" fill="none" strokeWidth={3.4} />
  <path d="M45 14V7M50 13V4M55 14V7M45 14H55" fill="none" stroke="#e0f6ff" strokeWidth={1.6} />
  {[24, 36].map(x => <ellipse key={x} cx={x} cy={56} rx={4.6} ry={2.4} fill="#4f7fb8" />)}
  <path d="M20 54L23 32H37L40 54Z" fill="#7fb4e6" /><Shade cx={34} cy={43} rx={6} ry={11} />
  <ellipse cx={17} cy={40} rx={3.4} ry={8} fill="#bfe8ff" transform="rotate(14 17 40)" />
  <ellipse cx={45} cy={34} rx={3.4} ry={7} fill="#bfe8ff" transform="rotate(-40 45 34)" />
  <path d="M19 12l2 -8l3 6l3 -9l3 9l3 -6l2 8z" fill="#e8f6ff" />
  <ellipse cx={30} cy={21} rx={13} ry={11.6} fill="#bfe8ff" /><Shade cx={30} cy={21} rx={13} ry={11.6} /><Shine cx={24} cy={15} rx={3} />
  <Eyes x={30} y={21} gap={5.4} s={1.05} />
  <path d="M26 27.6q4 -2.4 8 0" fill="none" />
</>

/** ♦ dust sea, small: a fluffy dust bunny */
const DustBunny = <>
  <Ground w={13} />
  {/* floppy ears, lavender inside, drooping to the sides */}
  <ellipse cx={22} cy={33} rx={3.2} ry={7.4} fill="#b6a8d8" transform="rotate(-38 22 33)" />
  <ellipse {...NO} cx={22} cy={33} rx={1.4} ry={4.8} fill="#e0c8f0" transform="rotate(-38 22 33)" />
  <ellipse cx={38} cy={33} rx={3.2} ry={7.4} fill="#b6a8d8" transform="rotate(38 38 33)" />
  <ellipse {...NO} cx={38} cy={33} rx={1.4} ry={4.8} fill="#e0c8f0" transform="rotate(38 38 33)" />
  <path d={fuzz(30, 44, 12, 11)} fill="#b6a8d8" /><Shade cx={30} cy={44} rx={12} ry={12} /><Shine cx={24} cy={38} rx={2.8} />
  {[24, 36].map(x => <ellipse key={x} cx={x} cy={57} rx={3} ry={1.6} fill="#8a7cb0" />)}
  <Eyes x={30} y={43} gap={4.4} s={0.85} />
  <Frown x={30} y={49} w={3.8} />
</>

/** ♦ dust sea, medium: a dust ray gliding over the ground */
const DustRay = <>
  <Ground w={14} />
  <path d="M30 42Q30 52 37 56" fill="none" strokeWidth={1.6} />
  {/* a purple-blue back with glowing spots, so it stands out on the grey dust */}
  <path d="M30 22Q44 24 57 33Q45 37 35 42L30 46L25 42Q15 37 3 33Q16 24 30 22Z" fill="#5a4fb0" /><Shade cx={36} cy={34} rx={12} ry={11} />
  {[[14, 31], [46, 31], [21, 36], [39, 36]].map(([x, y]) => <g key={`${x}`}>
    <circle {...NO} cx={x} cy={y} r={2.8} fill="#9ff0ff" opacity={0.3} /><circle {...NO} cx={x} cy={y} r={1.5} fill="#9ff0ff" />
  </g>)}
  <path d="M25 23.6q-2 -5 -6 -6M35 23.6q2 -5 6 -6" fill="none" strokeWidth={2.2} />
  <Eyes x={30} y={30} gap={4.4} s={0.85} />
  <Frown x={30} y={36} w={4} />
</>

/** ♦ dust sea, big: an octo-alien in a glass space helmet */
const OctoAlien = <>
  <Ground w={20} />
  {[[14, 'M18 44Q10 50 12 56Q16 56 14 52'], [24, 'M24 46Q22 54 26 57'], [36, 'M36 46Q38 54 34 57'], [46, 'M42 44Q50 50 48 56Q44 56 46 52']].map(([k, d]) => <g key={k as number}>
    <path d={d as string} fill="none" strokeWidth={7} /><path d={d as string} fill="none" stroke="#9b7fd6" strokeWidth={4.6} />
  </g>)}
  <ellipse cx={30} cy={40} rx={14} ry={8} fill="#9b7fd6" />
  <ellipse cx={30} cy={25} rx={15} ry={14} fill="#9b7fd6" /><Shade cx={30} cy={25} rx={15} ry={14} />
  <circle {...NO} cx={22} cy={18} r={2} fill="#7a5fb8" /><circle {...NO} cx={37} cy={15} r={1.6} fill="#7a5fb8" /><circle {...NO} cx={39} cy={30} r={2.2} fill="#7a5fb8" />
  <Eyes x={30} y={26} gap={5.6} />
  <Frown x={30} y={33} w={5} />
  <circle cx={30} cy={24} r={20} fill="#cfe8ff" opacity={0.18} />
  <path {...NO} d="M16 16q4 -8 12 -9" stroke="#fff" strokeWidth={1.6} opacity={0.7} fill="none" />
</>

/** ♣ crater field, small: a three-eyed crater crawler */
const Crawler = <>
  <Ground w={15} />
  {[24, 30, 36, 42].map(x => <path key={x} d={`M${x} 52l-1 5`} fill="none" />)}
  <ellipse cx={34} cy={48} rx={13} ry={7.6} fill="#7fd18f" /><Shade cx={34} cy={48} rx={13} ry={7.6} />
  <path {...NO} d="M28 42q0 12 0 13M36 41q0 13 0 14" stroke="#5fb070" strokeWidth={1.2} />
  <path d="M14 36q-2 -7 -6 -9M20 35q1 -7 5 -9" fill="none" /><circle cx={8} cy={27} r={1.6} fill="#ffd45c" /><circle cx={25} cy={26} r={1.6} fill="#ffd45c" />
  <circle cx={18} cy={43} r={9} fill="#8fe09f" /><Shade cx={18} cy={43} rx={9} ry={9} /><Shine cx={14} cy={39} rx={2} />
  <Eyes x={18} y={44} gap={3.6} s={0.75} />
  <ellipse {...NO} cx={18} cy={37} rx={1.4} ry={1.8} fill={INK} /><circle {...NO} cx={17.6} cy={36.4} r={0.5} fill="#fff" />
  <Frown x={18} y={48.4} w={3.4} />
</>

/** ♣ crater field, medium: a little alien in a flying saucer */
const Saucer = <>
  <Ground w={13} />
  <path {...NO} d="M22 40L16 57H44L38 40Z" fill="#fff7b0" opacity={0.3} />
  <circle cx={30} cy={26} r={10} fill="#cfe8ff" opacity={0.5} />
  <circle cx={30} cy={26.6} r={7.6} fill="#8fe09f" />
  <Eyes x={30} y={27} gap={3.2} s={0.72} />
  <circle cx={30} cy={26} r={10} fill="none" />
  <path {...NO} d="M23.6 21q2 -3.4 5.4 -4" stroke="#fff" strokeWidth={1.2} opacity={0.8} fill="none" />
  <ellipse cx={30} cy={38} rx={13} ry={4} fill="#9a9cb0" />
  <ellipse cx={30} cy={34} rx={22} ry={6} fill="#c9cce0" /><Shade cx={30} cy={34} rx={22} ry={6} />
  {[14, 22, 30, 38, 46].map(x => <circle key={x} cx={x} cy={35} r={1.6} fill="#ffd45c" strokeWidth={0.8} />)}
</>

/** ♣ crater field, big: a one-eyed horned beast with a spiked moon-rock mace */
const Cyclops = <>
  <Ground w={20} />
  <Rope d="M53 56L53 24" colour="#8a8fa8" w={2.6} />
  <path d={spines(53, 18, 6.4, 6.4, 5)} fill="#9a9cb0" /><circle cx={53} cy={20} r={6} fill="#9a9cb0" />
  {[21, 39].map(x => <ellipse key={x} cx={x} cy={55} rx={6.5} ry={3.2} fill="#5a3f8f" />)}
  <path d="M21 14q-6 -6 -4 -13q4 5 8 9zM39 14q6 -6 4 -13q-4 5 -8 9z" fill="#f4ecd8" />
  <ellipse cx={8} cy={38} rx={5} ry={9} fill="#7a5bb8" transform="rotate(12 8 38)" />
  <ellipse cx={50} cy={36} rx={5} ry={8} fill="#7a5bb8" transform="rotate(-20 50 36)" />
  <path d="M12 52Q8 36 14 24Q18 10 30 10Q42 10 46 24Q52 36 48 52Q30 58 12 52Z" fill="#7a5bb8" />
  <Shade cx={32} cy={33} rx={18} ry={23} /><Shine cx={20} cy={17} rx={3.6} />
  <ellipse {...NO} cx={30} cy={42} rx={9} ry={9} fill="#9b7fd6" />
  <circle cx={30} cy={25} r={7} fill="#fff" />
  <circle {...NO} cx={30.6} cy={25.6} r={3.4} fill={INK} /><circle {...NO} cx={29.4} cy={24.2} r={1.1} fill="#fff" />
  <path d="M22 16.6L30 19.4L38 16.6" fill="none" strokeWidth={2.2} />
  <path d="M23 35q7 4 14 0" fill="none" />
  <path d="M24.6 35.4l1 2.6l1.4 -2.2zM33 35.8l1.4 2.2l1 -2.6z" fill="#fff" strokeWidth={0.9} />
</>

/** a creature's drawing and name; `flies`: it hovers, bobbing in the air, where one on its feet stands still */
interface Kind { name: string; art: ReactNode; flies?: boolean }
const on = (name: string, art: ReactNode): Kind => ({ name, art })
/** one creature per biome and size (small, medium, big), biomes in SUITS order: ♠ ♥ ♦ ♣ */
const fly = (name: string, art: ReactNode): Kind => ({ name, art, flies: true })
const CREATURES: Partial<Record<WorldId, readonly (readonly [Kind, Kind, Kind])[]>> = {
  earth: [
    [on('Goat', Goat), on('Eagle', Eagle), on('Yeti', Yeti)],
    [fly('Bee', Bee), on('Boar', Boar), on('Bull', Bull)],
    [on('Scorpion', Scorpion), on('Rattlesnake', Snake), on('Sandworm', Worm)],
    [on('Hedgehog', Hedgehog), on('Wolf', Wolf), on('Bear', Bear)],
  ],
  candy: [
    [on('Sugar cube', SugarCube), fly('Cotton-candy bat', CottonBat), on('Rock-candy golem', CandyGolem)],
    [on('Cupcake', Cupcake), on('Marshmallow bunny', MarshBunny), on('Gingerbread knight', GingerKnight)],
    [on('Gummy worm', GummyWorm), on('Donut beetle', DonutBeetle), on('Chocolate golem', ChocoGolem)],
    [fly('Lollipop fairy', Lollipop), on('Gummy bear', GummyBear), on('Candy-cane dragon', CaneDragon)],
  ],
  moon: [
    [on('Rock mite', RockMite), fly('Moon bat', MoonBat), on('Ridge troll', RidgeTroll)],
    [on('Ice slime', IceSlime), on('Crystal crab', CrystalCrab), on('Frost alien', FrostAlien)],
    [on('Dust bunny', DustBunny), fly('Dust ray', DustRay), on('Octo-alien', OctoAlien)],
    [on('Crater crawler', Crawler), fly('Saucer alien', Saucer), on('Cyclops', Cyclops)],
  ],
}
/** how tall each size stands on the board, in stage pixels */
const SIZE = [66, 82, 108] as const
/** a hostile card's size band: the same rank bands as a region's dig depth (3, 5 or 7 cards) */
const sizeOf = (card: number) => (depthOf(card) === 3 ? 0 : depthOf(card) === 5 ? 1 : 2)

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/**
 * The creature of hostile card `card`, standing with its feet at `left`, `bottom` (map coordinates) beside the card.
 * It slides out from behind the card `delay` seconds after the card comes into sight, waits (bobbing if it flies), and:
 * `fight` (for `seconds`): lunges at you and is knocked back as your card and your sword hit; beaten, it tumbles away
 * (its exit). `flee`: it charges at you as you run.
 */
export function Creature({ world, card, left, bottom, delay, action, seconds = 0 }: {
  world: WorldId; card: number; left: number; bottom: number; delay: number; action?: 'fight' | 'flee'; seconds?: number
}) {
  const reduce = useReducedMotion()
  const kind = CREATURES[world]?.[suit(card)][sizeOf(card)]
  if (!kind) return null
  const h = SIZE[sizeOf(card)]
  return (
    <motion.div
      className={`creature ${action === 'flee' ? 'charging' : ''} ${action === 'fight' ? 'hit' : ''}`}
      style={{ left, top: bottom - h, width: h, height: h }}
      aria-hidden="true"
      // out from behind the card's right edge (it is drawn under the cards) to stand beside it
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -h * 0.6, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: reduce ? 0.2 : 0.35, ease: EASE_OUT, delay }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, x: -10, y: 8, rotate: -35, scale: 0.85, transition: { duration: 0.3, ease: EASE_OUT } }}
    >
      <motion.div
        className="creature-body"
        animate={reduce ? undefined
          : action === 'fight' ? { x: [0, 9, -12, -9, -9], y: [0, 3, -3, 0, 0], rotate: [0, 6, -14, -10, -10] }
          : action === 'flee' ? { x: [0, 150], y: [0, 120], scale: [1, 2.3] }
          : kind.flies ? { y: [0, -2.5, 0] } : undefined}
        transition={action === 'fight' ? { duration: seconds, times: [0, 0.35, 0.5, 0.7, 1], ease: 'easeOut' }
          : action === 'flee' ? { duration: seconds, ease: [0.55, 0, 1, 0.45] }
          : { duration: 1.4, ease: 'easeInOut', repeat: Infinity, delay: delay + 0.35 }}
      >
        <svg viewBox="0 0 60 60" width={h} height={h}><g {...LINE}>{kind.art}</g></svg>
      </motion.div>
    </motion.div>
  )
}

/** the three sizes, by the hostile card's rank */
const BANDS = ['2–5', '6–10', 'J–A'] as const

/**
 * TEMPORARY (menu preview): every creature of a world, one row per biome, each standing on its biome's ground, with a
 * tab per world (it opens on `world`, the one selected in the menu). Remove with its menu button once the art is signed off.
 */
export function Bestiary({ world: first, onClose }: { world: WorldId; onClose: () => void }) {
  const [world, setWorld] = useState(first)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus({ preventScroll: true }), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const w = WORLDS.find(x => x.id === world)!
  const rows = CREATURES[world]
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bestiary-title" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card-modal bestiary">
        <h2 id="bestiary-title">Creatures of {w.name}</h2>
        <div className="bestiary-tabs" role="tablist" aria-label="Planet">
          {WORLDS.map(x => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === world} className={x.id === world ? 'on' : ''} onClick={() => setWorld(x.id)}>{x.name}</button>
          ))}
        </div>
        {rows ? <>
          <p className="muted">A hostile card brings the creature of its biome and rank. Preview only.</p>
          <div className="bestiary-grid">
            <span />{BANDS.map(b => <span key={b} className="bestiary-band">{b}</span>)}
            {rows.map((row, s) => <Fragment key={s}>
              <span className="bestiary-biome"><b>{SUITS[s]}</b> {w.terrain[s].name}</span>
              {row.map((k, z) => (
                <figure key={`${s}-${z}`} className="bestiary-cell">
                  <Scene world={world} suit={s} className="bestiary-ground" />
                  <svg viewBox="0 0 60 60" aria-hidden="true"><g {...LINE}>{k.art}</g></svg>
                  <figcaption>{k.name}{k.flies ? ' · flies' : ''}</figcaption>
                </figure>
              ))}
            </Fragment>)}
          </div>
        </> : <p className="muted">No creatures for {w.name} yet.</p>}
        <button ref={closeRef} className="big" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
