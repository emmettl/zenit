import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { cameraPose, orbitalCamera, orbitView, LANDING_HEIGHT, OBSERVER, observerNormal, POLAR_RATIO, earthSurface } from './camera'

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


describe('interactive orbital camera',()=>{
  it('keeps the default follow camera outward and the selected body centred around a complete orbit',()=>{
    for(let i=0;i<=360;i++){
      const a=i*Math.PI/180,target=new Vector3(Math.cos(a),.7*Math.sin(a),Math.sin(a)).normalize().multiplyScalar(1.06)
      const pose=orbitalCamera({yaw:0,pitch:0,distance:2.5},target,true)
      expect(pose.position.clone().sub(target).dot(target.clone().normalize())).toBeCloseTo(2.5,12)
      expect(new Vector3(0,0,-1).applyQuaternion(pose.rotation).dot(target.clone().sub(pose.position).normalize())).toBeCloseTo(1,12)
    }
  })
  it('keeps zoomed and followed views outside the WGS84 Earth, including pole and inward drags',()=>{
    const centre=orbitalCamera({yaw:-Math.PI/2,pitch:0,distance:1.08},new Vector3(1.08,0,0))
    expect(centre.position.length()).toBeGreaterThanOrEqual(1.029999999)
    for(const target of [new Vector3(),new Vector3(1.06,0,0),new Vector3(0,0,6.6)])
      for(const distance of [0.001,.15,.8,4.2,60,1000])for(let i=0;i<60;i++){
        const pose=orbitalCamera({yaw:i*.7,pitch:i*.2-6,distance},target)
        expect(new Vector3(pose.position.x,pose.position.y/POLAR_RATIO,pose.position.z).length()).toBeGreaterThanOrEqual(1.029999999)
        expect(pose.position.toArray().every(Number.isFinite)).toBe(true)
        expect(pose.rotation.length()).toBeCloseTo(1,12)
        const toward=target.clone().sub(pose.position).normalize()
        expect(new Vector3(0,0,-1).applyQuaternion(pose.rotation).dot(toward)).toBeCloseTo(1,10)
      }
  })
  it('descends continuously from arbitrary and antipodal views to the same observer',()=>{
    const landing=cameraPose(1),antipode=landing.position.clone().normalize().multiplyScalar(-1.08)
    for(const from of [orbitalCamera(orbitView(antipode)),orbitalCamera({yaw:1,pitch:.3,distance:.8},new Vector3(1.05,.02,.01))]){
      expect(cameraPose(0,undefined,4.2,from).position.distanceTo(from.position)).toBeLessThan(1e-12)
      expect(cameraPose(0,undefined,4.2,from).rotation.angleTo(from.rotation)).toBeLessThan(1e-7)
      for(let i=0;i<=1000;i++){
        const pose=cameraPose(i/1000,undefined,4.2,from)
        expect(new Vector3(pose.position.x,pose.position.y/POLAR_RATIO,pose.position.z).length()).toBeGreaterThan(1)
        expect(pose.rotation.length()).toBeCloseTo(1,12)
        expect(pose.position.toArray().every(Number.isFinite)).toBe(true)
      }
      expect(cameraPose(1,undefined,4.2,from).position.distanceTo(landing.position)).toBeLessThan(1e-12)
      expect(cameraPose(1,undefined,4.2,from).rotation.angleTo(landing.rotation)).toBeLessThan(1e-7)
    }
  })
})
