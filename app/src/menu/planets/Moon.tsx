import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Color, type Group } from 'three'
import { reducedMotion } from '../reducedMotion'
import { Scatter } from './OnSurface'
import { PlanetBody } from './parts'
import { createPlanet, fbm, randomDirection, seededRandom } from './geometry'

const SEED = 42
const random = seededRandom(SEED)

const craters = Array.from({ length: 14 }, () => {
  const size = 0.12 + random() * 0.23
  return { center: randomDirection(random), size, depth: size * 0.35 }
})

function height(dir: Vector3) {
  let h = (fbm(dir, 3, SEED) - 0.47) * 0.05
  for (const { center, size, depth } of craters) {
    const x = Math.acos(Math.min(1, Math.max(-1, dir.dot(center)))) / size
    if (x < 1) h -= depth * (1 - x * x)
    else if (x < 1.35) h += depth * 0.35 * (1 - (x - 1) / 0.35)
  }
  return h
}

function faceColor(_dir: Vector3, h: number, out: Color) {
  if (h < -0.03) out.set('#4f5060')
  else if (h < -0.005) out.set('#6e6f80')
  else if (h < 0.015) out.set('#9a9bab')
  else out.set('#c4c5d2')
}

const planet = createPlanet({ detail: 3, height, faceColor })

const creatures = [
  { color: '#7be08a', eyes: 1 },
  { color: '#b38cff', eyes: 2 },
  { color: '#ffb86b', eyes: 1 },
  { color: '#6fd3ff', eyes: 2 },
  { color: '#ff7aa8', eyes: 1 },
].map((creature, i) => ({ ...creature, ...planet.surface(randomDirection(random)), phase: i * 1.3 }))

interface CreatureProps {
  color: string
  eyes: number
  phase: number
}

function Creature({ color, eyes, phase }: CreatureProps) {
  const body = useRef<Group>(null)

  // Little hop with squash and stretch.
  useFrame(({ clock }) => {
    const b = body.current
    if (!b || reducedMotion) return
    const hop = Math.abs(Math.sin(clock.elapsedTime * 2.5 + phase))
    b.position.y = hop * 0.05
    b.scale.set(1 + (1 - hop) * 0.12, 0.88 + hop * 0.12, 1 + (1 - hop) * 0.12)
  })

  const single = eyes === 1
  const eyeOffsets = single ? [0] : [-0.035, 0.035]

  return (
    <group ref={body}>
      <mesh position={[0, 0.09, 0]}>
        <icosahedronGeometry args={[0.09, 1]} />
        <meshStandardMaterial color={color} flatShading roughness={0.7} />
      </mesh>
      {eyeOffsets.map((x) => (
        <group key={x} position={[x, 0.12, 0.072]}>
          <mesh>
            <sphereGeometry args={[single ? 0.035 : 0.024, 10, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, single ? 0.028 : 0.019]}>
            <sphereGeometry args={[single ? 0.016 : 0.011, 8, 6]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.08, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <sphereGeometry args={[0.018, 8, 6]} />
        <meshStandardMaterial color="#fff38a" emissive="#fff38a" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

export function Moon() {
  return (
    <group>
      <PlanetBody geometry={planet.geometry} roughness={1} />
      <Scatter items={creatures}>{(creature) => <Creature {...creature} />}</Scatter>
    </group>
  )
}
