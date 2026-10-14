import { useEffect, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { MathUtils, type PerspectiveCamera } from 'three'
import { CarouselItem } from './CarouselItem'
import { WORLD_SCENES } from './planets'
import { reducedMotion } from './reducedMotion'
import { drag, useCarousel, useCurrentWorld } from './store'
import { DIVE_SECONDS, RISE_SECONDS } from './transition'
import { WORLDS } from './worlds'

const FOV = 40
const CAMERA_Z = 6
/** Stops outside the tallest surface details (clouds, lollipops)... */
const DIVE_Z = 1.9
/** ...and keeps narrowing the lens, so the planet covers the screen well before the end. */
const DIVE_ZOOM = 6

// Fast start, gentle finish: the camera answers the click at once (the dive's slow tail is under the colour wash).
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
// The rise eases out more gently, so most of the pull-back happens after its quick wash has cleared.
const easeOutQuad = (t: number) => 1 - (1 - t) ** 2

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

/** `dive`: from the carousel down to the selected world's surface. `rise`: the same move backwards, from the surface out to the carousel. */
export type CameraMove = 'idle' | 'dive' | 'rise'

interface DiveProps {
  camera: CameraMove
  /** The rise starts on its first rendered frame, so the planet is on screen before anything uncovers it. */
  onRiseStart?: () => void
  /** Called once when a dive or a rise is done. */
  onCameraEnd: () => void
}

// Own component so only the sparkles re-render when the world changes.
function MoonSparkles() {
  const world = useCurrentWorld()
  return world.id === 'moon' ? (
    <Sparkles count={40} scale={[10, 5, 4]} size={3} speed={0.3} color={world.accent} />
  ) : null
}

function Scene({ stage, camera, onRiseStart, onCameraEnd }: { stage: StageFrame } & DiveProps) {
  // Width of the stage in world units at the carousel's depth.
  const stageWidth = 2 * Math.tan(MathUtils.degToRad(FOV / 2)) * CAMERA_Z * (stage.width / stage.height)
  const spacing = Math.min(3.2, stageWidth * 0.32)
  const position = useRef(useCarousel.getState().index)
  /** The camera move in progress; restarts whenever `camera` changes. */
  const move = useRef({ kind: camera, elapsed: 0, started: false, ended: false })
  // One ref object per world so each planet reads its own animated offset.
  const [offsetRefs] = useState(() => WORLDS.map(() => ({ current: 0 })))

  useFrame(({ camera: lens, size }, delta) => {
    const m = move.current
    if (m.kind !== camera) Object.assign(m, { kind: camera, elapsed: 0, started: false, ended: false })
    const duration = camera === 'rise' ? RISE_SECONDS : DIVE_SECONDS
    if (camera !== 'idle') {
      // The first frame only starts the clock: its delta can include the scene's first compile.
      if (!m.started) {
        m.started = true
        if (camera === 'rise') onRiseStart?.()
      } else m.elapsed += delta
      if (!m.ended && m.elapsed >= duration) {
        m.ended = true
        onCameraEnd()
      }
    }
    const progress = Math.min(1, m.elapsed / duration)
    const eased = camera === 'rise' ? easeOutQuad(progress) : easeOutCubic(progress)
    // 0 frames the carousel, 1 is at the surface. The rise is the way back out, also easing out as it settles.
    const t = camera === 'dive' ? eased : camera === 'rise' ? 1 - eased : 0

    // Project as if the canvas were the stage, rendering the whole screen around it.
    // While diving, the window slides so the planet ends up centred on screen.
    // Mutating three.js objects per frame is the intended R3F pattern.
    const cam = lens as PerspectiveCamera
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
      : MathUtils.damp(position.current, target, drag.active ? 25 : 9, delta)
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
