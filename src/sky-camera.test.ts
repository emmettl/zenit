import {describe,it,expect} from 'vitest'
import {Vector3} from 'three'
import {cameraPose,OBSERVER,observerNormal} from './camera'
import {skyPose,skyView,turnSky} from './sky-camera'
describe('fixed-observer sky navigation',()=>{
  it('turns the camera in true local directions without translating the observer or changing the lens',()=>{
    const base=cameraPose(1),up=observerNormal(OBSERVER.latitude,OBSERVER.longitude),north=new Vector3(0,1,0).addScaledVector(up,-up.y).normalize(),east=new Vector3().crossVectors(north,up).normalize()
    for(const [altitude,azimuth] of [[0,0],[45,90],[-10,180],[85,312]]){
      const pose=skyPose(base,{altitude,azimuth},1),forward=new Vector3(0,0,-1).applyQuaternion(pose.rotation)
      expect(pose.position.distanceTo(base.position)).toBe(0);expect(pose.fieldOfView).toBe(base.fieldOfView)
      expect(forward.dot(up)).toBeCloseTo(Math.sin(altitude*Math.PI/180),10)
      expect(forward.dot(north)).toBeCloseTo(Math.cos(altitude*Math.PI/180)*Math.cos(azimuth*Math.PI/180),10)
      expect(forward.dot(east)).toBeCloseTo(Math.cos(altitude*Math.PI/180)*Math.sin(azimuth*Math.PI/180),10)
      expect(pose.rotation.length()).toBeCloseTo(1,12)
    }
    expect(turnSky({altitude:80,azimuth:359},4,20)).toEqual({altitude:85,azimuth:3})
    expect(turnSky({altitude:-8,azimuth:2},-4,-20)).toEqual({altitude:-10,azimuth:358})
  })
  it('returns continuously from a custom sky direction into the authored orbital path',()=>{
    const view={altitude:85,azimuth:140};let previous=skyPose(cameraPose(1),view,1)
    for(let i=999;i>=0;i--){const progress=i/1000,base=cameraPose(progress),pose=skyPose(base,view,progress)
      expect(pose.position.distanceTo(base.position)).toBe(0);expect(pose.fieldOfView).toBe(base.fieldOfView)
      expect(previous.rotation.angleTo(pose.rotation)).toBeLessThan(.06)
      if(progress<=.28)expect(pose.rotation.angleTo(base.rotation)).toBeLessThan(1e-7)
      previous=pose
    }
    expect(skyView(skyPose(cameraPose(1),view,1).rotation).azimuth).toBeCloseTo(140,10)
  })
})
