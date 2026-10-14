import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useDrag } from '@use-gesture/react'
import { HowToPlay } from '../shared'
import type { Arrival, Destination } from '../screens'
import { Backdrop } from './Backdrop'
import { WorldCarousel } from './WorldCarousel'
import { reducedMotion } from './reducedMotion'
import { drag, useCarousel, useCurrentWorld } from './store'
import { DIVE_SECONDS, VEIL_START } from './transition'
import { WORLDS, worldTheme, type WorldId } from './worlds'
import './menu.css'

// The wash covers the tail of the dive and is fully opaque as the board takes over.
const VEIL_TIMING = {
  '--veil-delay': `${DIVE_SECONDS * VEIL_START}s`,
  '--veil-duration': `${DIVE_SECONDS * (1 - VEIL_START)}s`,
} as CSSProperties

const PLAY: Destination = { mode: 'practice', start: 'new' }
const CONTINUE: Destination = { mode: 'practice', start: 'resume' }
const DAILY: Destination = { mode: 'practice', start: 'daily' }
const REAL_DECK: Destination = { mode: 'guide' }

/** How the menu is being left: the camera dive into the world, or a plain fade (Real deck needs no world). */
type Leaving = { to: Destination; via: 'dive' | 'fade' }

interface MenuProps {
  /** Worlds with an unfinished saved game: there the main button continues it, straight in, instead of dealing a new one. */
  continuable: ReadonlySet<WorldId>
  /** Leave the menu for a game screen. */
  onEnter: (to: Destination, via: Arrival) => void
}

function MenuButton({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={primary ? 'menu-btn menu-btn-primary' : 'menu-btn'} onClick={onClick}>
      {children}
    </button>
  )
}

/** Front door: pick a world on the 3D carousel, then dive into it. */
export default function Menu({ continuable, onEnter }: MenuProps) {
  const next = useCarousel((s) => s.next)
  const prev = useCarousel((s) => s.prev)
  const world = useCurrentWorld()
  /** Null while choosing. */
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const [rules, setRules] = useState(false)
  const diving = leaving?.via === 'dive'

  const leave = (to: Destination, via: Leaving['via']) => (reducedMotion ? onEnter(to, 'direct') : setLeaving({ to, via }))

  // Arrow keys pick a world, only while the carousel is what you are looking at.
  useEffect(() => {
    if (leaving || rules) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, leaving, rules])

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
    { axis: 'x', filterTaps: true, pointer: { capture: true }, enabled: !leaving },
  )

  return (
    <main
      className="menu"
      data-world={world.id}
      data-phase={leaving ? (diving ? 'zooming' : 'leaving') : 'menu'}
      inert={!!leaving}
      style={worldTheme(world)}
      onTransitionEnd={(e) => {
        // The fade out has finished: hand over to the game screen.
        if (leaving?.via === 'fade' && e.target === e.currentTarget && e.propertyName === 'opacity') onEnter(leaving.to, 'fade')
      }}
    >
      <Backdrop active={world.id} />
      <WorldCarousel stageRef={stage} diving={diving} onDiveEnd={() => leaving && onEnter(leaving.to, 'dive')} />
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
        {continuable.has(world.id) ? (
          <MenuButton primary onClick={() => onEnter(CONTINUE, 'direct')}>Continue</MenuButton>
        ) : (
          <MenuButton primary onClick={() => leave(PLAY, 'dive')}>Play</MenuButton>
        )}
        <MenuButton onClick={() => leave(DAILY, 'dive')}>Daily deal</MenuButton>
        <MenuButton onClick={() => leave(REAL_DECK, 'fade')}>Real deck</MenuButton>
        <MenuButton onClick={() => setRules(true)}>How to play</MenuButton>
      </nav>

      {rules ? <HowToPlay onClose={() => setRules(false)} /> : null}

      {/* Washes the screen in the world's colour as the camera reaches the surface. */}
      <div className="zoom-veil" aria-hidden="true" style={VEIL_TIMING} />
    </main>
  )
}
