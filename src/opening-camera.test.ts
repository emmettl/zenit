import {describe,it,expect} from 'vitest'
import {Vector3} from 'three'
import {openingCamera} from './opening-camera'
import {cameraPose,orbitView,orbitalCamera,POLAR_RATIO} from './camera'
const iss=new Vector3(-.8,-.5,-.42).normalize().multiplyScalar(1.065)
describe('orbital opening framing',()=>{
  it('separates family scales, fits portrait and centres the displayed ISS without changing its state',()=>{
    const copy=iss.clone()
    for(const aspect of [1280/720,390/664]){const fit=Math.max(1,1/aspect)
      for(const [time,radius] of [[2000,4.2],[6000,14],[10000,24],[15500,3.5]]){const pose=openingCamera(time,aspect,iss);expect(pose.position.length()).toBeCloseTo(radius*fit,12);expect(pose.fieldOfView).toBe(43);expect(new Vector3(pose.position.x,pose.position.y/POLAR_RATIO,pose.position.z).length()).toBeGreaterThan(1.08)}
      const final=openingCamera(15500,aspect,iss),forward=new Vector3(0,0,-1).applyQuaternion(final.rotation)
      expect(forward.dot(iss.clone().sub(final.position).normalize())).toBeCloseTo(1,12)
    }
    expect(iss).toEqual(copy)
  })
  it('is continuous through each transition and supports exact handover and descent capture',()=>{
    for(const time of [2600,4800,6800,9000,12000,15000,16000]){const before=openingCamera(time-.001,.59,iss),after=openingCamera(time+.001,.59,iss);expect(before.position.distanceTo(after.position)).toBeLessThan(.0001);expect(before.rotation.angleTo(after.rotation)).toBeLessThan(.0001)}
    for(const time of [2000,3700,7700,13000,15500]){const pose=openingCamera(time,.59,iss),manual=orbitalCamera(orbitView(pose.position));expect(manual.position.distanceTo(pose.position)).toBeLessThan(1e-12);expect(manual.rotation.angleTo(pose.rotation)).toBeLessThan(1e-7)}
    const final=openingCamera(16000,.59,iss),descent=cameraPose(.000001,undefined,24,final)
    expect(final.position.distanceTo(descent.position)).toBeLessThan(1e-8);expect(final.rotation.angleTo(descent.rotation)).toBeLessThan(1e-7)
    expect(openingCamera(15000,1,null).position.toArray().every(Number.isFinite)).toBe(true)
  })
})
