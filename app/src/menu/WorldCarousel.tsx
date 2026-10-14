import { useEffect, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { MathUtils, type PerspectiveCamera } from 'three'
import { CarouselItem } from './CarouselItem'
import { WORLD_SCENES } from './planets'
import { reducedMotion } from './reducedMotion'
import { drag, useCarousel, useCurrentWorld } from './store'
import { DIVE_SECONDS } from './transition'
import { WORLDS } from './worlds'

const FOV = 40
const CAMERA_Z = 6
/** Stops outside the tallest surface details (clouds, lollipops)... */
const DIVE_Z = 1.9
/** ...and keeps narrowing the lens, so the planet covers the screen well before the end. */
const DIVE_ZOOM = 6

// Keeps accelerating to the very end: one continuous dive with no settling pause.
const easeInQuad = (t: number) => t * t

const wrap = (value: number, size: number) =>
  ((((value + size / 2) % size) + size) % size) - size / 2

/** The stage's box in canvas pixels. The carousel is framed to it; the canvas covers the screen. */
interface StageFrame {
  x: number
  y: number
  width: number
  height: number
}

const sameFrame = (a: StageFrame, b: StageFrame) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

interface DiveProps {
  /** Starts the camera dive into the selected world. */
  diving: boolean
  /** Called once when the dive reaches the surface. */
  onDiveEnd: () => void
}

// Own component so only the sparkles re-render when the world changes.
function MoonSparkles() {
  const world = useCurrentWorld()
  return world.id === 'moon' ? (
    <Sparkles count={40} scale={[10, 5, 4]} size={3} speed={0.3} color={world.accent} />
  ) : null
}

function Scene({ stage, diving, onDiveEnd }: { stage: StageFrame } & DiveProps) {
  // Width of the stage in world units at the carousel's depth.
  const stageWidth = 2 * Math.tan(MathUtils.degToRad(FOV / 2)) * CAMERA_Z * (stage.width / stage.height)
  const spacing = Math.min(3.2, stageWidth * 0.32)
  const position = useRef(useCarousel.getState().index)
  const elapsed = useRef(0)
  const arrived = useRef(false)
  // One ref object per world so each planet reads its own animated offset.
  const [offsetRefs] = useState(() => WORLDS.map(() => ({ current: 0 })))

  useFrame(({ camera, size }, delta) => {
    if (diving && !arrived.current) {
      elapsed.current += delta
      if (elapsed.current >= DIVE_SECONDS) {
        arrived.current = true
        onDiveEnd()
      }
    }
    const t = easeInQuad(Math.min(1, elapsed.current / DIVE_SECONDS))

    // Project as if the canvas were the stage, rendering the whole screen around it.
    // While diving, the window slides so the planet ends up centred on screen.
    // Mutating three.js objects per frame is the intended R3F pattern.
    const cam = camera as PerspectiveCamera
    // oxlint-disable-next-line react/immutability
    cam.position.z = MathUtils.lerp(CAMERA_Z, DIVE_Z, t)
    cam.zoom = MathUtils.lerp(1, DIVE_ZOOM, t)
    cam.aspect = stage.width / stage.height
    cam.setViewOffset(
      stage.width,
      stage.height,
      MathUtils.lerp(-stage.x, (stage.width - size.width) / 2, t),
      MathUtils.lerp(-stage.y, (stage.height - size.height) / 2, t),
      size.width,
      size.height,
    )

    const target = useCarousel.getState().index - drag.progress
    // Follow the pointer tightly while dragging, ease into place on release.
    position.current = reducedMotion
      ? target
      : MathUtils.damp(position.current, target, drag.active ? 25 : 6, delta)
    offsetRefs.forEach((ref, i) => {
      ref.current = wrap(i - position.current, WORLDS.length)
    })
  })

  return (
    <>
      <hemisphereLight args={['#cfe3ff', '#20152e', 0.5]} />
      <directionalLight position={[3, 3, 4]} intensity={2.4} />
      <MoonSparkles />
      {WORLDS.map((world, i) => {
        const WorldScene = WORLD_SCENES[world.id]
        return (
          <CarouselItem key={world.id} offsetRef={offsetRefs[i]} spacing={spacing}>
            <WorldScene />
          </CarouselItem>
        )
      })}
    </>
  )
}

/** Full-screen canvas whose carousel lines up with the `stage` element. */
export function WorldCarousel({ stageRef, ...dive }: { stageRef: RefObject<HTMLElement | null> } & DiveProps) {
  const layer = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<StageFrame | null>(null)

  // Not a layout effect: the stage renders after this component, so its ref
  // is only attached once the whole commit is done.
  useEffect(() => {
    const stageEl = stageRef.current
    const layerEl = layer.current
    if (!stageEl || !layerEl) return
    const measure = () => {
      const s = stageEl.getBoundingClientRect()
      const c = layerEl.getBoundingClientRect()
      const next = { x: s.left - c.left, y: s.top - c.top, width: s.width, height: s.height }
      setStage((prev) => (prev && sameFrame(prev, next) ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stageEl)
    observer.observe(layerEl)
    return () => observer.disconnect()
  }, [stageRef])

  return (
    <div className="canvas-layer" ref={layer} aria-hidden="true">
      {stage && stage.width > 0 && stage.height > 0 ? (
        <Canvas camera={{ position: [0, 0, CAMERA_Z], fov: FOV }} dpr={[1, 2]}>
          <Scene stage={stage} {...dive} />
        </Canvas>
      ) : null}
    </div>
  )
}
