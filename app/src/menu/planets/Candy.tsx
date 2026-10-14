import { useLayoutEffect, useRef } from 'react'
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  Matrix4,
  Quaternion,
  TubeGeometry,
  Vector3,
  type InstancedMesh,
} from 'three'
import { Scatter } from './OnSurface'
import { PlanetBody, Spin } from './parts'
import { createPlanet, fbm, randomDirection, seededRandom } from './geometry'

const SEED = 21
const SWEETS = ['#ff4d6d', '#ffd166', '#06d6a0', '#8e7dff', '#4cc9f0', '#ffffff']

const height = (dir: Vector3) => fbm(dir, 2.5, SEED) * 0.1 - 0.04

function faceColor(dir: Vector3, _h: number, out: Color) {
  const angle = Math.atan2(dir.z, dir.x)
  // Frosting cap with drips around its edge.
  if (dir.y > 0.62 + 0.08 * Math.sin(angle * 8)) {
    out.set('#fff3f8')
    return
  }
  const swirl = Math.sin(angle * 2 + dir.y * 7 + fbm(dir, 3, SEED) * 6)
  if (swirl > 0.35) out.set('#ff5d95')
  else if (swirl < -0.35) out.set('#ffb3cf')
  else out.set('#ff86b3')
}

const planet = createPlanet({ detail: 2, height, faceColor })

function createCaneGeometry() {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0, 0.2, 0),
    new Vector3(0, 0.3, 0),
    new Vector3(0.04, 0.36, 0),
    new Vector3(0.09, 0.35, 0),
    new Vector3(0.11, 0.3, 0),
  ])
  const tubular = 48
  const radial = 6
  const tube = new TubeGeometry(curve, tubular, 0.018, radial)
  const colors = new Float32Array(tube.attributes.position.count * 3)
  const red = new Color('#e63946')
  const white = new Color('#ffffff')
  for (let i = 0; i < tube.attributes.position.count; i++) {
    const u = Math.floor(i / (radial + 1)) / tubular
    ;(Math.floor(u * 14) % 2 ? red : white).toArray(colors, i * 3)
  }
  tube.setAttribute('color', new BufferAttribute(colors, 3))
  return tube
}

const caneGeometry = createCaneGeometry()

const random = seededRandom(SEED)
// Keep decorations off the frosting cap so they read clearly.
const spot = () => {
  let dir = randomDirection(random)
  while (dir.y > 0.55) dir = randomDirection(random)
  return planet.surface(dir)
}
const lollipops = Array.from({ length: 5 }, (_, i) => ({ ...spot(), color: SWEETS[i % 5] }))
const canes = Array.from({ length: 3 }, () => ({ ...spot(), turn: random() * Math.PI * 2 }))
const gumdrops = Array.from({ length: 14 }, (_, i) => ({ ...spot(), color: SWEETS[i % 5] }))

const SPRINKLES = 90

function SprinkleRing() {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const rand = seededRandom(SEED + 1)
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const color = new Color()
    for (let i = 0; i < SPRINKLES; i++) {
      const angle = rand() * Math.PI * 2
      const r = 1.4 + rand() * 0.2
      rotation.setFromAxisAngle(randomDirection(rand), rand() * Math.PI)
      matrix.compose(
        new Vector3(Math.cos(angle) * r, (rand() - 0.5) * 0.06, Math.sin(angle) * r),
        rotation,
        new Vector3(1, 1, 1),
      )
      m.setMatrixAt(i, matrix)
      m.setColorAt(i, color.set(SWEETS[i % SWEETS.length]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [])

  return (
    <group rotation={[0.35, 0, 0.2]}>
      <Spin speed={-0.2}>
        <instancedMesh ref={mesh} args={[undefined, undefined, SPRINKLES]}>
          <capsuleGeometry args={[0.018, 0.05, 2, 6]} />
          <meshStandardMaterial roughness={0.5} />
        </instancedMesh>
      </Spin>
    </group>
  )
}

export function Candy() {
  return (
    <group>
      <PlanetBody geometry={planet.geometry} roughness={0.6} />

      <Scatter items={lollipops}>
        {({ color }) => (
          <>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.28, 6]} />
              <meshStandardMaterial color="#fafafa" />
            </mesh>
            <group position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.1, 0.1, 0.035, 16]} />
                <meshStandardMaterial color={color} flatShading roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.019, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.06, 0.012, 6, 20]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </group>
          </>
        )}
      </Scatter>

      <Scatter items={canes}>
        {({ turn }) => (
          <mesh geometry={caneGeometry} rotation={[0, turn, 0]}>
            <meshStandardMaterial vertexColors roughness={0.4} />
          </mesh>
        )}
      </Scatter>

      <Scatter items={gumdrops}>
        {({ color }) => (
          <mesh>
            <sphereGeometry args={[0.05, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} flatShading roughness={0.3} />
          </mesh>
        )}
      </Scatter>

      <SprinkleRing />
    </group>
  )
}
