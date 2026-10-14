import { lazy, Suspense, useState } from 'react'
import GuideApp from './GuideApp'
import Practice from './Practice'

/** the 3D world menu (three.js) lives in its own chunk and loads only when shown */
const Menu = lazy(() => import('./menu/Menu'))

type Mode = 'guide' | 'practice'
const MODE = 'zoom-mode'
/** preview until the menu becomes the front door (IMPLEMENTATION_PLAN.md, phase 2) */
const menuPreview = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('menu')

export default function App() {
  const [mode, setMode] = useState<Mode>(() => { try { return localStorage.getItem(MODE) === 'guide' ? 'guide' : 'practice' } catch { return 'practice' } })
  const [inMenu, setInMenu] = useState(menuPreview)
  const pick = (m: Mode) => { setMode(m); try { localStorage.setItem(MODE, m) } catch { /* ignore */ } }
  if (inMenu) return <Suspense fallback={null}><Menu onEnter={() => setInMenu(false)} /></Suspense>
  return (
    <>
      <div className="modes">
        <b className="title">Fallaway</b>
        <button className={mode === 'practice' ? 'on' : ''} onClick={() => pick('practice')}>Play on screen</button>
        <button className={mode === 'guide' ? 'on' : ''} onClick={() => pick('guide')}>Play with a real deck</button>
      </div>
      {mode === 'guide' ? <GuideApp /> : <Practice />}
    </>
  )
}
