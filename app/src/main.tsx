import { Component, StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.tsx'
import { GAME_KEYS } from './save'

/** if a render ever fails (for example a damaged saved game), offer a clean restart instead of a blank page */
class Recover extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { error: String(e) } }
  reset = () => {
    try { for (const k of [...Object.values(GAME_KEYS), 'zoom-guide-v4']) localStorage.removeItem(k) } catch { /* ignore */ }
    location.reload()
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="guide" style={{ margin: 24 }}>
        <div className="gtitle">Something went wrong</div>
        <div className="gbody">The saved game could not be loaded. Start fresh: your win record is kept.</div>
        <button className="big" onClick={this.reset}>Start fresh</button>
        <div className="muted" style={{ marginTop: 8 }}>{this.state.error}</div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Recover><App /></Recover>
  </StrictMode>,
)
