import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group, type Material, type Mesh } from 'three'
import { reducedMotion } from './reducedMotion'

interface CarouselItemProps {
  /** Smoothly animated carousel offset: 0 is centered, ±1 is a neighbour. */
  offsetRef: { current: number }
  spacing: number
  children: ReactNode
}

export function CarouselItem({ offsetRef, spacing, children }: CarouselItemProps) {
  const group = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const materials = useRef<Material[]>([])

  // Collect every material once so the whole world can fade as one.
  useLayoutEffect(() => {
    const found = new Set<Material>()
    group.current?.traverse((object) => {
      const material = (object as Mesh).material
      if (!material) return
      for (const m of Array.isArray(material) ? material : [material]) {
        m.userData.baseOpacity ??= m.opacity
        m.transparent = true
        found.add(m)
      }
    })
    materials.current = [...found]
  }, [])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const distance = Math.abs(offsetRef.current)
    const focus = MathUtils.clamp(1 - distance, 0, 1)
    // Fade out past the neighbours so the looping world never pops in.
    const edge = MathUtils.clamp((1.5 - distance) / 0.5, 0, 1)

    g.position.x = offsetRef.current * spacing
    g.position.z = -(1 - focus) * 0.8
    g.scale.setScalar(MathUtils.lerp(0.6, 1.1, focus) * MathUtils.lerp(0.6, 1, edge))
    g.visible = edge > 0

    const fade = MathUtils.lerp(0.4, 1, focus) * edge
    // Mutating three.js objects per frame is the intended R3F pattern.
    // oxlint-disable-next-line react/immutability
    for (const m of materials.current) m.opacity = m.userData.baseOpacity * fade

    // The selected world turns faster than its neighbours.
    if (spin.current && !reducedMotion) spin.current.rotation.y += delta * (0.1 + focus * 0.2)
  })

  return (
    <group ref={group}>
      <group ref={spin}>{children}</group>
    </group>
  )
}
