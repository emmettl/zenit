import { Matrix4, Quaternion, Vector3 } from 'three'

// Spherical camera composition only. These coordinates are not an orbital frame.
export const OBSERVER = { name: 'Zurich', latitude: 47.3769, longitude: 8.5417 }
export const EARTH_RADIUS_KM = 6371
export const LANDING_HEIGHT = 0.00004 // Earth-radius units: about 255 m above the sphere.

export function observerNormal(latitude: number, longitude: number): Vector3 {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon))
}

export function cameraPose(progress: number) {
  const p = Math.max(0, Math.min(1, progress))
  const t = p * p * (3 - 2 * p)
  const normal = observerNormal(OBSERVER.latitude, OBSERVER.longitude)
  const start = new Vector3(0.5, 0.28, 1).normalize()
  const radial = start.clone().lerp(normal, t).normalize()
  const radius = Math.exp(Math.log(4.2) * (1 - t)) + LANDING_HEIGHT
  const position = radial.multiplyScalar(radius)
  const north = new Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize()
  const skyDirection = north.multiplyScalar(Math.cos(Math.PI / 6)).addScaledVector(normal, Math.sin(Math.PI / 6))
  const orbital = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, new Vector3(), new Vector3(0, 1, 0)))
  const surface = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, position.clone().add(skyDirection), normal))
  const tilt = Math.max(0, (t - 0.55) / 0.45)
  return { position, rotation: orbital.slerp(surface, tilt * tilt * (3 - 2 * tilt)) }
}
