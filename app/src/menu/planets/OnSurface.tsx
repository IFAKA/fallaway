import { useMemo, type ReactNode } from 'react'
import { Quaternion, Vector3 } from 'three'
import type { SurfacePoint } from './geometry'

const UP = new Vector3(0, 1, 0)

interface OnSurfaceProps extends SurfacePoint {
  children: ReactNode
}

/** Places children on a sphere so their local +Y points away from the centre. */
export function OnSurface({ dir, radius, children }: OnSurfaceProps) {
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, dir), [dir])
  return (
    <group position={[dir.x * radius, dir.y * radius, dir.z * radius]} quaternion={quaternion}>
      {children}
    </group>
  )
}

interface ScatterProps<T extends SurfacePoint> {
  items: readonly T[]
  /** What to stand on each spot. */
  children: (item: T) => ReactNode
}

/** Stands one decoration on each surface point. */
export function Scatter<T extends SurfacePoint>({ items, children }: ScatterProps<T>) {
  return items.map((item, i) => (
    <OnSurface key={i} dir={item.dir} radius={item.radius}>
      {children(item)}
    </OnSurface>
  ))
}
