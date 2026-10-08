import {describe,it,expect} from 'vitest'
import {Vector3,Quaternion} from 'three'
import {Body,GeoVector,RotateVector,Rotation_EQJ_EQD,SiderealTime} from 'astronomy-engine'
import {readFileSync} from 'node:fs'
import {earthFixedSun,illumination,illuminationWeight,solarSampler,AU_KM,SUN_RADIUS_KM} from './illumination'
import {EARTH_RADIUS_KM} from './camera'
import {orbitalPosition,orbitalTrailSamples,readOrbit} from './orbital'
const orbit=readOrbit(JSON.parse(readFileSync('public/data/orbital/iss-b1c62cd01d58.json','utf8')))
describe('finite-Sun spherical Earth shadow',()=>{
  it('classifies day, umbra and the two angular contacts; fades continuously without hiding geometry',()=>{
    const sun=new Vector3(AU_KM/EARTH_RADIUS_KM,0,0)
    expect(illumination(new Vector3(1.07,0,0),sun)).toEqual({state:'sunlit',transition:1})
    expect(illumination(new Vector3(-1.07,0,0),sun)).toEqual({state:'umbra',transition:0})
    const position=new Vector3(0,0,-1.07),distance=AU_KM/EARTH_RADIUS_KM,earth=Math.asin(1/1.07),solar=Math.asin(SUN_RADIUS_KM/EARTH_RADIUS_KM/distance)
    const at=(angle:number)=>illumination(position,position.clone().add(new Vector3(Math.sin(angle),0,Math.cos(angle)).multiplyScalar(distance)))
    expect(at(earth).state).toBe('penumbra');expect(at(earth).transition).toBeCloseTo(.5,10)
    expect(at(earth-solar-1e-8).state).toBe('umbra');expect(at(earth+solar+1e-8).state).toBe('sunlit')
    for(const boundary of [earth-solar,earth+solar])expect(Math.abs(at(boundary-1e-8).transition-at(boundary+1e-8).transition)).toBeLessThan(1e-8)
    for(const radius of [1.07,4.2,6.6]){const p=new Vector3(-radius,0,0),q=new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),1.7),original=p.clone();expect(illumination(p.clone().applyQuaternion(q),sun.clone().applyQuaternion(q))).toEqual(illumination(p,sun));expect(p).toEqual(original)}
    expect(illuminationWeight(0)).toBe(.5);expect(illuminationWeight(1)).toBe(1)
    expect(()=>illumination(new Vector3(),sun)).toThrow();expect(()=>illumination(new Vector3(NaN,2,0),sun)).toThrow()
  })
  it('matches an independently assembled EQJ→EQD→Earth-fixed solar basis and preserves AU distance',()=>{
    for(const time of [orbit.start,Date.parse(orbit.release.pass.peakUtc),orbit.end]){
      const date=new Date(time),raw=GeoVector(Body.Sun,date,false),v=RotateVector(Rotation_EQJ_EQD(date),raw),a=SiderealTime(date)*Math.PI/12
      const reference=new Vector3(Math.cos(a)*v.x+Math.sin(a)*v.y,v.z,Math.sin(a)*v.x-Math.cos(a)*v.y).multiplyScalar(AU_KM/EARTH_RADIUS_KM)
      expect(earthFixedSun(time).distanceTo(reference)).toBeLessThan(1e-8);expect(earthFixedSun(time).length()).toBeCloseTo(Math.hypot(raw.x,raw.y,raw.z)*AU_KM/EARTH_RADIUS_KM,9)
    }
  })
  it('retains the frozen ISS pass and emerges from umbra into sunlight during the authored sky hold',()=>{
    const initial=Date.parse(orbit.release.study.initialUtc),peak=Date.parse(orbit.release.pass.peakUtc),end=initial+200000
    for(const time of [initial,peak])expect(illumination(orbitalPosition(orbit,time)!.world,earthFixedSun(time)).state).toBe('umbra')
    expect(illumination(orbitalPosition(orbit,end)!.world,earthFixedSun(end)).state).toBe('sunlit')
    const states=new Set<string>();let last=0
    for(let time=peak;time<=end;time+=100){const result=illumination(orbitalPosition(orbit,time)!.world,earthFixedSun(time));states.add(result.state);expect(result.transition).toBeGreaterThanOrEqual(last-1e-8);last=result.transition}
    expect([...states]).toEqual(['umbra','penumbra','sunlit'])
    const samples=orbitalTrailSamples(orbit,end);expect(samples).toHaveLength(31);for(const [i,p] of samples.entries()){expect(p.time).toBe(end-(30-i)*2000);expect(p.world).toEqual(orbitalPosition(orbit,p.time)!.world)}
    const sampler=solarSampler(),sun=sampler(peak),copy=sun.clone();illumination(samples[0].world,sun);expect(sun).toEqual(copy);expect(sampler(peak)).toBe(sun)
    for(let i=0;i<150;i++)sampler(initial+i*1000);expect(sampler(peak)).toEqual(earthFixedSun(peak))
  })
})
