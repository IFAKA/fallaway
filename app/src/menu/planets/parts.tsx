import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BufferGeometry, Group } from 'three'
import { reducedMotion } from '../reducedMotion'

/** The planet's ground: vertex-coloured, flat-shaded faces. */
export function PlanetBody({ geometry, roughness }: { geometry: BufferGeometry; roughness: number }) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading roughness={roughness} />
    </mesh>
  )
}

/** Turns its children around the Y axis at `speed` radians per second (negative turns the other way). */
export function Spin({ speed, children }: { speed: number; children: ReactNode }) {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current && !reducedMotion) group.current.rotation.y += delta * speed
  })
  return <group ref={group}>{children}</group>
}
