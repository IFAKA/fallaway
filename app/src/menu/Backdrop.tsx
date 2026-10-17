import type { CSSProperties, ReactNode } from 'react'
import type { WorldId } from './worlds'
import { seededRandom } from './random'
import './backdrop.css'

// Decoration layouts are generated once so they stay put between renders.
const random = seededRandom(99)
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]
const pct = (from = 0, span = 100) => `${(from + random() * span).toFixed(1)}%`
// --slow stretches every animation (the calm backdrop behind the game board)
const timing = (duration: number, delay: number) => ({
  animationDuration: `calc(${duration}s * var(--slow, 1))`,
  animationDelay: `calc(${delay}s * var(--slow, 1))`,
})
const style = (values: Record<string, string | number>) => values as CSSProperties

/** One decorative span per style, all sharing a class. */
function Sprites({ className, styles }: { className: string; styles: readonly CSSProperties[] }) {
  return styles.map((s, i) => <span key={i} className={className} style={s} />)
}

const clouds = Array.from({ length: 6 }, () =>
  style({ top: pct(5, 70), '--scale': 0.6 + random() * 0.9, ...timing(60 + random() * 50, -random() * 110) }),
)

const birds = Array.from({ length: 4 }, (_, i) => ({ top: pct(10, 30), ...timing(28 + random() * 14, -i * 9) }))

const SPRINKLE_COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#8e7dff', '#4cc9f0', '#ffffff']
const sprinkles = Array.from({ length: 36 }, () =>
  style({ left: pct(), background: pick(SPRINKLE_COLORS), ...timing(9 + random() * 9, -random() * 18) }),
)

const lollipops = [
  { left: '6%', top: '22%', size: 70, delay: 0 },
  { left: '88%', top: '16%', size: 54, delay: -2 },
  { left: '10%', top: '72%', size: 46, delay: -4 },
  { left: '84%', top: '68%', size: 64, delay: -1 },
].map(({ size, delay, ...at }) => style({ ...at, '--size': `${size}px`, animationDelay: `calc(${delay}s * var(--slow, 1))` }))

const stars = Array.from({ length: 70 }, () => {
  const at = { left: pct(), top: pct() }
  const size = random() > 0.85 ? 3 : random() > 0.5 ? 2 : 1
  return style({ ...at, width: size, height: size, ...timing(2 + random() * 4, -random() * 6) })
})

// Static, so the layers are built once instead of on every render.
const LAYERS: Record<WorldId, ReactNode> = {
  earth: (
    <>
      <Sprites className="cloud" styles={clouds} />
      {birds.map((s, i) => (
        <svg key={i} className="bird" viewBox="0 0 24 8" style={s}>
          <path d="M1 6 Q6 0 12 5 Q18 0 23 6" />
        </svg>
      ))}
    </>
  ),
  candy: (
    <>
      <Sprites className="sprinkle" styles={sprinkles} />
      <Sprites className="lollipop" styles={lollipops} />
    </>
  ),
  moon: (
    <>
      <Sprites className="star" styles={stars} />
      <span className="shooting-star" />
      <span className="shooting-star shooting-star-late" />
      <span className="distant-earth" />
    </>
  ),
}

const IDS = Object.keys(LAYERS) as WorldId[]

interface BackdropProps {
  active: WorldId
  /** `calm`: fainter and slower, behind the game board so it never competes with the cards. */
  tone?: 'full' | 'calm'
}

/** Themed decorations behind a screen; layers cross-fade when the world changes. */
export function Backdrop({ active, tone = 'full' }: BackdropProps) {
  return (
    <div className="backdrop" data-tone={tone} aria-hidden="true">
      {IDS.map((id) => (
        <div key={id} className="backdrop-layer" data-active={id === active}>
          {LAYERS[id]}
        </div>
      ))}
    </div>
  )
}
