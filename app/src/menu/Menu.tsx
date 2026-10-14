import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useDrag } from '@use-gesture/react'
import { Backdrop } from './Backdrop'
import { WorldCarousel } from './WorldCarousel'
import { reducedMotion } from './reducedMotion'
import { drag, useCarousel, useCurrentWorld } from './store'
import { DIVE_SECONDS, VEIL_START } from './transition'
import { WORLDS, worldTheme } from './worlds'
import './menu.css'

// The wash covers the tail of the dive and is fully opaque as the board takes over.
const VEIL_TIMING = {
  '--veil-delay': `${DIVE_SECONDS * VEIL_START}s`,
  '--veil-duration': `${DIVE_SECONDS * (1 - VEIL_START)}s`,
} as CSSProperties

interface MenuProps {
  /** Called once the dive reaches the world's surface (straight away with reduced motion). */
  onEnter: () => void
  /** More menu buttons, shown after Play. */
  children?: ReactNode
}

/** Front door: pick a world on the 3D carousel, then dive into it. */
export default function Menu({ onEnter, children }: MenuProps) {
  const next = useCarousel((s) => s.next)
  const prev = useCarousel((s) => s.prev)
  const world = useCurrentWorld()
  const [diving, setDiving] = useState(false)

  const play = () => (reducedMotion ? onEnter() : setDiving(true))

  useEffect(() => {
    if (diving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, diving])

  const stage = useRef<HTMLDivElement>(null)

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], last }) => {
      const slotWidth = (stage.current?.offsetWidth ?? 800) * 0.3
      drag.active = active
      drag.progress = Math.max(-1, Math.min(1, mx / slotWidth))

      if (last) {
        // Commit to the next world on a long drag or a quick flick.
        const commit = Math.abs(drag.progress) > 0.3 || vx > 0.5
        if (commit && dx > 0) prev()
        else if (commit && dx < 0) next()
        drag.progress = 0
      }
    },
    { axis: 'x', filterTaps: true, pointer: { capture: true }, enabled: !diving },
  )

  return (
    <main
      className="menu"
      data-world={world.id}
      data-phase={diving ? 'zooming' : 'menu'}
      inert={diving}
      style={worldTheme(world)}
    >
      <Backdrop active={world.id} />
      <WorldCarousel stageRef={stage} diving={diving} onDiveEnd={onEnter} />
      <h1 className="menu-title">Fallaway</h1>

      <div className="menu-stage" ref={stage}>
        <div className="drag-surface" {...bind()} />
      </div>

      <div aria-live="polite">
        <p className="world-label">
          World {WORLDS.indexOf(world) + 1} / {WORLDS.length}
        </p>
        <p className="world-name">{world.name}</p>
        <p className="world-tagline">{world.tagline}</p>
      </div>

      <dl className="world-terrain" aria-label="Terrain by suit">
        {world.terrain.map(({ suit, name }) => (
          <div key={suit} className="terrain">
            <dt>{suit}</dt>
            <dd>{name}</dd>
          </div>
        ))}
      </dl>

      <nav className="menu-actions" aria-label="Main menu">
        <button type="button" className="menu-btn menu-btn-primary" onClick={play}>
          Play
        </button>
        {children}
      </nav>

      {/* Washes the screen in the world's colour as the camera reaches the surface. */}
      <div className="zoom-veil" aria-hidden="true" style={VEIL_TIMING} />
    </main>
  )
}
