import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {sgp4,twoline2satrec} from 'satellite.js'
import {Vector3} from 'three'
import {advanceStudy,orbitalPosition,orbitalTrail,readOrbit} from './orbital'
import {cameraPose,EARTH_RADIUS_KM,earthSurface,LANDING_HEIGHT,OBSERVER,observerNormal} from './camera'
import {blockedByEarth,horizonReading,solarAltitude} from './stellar'
import reference from './orbital-reference.json'
const manifest=JSON.parse(readFileSync('public/data/zenit-manifest.json','utf8'))
const raw=JSON.parse(readFileSync('public/data/'+(manifest.evidence.iss??manifest.evidence.orbital).file,'utf8')),orbit=readOrbit(raw)
const vector=(v:{x:number;y:number;z:number})=>new Vector3(v.x,v.y,v.z)
describe('SGP4 and frame evidence',()=>{
  it('matches independent near/deep-space propagation and handles decay at positive and negative offsets',()=>{
    for(const c of reference.iss){const actual=orbitalPosition(orbit,orbit.epoch+c.minutesSinceEpoch*60000)!;expect(vector(actual.teme).distanceTo(new Vector3(...c.positionKm))).toBeLessThan(.00002);expect(vector(actual.velocity).distanceTo(new Vector3(...c.velocityKmPerSecond))).toBeLessThan(1e-7)}
    for(const item of reference.verification){const baseline=twoline2satrec(item.line1,item.line2);for(const c of item.cases){const state={...baseline},actual=sgp4(state,c.minutesSinceEpoch);expect(state.error).toBe(c.error);if(c.error){expect(actual).toBeNull()}else{expect(vector(actual!.position).distanceTo(new Vector3(...c.positionKm!))).toBeLessThan(.00002);expect(vector(actual!.velocity).distanceTo(new Vector3(...c.velocityKmPerSecond!))).toBeLessThan(1e-7)}}}
  })
  it('matches independent Earth-fixed directions, WGS84 observer and horizon crossings',()=>{
    const site=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(observerNormal(OBSERVER.latitude,OBSERVER.longitude),LANDING_HEIGHT).multiplyScalar(EARTH_RADIUS_KM)
    expect(site.distanceTo(new Vector3(reference.observerEcfKm[0],reference.observerEcfKm[2],-reference.observerEcfKm[1]))).toBeLessThan(1e-7)
    for(const c of reference.horizons){const actual=orbitalPosition(orbit,Date.parse(c.time))!;expect(vector(actual.fixed).distanceTo(new Vector3(...c.positionKm))).toBeLessThan(.05);expect(Math.abs(actual.altitude-c.altitude)).toBeLessThan(.01);expect(Math.abs(actual.azimuth-c.azimuth)).toBeLessThan(.01);expect(Math.abs(actual.rangeKm-c.rangeKm)).toBeLessThan(.05)
      const cameraDirection=actual.world.clone().sub(site.clone().divideScalar(EARTH_RADIUS_KM)).normalize();expect(Math.abs(horizonReading(cameraDirection).altitude-actual.altitude)).toBeLessThan(1e-7)
    }
    expect(orbitalPosition(orbit,Date.parse(raw.pass.riseUtc)-2000)!.altitude).toBeLessThan(0);expect(orbitalPosition(orbit,Date.parse(raw.pass.riseUtc)+2000)!.altitude).toBeGreaterThan(0)
  })
  it('matches independent solar geometry at the night-side pass and study bounds',()=>{
    for(const c of reference.solar)expect(Math.abs(solarAltitude(Date.parse(c.time))-c.altitude)).toBeLessThan(.02)
  })
  it('preserves deterministic direct seeks and trails after arbitrary forward and backward evaluations',()=>{
    const time=Date.parse(raw.pass.peakUtc),position=orbitalPosition(orbit,time)!.world.toArray(),trail=orbitalTrail(orbit,time).map(x=>x.toArray())
    for(const offset of [7200000,-3600000,90000,-40000,0])orbitalPosition(orbit,time+offset)
    expect(orbitalPosition(orbit,time)!.world.toArray()).toEqual(position);expect(orbitalTrail(orbit,time).map(x=>x.toArray())).toEqual(trail);expect(trail).toHaveLength(31)
    expect(orbitalPosition(orbit,orbit.start-1)).toBeNull();expect(orbitalPosition(orbit,orbit.end+1)).toBeNull();expect(orbitalPosition(orbit,NaN)).toBeNull()
  })
  it('bounds two-second trail chord error against direct propagation throughout the study',()=>{
    let maximumKm=0
    for(let time=orbit.start+1000;time<orbit.end-1000;time+=300000){const before=orbitalPosition(orbit,time-1000)!.world,after=orbitalPosition(orbit,time+1000)!.world,actual=orbitalPosition(orbit,time)!.world;maximumKm=Math.max(maximumKm,before.add(after).multiplyScalar(.5).distanceTo(actual)*EARTH_RADIUS_KM)}
    expect(maximumKm).toBeLessThan(.006)
  })
  it('rejects invalid frames, epoch windows and element ranges',()=>{
    for(const mutate of [(r:typeof raw)=>{r.elements[0].REF_FRAME='J2000'},(r:typeof raw)=>{r.elements[0].ECCENTRICITY=1},(r:typeof raw)=>{r.study.endUtc='2026-10-10T00:00:00Z'},(r:typeof raw)=>{r.elements[0].MEAN_MOTION=NaN}]){const data=structuredClone(raw);mutate(data);expect(()=>readOrbit(data)).toThrow()}
  })
  it('keeps a front-of-Earth satellite selectable and blocks one behind the ellipsoid',()=>{
    const camera=new Vector3(4,0,0),direction=new Vector3(-1,0,0)
    expect(blockedByEarth(camera,direction,2.9)).toBe(false);expect(blockedByEarth(camera,direction,5.1)).toBe(true)
    const pose=cameraPose(1);expect(blockedByEarth(pose.position,observerNormal(OBSERVER.latitude,OBSERVER.longitude))).toBe(false)
  })
  it('advances a reversible bounded clock without wrapping or leaking negative elapsed time',()=>{
    expect(advanceStudy(500,10,10,0,1000)).toBe(600);expect(advanceStudy(600,10,-10,0,1000)).toBe(500);expect(advanceStudy(990,10,10,0,1000)).toBe(1000);expect(advanceStudy(10,10,-10,0,1000)).toBe(0);expect(advanceStudy(500,-10,10,0,1000)).toBe(500)
  })
})
