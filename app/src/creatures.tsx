import { Fragment, useEffect, useRef, type ReactNode } from 'react'
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

/** a creature's drawing and name; `flies`: it hovers, bobbing in the air, where one on its feet stands still */
interface Kind { name: string; art: ReactNode; flies?: boolean }
const on = (name: string, art: ReactNode): Kind => ({ name, art })
/** one creature per biome and size (small, medium, big), biomes in SUITS order: ♠ ♥ ♦ ♣. Earth only, so far */
const CREATURES: Partial<Record<WorldId, readonly (readonly [Kind, Kind, Kind])[]>> = {
  earth: [
    [on('Goat', Goat), on('Eagle', Eagle), on('Yeti', Yeti)],
    [{ name: 'Bee', art: Bee, flies: true }, on('Boar', Boar), on('Bull', Bull)],
    [on('Scorpion', Scorpion), on('Rattlesnake', Snake), on('Sandworm', Worm)],
    [on('Hedgehog', Hedgehog), on('Wolf', Wolf), on('Bear', Bear)],
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
 * TEMPORARY (menu preview): every creature of a world, one row per biome, each standing on its biome's ground.
 * Remove with its menu button once all three worlds have their creatures.
 */
export function Bestiary({ world, onClose }: { world: WorldId; onClose: () => void }) {
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
