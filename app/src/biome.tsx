import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { WorldId } from './menu/worlds'
import { reducedMotion } from './menu/reducedMotion'
import { DIVE_SECONDS, RISE_SECONDS, RISE_VEIL_SECONDS, VEIL_START } from './menu/transition'
import { Panorama } from './regionArt'

// Digging a region enters its biome, the way Play enters a world from the menu: the camera dives into the card (the
// whole board grows until the card fills the screen), the biome's colour washes in near the end of the dive and then
// clears on the dig, played inside the biome: its landscape fills the window behind the board. When the dig ends the
// wash covers the board and the camera rises back out of the card. Look only: the dig plays exactly the same.
// Same timings as the menu (menu/transition.ts).

export interface Box { left: number; top: number; width: number; height: number }

type Four = readonly [spades: string, hearts: string, diamonds: string, clubs: string]
/** one colour per biome, taken from its landscape (regionArt.tsx): the wash of the dive */
const COLOUR: Record<WorldId, Four> = {
  //      mountains   meadow      desert      forest
  earth: ['#3a4c63', '#4d7a2c', '#7a5a22', '#1b5a44'],
  //      peaks       frosting    caramel     candy canes
  candy: ['#5a4a9c', '#a0406e', '#8a4f1e', '#2f7a5a'],
  //      ridges      ice flats   dust sea    craters
  moon: ['#3e4260', '#3d6f9a', '#4a4660', '#55576e'],
}

/** wash timings, as App's Veil after the menu's dive: clears on arrival, covers before leaving */
const CLEAR = 0.4, COVER = 0.25
const easeOutCubic = [0.33, 1, 0.68, 1] as const
const easeOutQuad = [0.5, 1, 0.89, 1] as const

/** where the camera is: `dive` into the card, `clear` the wash on the dig, `cover` the board when it ends, `rise` out */
type Phase =
  | { name: 'idle' }
  | { name: 'dive'; suit: number; cam: Cam }
  | { name: 'clear'; suit: number }
  | { name: 'cover'; suit: number; cam: Cam | null }
  | { name: 'rise'; suit: number; cam: Cam }
/** the camera zoomed into the card: the board scaled about the card's centre, which moves to the middle of the screen */
interface Cam { ox: number; oy: number; x: number; y: number; scale: number }

/** the zoom that makes `card` fill the window, for a board whose top left corner is at `board` */
function zoomInto(card: Box, board: { left: number; top: number }): Cam {
  const cx = card.left + card.width / 2, cy = card.top + card.height / 2
  return {
    ox: cx - board.left, oy: cy - board.top,
    x: innerWidth / 2 - cx, y: innerHeight / 2 - cy,
    scale: Math.max(innerWidth / card.width, innerHeight / card.height) * 1.15,
  }
}

/**
 * The board (`children`) inside a camera that can dive into the middle card.
 * @param suit the suit of the region being dug, or null when not digging
 * @param card where the middle card is on screen right now (read only when a dive or rise starts)
 */
export function BiomeDive({ world, suit: biome, card, children }: { world: WorldId; suit: number | null; card: () => Box | null; children: ReactNode }) {
  const colours = COLOUR[world]
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const boardRef = useRef<HTMLDivElement>(null)
  const prev = useRef(biome)

  // a dig starting or ending moves the camera; a game resumed mid-dig just shows the biome
  useLayoutEffect(() => {
    const was = prev.current
    prev.current = biome
    if (biome === was || reducedMotion) return
    const box = card(), board = boardRef.current?.getBoundingClientRect()
    const cam = box && board ? zoomInto(box, board) : null
    setPhase(p => {
      if (biome !== null) return cam ? { name: 'dive', suit: biome, cam } : { name: 'idle' }
      if (was === null) return p
      return { name: 'cover', suit: was, cam }
    })
  }, [biome, card])

  const next = (p: Phase) => () => setPhase(p)
  const wash = phase.name === 'idle' ? null : colours[phase.suit]
  // the biome's colour stays behind the board for the whole dig, never during the camera moves
  const behind = biome !== null && phase.name !== 'dive'

  const board = phase.name === 'dive'
    ? { animate: { x: phase.cam.x, y: phase.cam.y, scale: phase.cam.scale }, transition: { duration: DIVE_SECONDS, ease: easeOutCubic }, origin: phase.cam }
    : phase.name === 'rise'
      ? { animate: { x: [phase.cam.x, 0], y: [phase.cam.y, 0], scale: [phase.cam.scale, 1] }, transition: { duration: RISE_SECONDS, ease: easeOutQuad }, origin: phase.cam }
      : { animate: { x: 0, y: 0, scale: 1 }, transition: { duration: 0 }, origin: null }
  const veil = phase.name === 'dive'
    ? { animate: { opacity: [0, 0, 1] }, transition: { duration: DIVE_SECONDS, times: [0, VEIL_START, 1], ease: 'easeIn' as const }, done: next({ name: 'clear', suit: phase.suit }) }
    : phase.name === 'clear'
      ? { animate: { opacity: [1, 0] }, transition: { duration: CLEAR, ease: 'easeOut' as const }, done: next({ name: 'idle' }) }
      : phase.name === 'cover'
        ? { animate: { opacity: [0, 1] }, transition: { duration: COVER, ease: 'easeOut' as const }, done: next(phase.cam ? { name: 'rise', suit: phase.suit, cam: phase.cam } : { name: 'idle' }) }
        : { animate: { opacity: [1, 0] }, transition: { duration: RISE_VEIL_SECONDS, ease: 'easeOut' as const }, done: undefined }

  return (
    <>
      <div className={`biome ${behind ? 'on' : ''}`} aria-hidden="true" style={{ background: biome !== null ? colours[biome] : undefined }}>
        {biome !== null && <Panorama world={world} suit={biome} />}
      </div>
      <motion.div
        ref={boardRef}
        className="camera"
        style={board.origin ? { transformOrigin: `${board.origin.ox}px ${board.origin.oy}px` } : undefined}
        animate={board.animate}
        transition={board.transition}
        onAnimationComplete={phase.name === 'rise' ? next({ name: 'idle' }) : undefined}
      >
        {children}
      </motion.div>
      {wash && (
        <motion.div key={phase.name} className="biome-veil" aria-hidden="true" style={{ background: wash }} initial={{ opacity: phase.name === 'clear' || phase.name === 'rise' ? 1 : 0 }} animate={veil.animate} transition={veil.transition} onAnimationComplete={veil.done} />
      )}
    </>
  )
}
