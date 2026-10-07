import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { cameraPose, LANDING_HEIGHT, OBSERVER, observerNormal, POLAR_RATIO, earthSurface } from './camera'

describe('surface camera composition', () => {
  it('never crosses the ellipsoidal ground during the complete descent', () => {
    for (let i = 0; i <= 1000; i++) {
      const pose = cameraPose(i / 1000)
      expect(new Vector3(pose.position.x,pose.position.y/POLAR_RATIO,pose.position.z).length()).toBeGreaterThan(1)
      expect(pose.rotation.length()).toBeCloseTo(1, 12)
    }
  })
  it('lands above the declared observer and looks thirty degrees above the horizon', () => {
    const normal = observerNormal(OBSERVER.latitude, OBSERVER.longitude)
    const pose = cameraPose(1)
    expect(pose.position.distanceTo(earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(normal,LANDING_HEIGHT))).toBeLessThan(1e-12)
    const direction = new Vector3(0, 0, -1).applyQuaternion(pose.rotation)
    expect(direction.dot(normal)).toBeCloseTo(0.5, 12)
  })
  it('seeking and reversing resolve the same pose and clamp endpoints', () => {
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const forward = cameraPose(t), backward = cameraPose(1 - (1 - t))
      expect(forward.position.distanceTo(backward.position)).toBeLessThan(1e-12)
      expect(forward.rotation.angleTo(backward.rotation)).toBeLessThan(1e-7)
    }
    expect(cameraPose(-1).position.equals(cameraPose(0).position)).toBe(true)
    expect(cameraPose(2).position.equals(cameraPose(1).position)).toBe(true)
  })
})
