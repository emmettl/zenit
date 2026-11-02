import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {Vector3} from 'three'
import {gstime} from 'satellite.js'
import index from './constellation-release.json'
import {readConstellation,constellationOrbits,constellationState,featuredPlane} from './constellation'
import {constellationReveal,constellationPose,orientationCircle,REVEAL_DURATION} from './constellation-composition'
const bytes=readFileSync('public/'+index.file.slice(2)),release=readConstellation(JSON.parse(bytes.toString())),orbits=constellationOrbits(release),start=Date.parse(release.study.startUtc),end=Date.parse(release.study.endUtc)
describe('dated constellation proof',()=>{
 it('reconciles the complete retained source population and pinned independent numerical agreement',()=>{
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(index.sha256)
  const audit=JSON.parse(readFileSync('docs/evidence/constellation-proof-2026-11-02.json','utf8'))
  expect(audit.validation.independentAgreement).toMatchObject({passed:true,payloadSha256:index.sha256,identities:647,samples:1941})
  expect(release.statistics).toMatchObject({inputRows:651,retainedIdentities:647,excludedIdentities:4,capExclusions:0,initialEligible:647,endEligible:643})
  expect(new Set(orbits.map(o=>o.mover.id)).size).toBe(647)
 })
 it('rejects changed frames, duplicate identities and fabricated age intervals',()=>{
  for(const change of [(r:typeof release)=>{Object.assign(r.movers[0].element,{REF_FRAME:'J2000'})},(r:typeof release)=>{r.movers[1]=r.movers[0]},(r:typeof release)=>{r.movers[0].eligibleEndUtc=release.study.startUtc},(r:typeof release)=>{r.model.gravity='WGS84'},(r:typeof release)=>{r.movers[0].element.INCLINATION=NaN}]){const copy=structuredClone(release);change(copy);expect(()=>readConstellation(copy)).toThrow()}
 })
 it('keeps direct seeks deterministic and removes identities at their actual eligibility bounds',()=>{
  for(const o of orbits){const time=Math.min(end,o.end),a=constellationState(o,time)!,gmst=gstime(new Date(time));constellationState(o,start+600000);const b=constellationState(o,time,gmst)!
   expect(b.world.toArray()).toEqual(a.world.toArray());expect(b.normal.length()).toBeCloseTo(1,12);expect(constellationState(o,o.end+1)).toBeNull();expect(constellationState(o,o.start-1)).toBeNull()
  }
  expect(orbits.filter(o=>constellationState(o,start))).toHaveLength(647);expect(orbits.filter(o=>constellationState(o,end))).toHaveLength(643)
 })
 it('selects one reproducible measured plane neighbourhood, independent of catalogue order',()=>{
  const plane=featuredPlane(orbits,start),reverse=[...orbits].reverse(),other=featuredPlane(reverse,start)
  const featured=JSON.parse(readFileSync('docs/evidence/constellation-proof-2026-11-02.json','utf8')).presentation.featured
  expect(orbits[plane.lead].mover.id).toBe(featured.id);expect(plane.members.map(i=>orbits[i].mover.id)).toEqual(featured.memberIds)
  expect(orbits[plane.lead].mover.id).toBe(reverse[other.lead].mover.id);expect(plane.members.length).toBeGreaterThan(40);expect(plane.members.length).toBeLessThan(80)
  expect(new Set(plane.members.map(i=>orbits[i].mover.id))).toEqual(new Set(other.members.map(i=>reverse[i].mover.id)))
  const lead=constellationState(orbits[plane.lead],start)!.normal
  for(const i of plane.members)expect(constellationState(orbits[i],start)!.normal.angleTo(lead)).toBeLessThanOrEqual(Math.PI/180)
 })
})
describe('constellation composition',()=>{
 it('reveals one record, one plane, then the whole snapshot without moving catalogue positions',()=>{
  expect(constellationReveal(0)).toMatchObject({plane:0,whole:0,stage:0});expect(constellationReveal(19)).toMatchObject({plane:1,whole:0,stage:1});expect(constellationReveal(REVEAL_DURATION)).toMatchObject({plane:1,whole:1,stage:2,complete:true})
  for(let t=0;t<42;t+=.1){const a=constellationReveal(t),b=constellationReveal(t+.1);expect(b.plane).toBeGreaterThanOrEqual(a.plane);expect(b.whole).toBeGreaterThanOrEqual(a.whole)}
 })
 it('keeps the authored camera continuous, above Earth and usable in both phone orientations',()=>{
  for(const aspect of [.48,1,2.6]){let previous:Vector3|null=null
   for(let cue=0;cue<=42;cue+=.01){const position=new Vector3(0,.5,1.07),normal=new Vector3(1,0,0),pose=constellationPose(cue,position,normal,new Vector3(2,1,3),aspect)
    expect(pose.position.length()).toBeGreaterThanOrEqual(1.04);expect(pose.up.length()).toBeCloseTo(1,12);if(previous)expect(pose.position.distanceTo(previous)).toBeLessThan(.02);previous=pose.position
   }
  }
 })
 it('keeps every orientation-guide point on its measured plane and radius',()=>{
  const p=new Vector3(0,.5,1.07),n=new Vector3(1,0,0),points=orientationCircle(p,n)
  expect(points[0].distanceTo(p)).toBeLessThan(1e-12);expect(points[0].distanceTo(points.at(-1)!)).toBeLessThan(1e-12)
  for(const point of points){expect(point.dot(n)).toBeCloseTo(0,12);expect(point.length()).toBeCloseTo(p.length(),12)}
 })
})
