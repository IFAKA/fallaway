import { useState } from 'react'
import GuideApp from './GuideApp'
import Practice from './Practice'

type Mode = 'guide' | 'practice'
const MODE = 'zoom-mode'

export default function App() {
  const [mode, setMode] = useState<Mode>(() => { try { return localStorage.getItem(MODE) === 'practice' ? 'practice' : 'guide' } catch { return 'guide' } })
  const pick = (m: Mode) => { setMode(m); try { localStorage.setItem(MODE, m) } catch { /* ignore */ } }
  return (
    <>
      <div className="modes">
        <b className="title">Zoom</b>
        <button className={mode === 'guide' ? 'on' : ''} onClick={() => pick('guide')}>Play with a real deck (guide)</button>
        <button className={mode === 'practice' ? 'on' : ''} onClick={() => pick('practice')}>Practice on screen</button>
      </div>
      {mode === 'guide' ? <GuideApp /> : <Practice />}
    </>
  )
}
