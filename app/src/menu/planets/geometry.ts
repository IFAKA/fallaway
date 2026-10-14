import { BufferAttribute, Color, IcosahedronGeometry, Vector3 } from 'three'

const fract = (x: number) => x - Math.floor(x)
const smooth = (t: number) => t * t * (3 - 2 * t)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

const hash = (x: number, y: number, z: number, seed: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.3) * 43758.5453)

function valueNoise(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = smooth(x - xi)
  const v = smooth(y - yi)
  const w = smooth(z - zi)
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed)
  return mix(
    mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v),
    mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}

/** Fractal noise on a direction, roughly in [0, 0.94] with a mean near 0.47. */
export function fbm(dir: Vector3, scale: number, seed: number, octaves = 4) {
  let amplitude = 0.5
  let frequency = scale
  let sum = 0
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(dir.x * frequency, dir.y * frequency, dir.z * frequency, seed + i)
    amplitude *= 0.5
    frequency *= 2
  }
  return sum
}

export { seededRandom } from '../random'

export function randomDirection(random: () => number) {
  const y = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const r = Math.sqrt(1 - y * y)
  return new Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
}

/** Evenly spread points on a unit sphere. */
export function fibonacciSphere(count: number) {
  const points: Vector3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    points.push(new Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r))
  }
  return points
}

/** A spot on or above a planet: unit direction from the centre and distance along it. */
export interface SurfacePoint {
  dir: Vector3
  radius: number
}

interface PlanetOptions {
  detail: number
  /** Surface offset from radius 1 for a unit direction. */
  height: (dir: Vector3) => number
  /** Writes the colour of one triangle into `out`. */
  faceColor: (dir: Vector3, height: number, out: Color) => void
}

/** Low-poly planet: displaced icosphere with one flat colour per triangle. */
function createPlanetGeometry({ detail, height, faceColor }: PlanetOptions) {
  const geometry = new IcosahedronGeometry(1, detail)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const dirs: Vector3[] = []
  const heights: number[] = []

  for (let i = 0; i < position.count; i++) {
    const dir = new Vector3().fromBufferAttribute(position, i).normalize()
    const h = height(dir)
    dirs.push(dir)
    heights.push(h)
    position.setXYZ(i, dir.x * (1 + h), dir.y * (1 + h), dir.z * (1 + h))
  }

  const centroid = new Vector3()
  const color = new Color()
  for (let i = 0; i < position.count; i += 3) {
    centroid.copy(dirs[i]).add(dirs[i + 1]).add(dirs[i + 2]).normalize()
    faceColor(centroid, (heights[i] + heights[i + 1] + heights[i + 2]) / 3, color)
    for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3)
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** A planet's mesh plus a helper that puts a direction on its ground. */
export function createPlanet(options: PlanetOptions) {
  return {
    geometry: createPlanetGeometry(options),
    surface: (dir: Vector3): SurfacePoint => ({ dir, radius: 1 + options.height(dir) }),
  }
}
