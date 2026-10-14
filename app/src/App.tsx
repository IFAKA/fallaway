import { lazy, Suspense, useState, type CSSProperties } from 'react'
import GuideApp from './GuideApp'
import Practice from './Practice'
import { Backdrop } from './menu/Backdrop'
import { reducedMotion } from './menu/reducedMotion'
import { useCurrentWorld } from './menu/store'
import { WORLDS, worldTheme, type WorldId } from './menu/worlds'
import { GAME_KEYS, inProgress, load } from './save'
import { transitionOf, type Arrival, type Destination } from './screens'

/** the 3D world menu (three.js) lives in its own chunk and loads only when shown */
const Menu = lazy(() => import('./menu/Menu'))

const MODE = 'zoom-mode' // the last game screen opened, kept under its old name
/** sessionStorage: the game screen open in this tab, so a reload stays in it while a new visit starts at the menu */
const OPEN = 'fallaway-screen-v1'
type Mode = Destination['mode']
/** `from` / `arrival`: how the screen was reached, which sets how it appears. `leaving`: the game screen is covering itself before the menu returns */
type Screen =
  | { name: 'menu'; continuable: ReadonlySet<WorldId>; from: Arrival }
  | { name: 'game'; to: Destination; arrival: Arrival; leaving?: boolean }

const resume = (mode: Mode | null): Destination => (mode === 'guide' ? { mode: 'guide' } : { mode: 'practice', start: 'resume' })
const game = (to: Destination, arrival: Arrival = 'direct'): Screen => ({ name: 'game', to, arrival })
/** checked once per visit to the menu: reading a save parses the whole game history */
const menu = (from: Arrival = 'direct'): Screen => ({ name: 'menu', continuable: new Set(WORLDS.filter(w => inProgress(load(GAME_KEYS[w.id]))).map(w => w.id)), from })
/** a screen is left the way it was entered (`transitionOf`): rising out of a world, or a plain fade after Real deck */
const exitOf = (to: Destination): Arrival => (reducedMotion ? 'direct' : transitionOf(to))

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

/** a full-screen wash between the menu and a game: the world's colour around a dive, the menu's dark for a plain fade.
 *  `clear` fades it away (arriving), `cover` fades it in (leaving), `hold` just stays (while the menu loads) */
function Veil({ via, motion, style, onDone }: { via: Arrival; motion: 'clear' | 'cover' | 'hold'; style: CSSProperties; onDone?: () => void }) {
  if (via === 'direct') return null
  return <div className={`veil ${motion} ${via === 'fade' ? 'plain' : 'world'}`} aria-hidden="true" style={style} onAnimationEnd={onDone} />
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(firstScreen)
  const world = useCurrentWorld()
  const theme = worldTheme(world)

  const enter = (to: Destination, via: Arrival) => {
    write(() => localStorage, MODE, to.mode)
    write(() => sessionStorage, OPEN, to.mode)
    setScreen(game(to, reducedMotion ? 'direct' : via))
  }

  if (screen.name === 'menu') {
    return (
      <Suspense fallback={<Veil via={screen.from} motion="hold" style={theme} />}>
        <Menu continuable={screen.continuable} onEnter={enter} from={screen.from} />
      </Suspense>
    )
  }

  const { to, arrival, leaving } = screen
  // both games save every step, so leaving loses nothing: Continue (or Real deck) picks up where you left off
  const toMenu = () => {
    write(() => sessionStorage, OPEN, null)
    if (exitOf(to) === 'direct') setScreen(menu())
    else setScreen({ ...screen, leaving: true })
  }
  // the world themes the whole game screen: table, panels, card backs (on screen only) and a calm backdrop (themes.css)
  return (
    <div className="game" data-world={world.id} data-mode={to.mode} style={theme}>
      <Backdrop active={world.id} tone="calm" />
      <div className="modes">
        <button onClick={toMenu} disabled={leaving}>← Menu</button>
        <b className="title">Fallaway</b>
        <span className="muted">{world.name} · {to.mode === 'guide' ? 'with a real deck' : 'on screen'}</span>
      </div>
      {to.mode === 'guide'
        ? <GuideApp />
        : <Practice key={world.id} saveKey={GAME_KEYS[world.id]} start={to.start} dealt={arrival === 'direct'} flavour={world.flavour} />}
      {leaving
        ? <Veil via={exitOf(to)} motion="cover" style={theme} onDone={() => setScreen(menu(exitOf(to)))} />
        : <Veil via={arrival} motion="clear" style={theme} onDone={() => setScreen(game(to))} />}
    </div>
  )
}
