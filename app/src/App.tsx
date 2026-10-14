import { lazy, Suspense, useState } from 'react'
import GuideApp from './GuideApp'
import Practice from './Practice'
import { reducedMotion } from './menu/reducedMotion'
import { useCurrentWorld } from './menu/store'
import { WORLDS, worldTheme, type WorldId } from './menu/worlds'
import { GAME_KEYS, inProgress, load } from './save'
import type { Arrival, Destination } from './screens'

/** the 3D world menu (three.js) lives in its own chunk and loads only when shown */
const Menu = lazy(() => import('./menu/Menu'))

const MODE = 'zoom-mode' // the last game screen opened, kept under its old name
/** sessionStorage: the game screen open in this tab, so a reload stays in it while a new visit starts at the menu */
const OPEN = 'fallaway-screen-v1'
type Mode = Destination['mode']
type Screen = { name: 'menu'; continuable: ReadonlySet<WorldId> } | { name: 'game'; to: Destination; arrival: Arrival }

const resume = (mode: Mode | null): Destination => (mode === 'guide' ? { mode: 'guide' } : { mode: 'practice', start: 'resume' })
const game = (to: Destination, arrival: Arrival = 'direct'): Screen => ({ name: 'game', to, arrival })
/** checked once per visit to the menu: reading a save parses the whole game history */
const menu = (): Screen => ({ name: 'menu', continuable: new Set(WORLDS.filter(w => inProgress(load(GAME_KEYS[w.id]))).map(w => w.id)) })

const read = (store: () => Storage, key: string) => { try { return store().getItem(key) as Mode | null } catch { return null } }
const write = (store: () => Storage, key: string, value: Mode | null) => {
  try { if (value) store().setItem(key, value); else store().removeItem(key) } catch { /* ignore */ }
}

/** no browser (server render), a shared `?seed=` deal, `?play` (test scripts) or a reload mid-game: straight to the game, never loading three.js */
function firstScreen(): Screen {
  if (typeof location === 'undefined') return game(resume(read(() => localStorage, MODE)))
  const q = new URLSearchParams(location.search)
  if (q.has('seed')) return game(resume('practice'))
  if (q.has('play')) return game(resume(read(() => localStorage, MODE)))
  const open = read(() => sessionStorage, OPEN)
  return open ? game(resume(open)) : menu()
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(firstScreen)
  const world = useCurrentWorld()

  const enter = (to: Destination, via: Arrival) => {
    write(() => localStorage, MODE, to.mode)
    write(() => sessionStorage, OPEN, to.mode)
    setScreen(game(to, reducedMotion ? 'direct' : via))
  }
  // both games save every step, so leaving loses nothing: Continue (or Real deck) picks up where you left off
  const toMenu = () => { write(() => sessionStorage, OPEN, null); setScreen(menu()) }

  if (screen.name === 'menu') {
    return <Suspense fallback={null}><Menu continuable={screen.continuable} onEnter={enter} /></Suspense>
  }
  const { to, arrival } = screen
  return (
    <>
      <div className="modes">
        <button onClick={toMenu}>← Menu</button>
        <b className="title">Fallaway</b>
        <span className="muted">{world.name} · {to.mode === 'guide' ? 'with a real deck' : 'on screen'}</span>
      </div>
      {to.mode === 'guide'
        ? <GuideApp />
        : <Practice key={world.id} saveKey={GAME_KEYS[world.id]} start={to.start} dealt={arrival === 'direct'} />}
      {/* the dive's colour wash (or Real deck's plain fade) clearing to reveal the table; the cards are dealt once it is gone */}
      {arrival === 'direct' ? null : (
        <div className={`arrive-veil ${arrival}`} aria-hidden="true" style={worldTheme(world)} onAnimationEnd={() => setScreen(game(to))} />
      )}
    </>
  )
}
