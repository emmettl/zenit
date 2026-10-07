import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {Vector3} from 'three'
import {sgp4} from 'satellite.js'
import reference from './cohorts-reference.json'
import {createPopulation,enabledMover,populationFrame,readCohorts} from './cohorts'
import {orbitalState} from './orbital'
const manifest=JSON.parse(readFileSync('public/data/zenit-manifest.json','utf8')),raw=JSON.parse(readFileSync('public/data/'+manifest.evidence.orbital.file,'utf8')),snapshot=readCohorts(raw),population=createPopulation(snapshot),initial=Date.parse(snapshot.study.initialUtc)
describe('bounded orbital population',()=>{
  it('reconciles distinct identities, overlapping memberships, attachments and excluded records',()=>{
    expect(snapshot.statistics).toMatchObject({inputRows:762,distinctIdentities:716,duplicateMembershipRows:46,independentMovers:635,initialEligibleMovers:616,attachments:12,excludedIndependentIdentities:69})
    expect(snapshot.movers.filter(x=>x.groups.length>1)).toHaveLength(39)
    expect(snapshot.attachments.filter(x=>x.parentId==='25544')).toHaveLength(8)
    expect(snapshot.attachments.every(x=>!snapshot.movers.some(m=>m.id===x.id)&&snapshot.movers.some(m=>m.id===x.parentId))).toBe(true)
    expect(snapshot.exclusionLedger.filter(x=>x.reason!=='attachment')).toHaveLength(69)
  })
  it('matches independent C++ reference vectors for actual station, navigation and deep-space records',()=>{
    for(const item of reference.records){const index=snapshot.movers.findIndex(x=>x.id===item.id),baseline=population.propagators[index].baseline;for(const c of item.cases){const actual=sgp4({...baseline},c.minutesSinceEpoch)!;expect(new Vector3(actual.position.x,actual.position.y,actual.position.z).distanceTo(new Vector3(...c.positionKm))).toBeLessThan(.0001);expect(new Vector3(actual.velocity.x,actual.velocity.y,actual.velocity.z).distanceTo(new Vector3(...c.velocityKmPerSecond))).toBeLessThan(1e-7)}}
  })
  it('preserves true group membership when isolating overlapping families',()=>{
    const shared=snapshot.movers.find(x=>x.groups.includes('gnss')&&x.groups.includes('geo'))!
    expect(enabledMover(shared,['gnss'])).toBe(true);expect(enabledMover(shared,['geo'])).toBe(true);expect(enabledMover(shared,[])).toBe(false)
    const selected=new Set(snapshot.movers.filter(x=>enabledMover(x,['gnss','geo'])).map(x=>x.id));expect(selected.size).toBe(624)
  })
  it('returns direct timestamped deterministic states with dynamic age eligibility',()=>{
    const frame=populationFrame(population,initial,7)
    expect(frame.revision).toBe(7);expect(frame.time).toBe(initial);expect(Array.from(frame.availability).filter(x=>x===1)).toHaveLength(616)
    const index=snapshot.movers.findIndex(x=>x.id==='25544'),direct=orbitalState(population.propagators[index],initial)!
    expect(new Vector3().fromArray(frame.positions,index*3).distanceTo(direct.world)).toBeLessThan(1e-12)
    populationFrame(population,Date.parse(snapshot.study.endUtc));populationFrame(population,Date.parse(snapshot.study.startUtc));const repeated=populationFrame(population,initial,7)
    expect(repeated.positions).toEqual(frame.positions);expect(repeated.availability).toEqual(frame.availability)
    const partial=population.propagators.findIndex(x=>x.end<Date.parse(snapshot.study.endUtc));expect(populationFrame(population,population.propagators[partial].end).availability[partial]).toBe(1);expect(populationFrame(population,population.propagators[partial].end+1).availability[partial]).toBe(0)
    expect(()=>populationFrame(population,NaN)).toThrow();expect(()=>populationFrame(population,Date.parse(snapshot.study.startUtc)-1)).toThrow()
  })
  it('rejects conflicting frames, duplicate movers, broken attachments and unreconciled counts',()=>{
    for(const mutate of [(r:typeof raw)=>{r.movers[1].id=r.movers[0].id},(r:typeof raw)=>{r.movers[0].element.REF_FRAME='J2000'},(r:typeof raw)=>{r.attachments[0].parentId='999999999'},(r:typeof raw)=>{r.statistics.distinctIdentities=715},(r:typeof raw)=>{r.movers[0].eligibleStartUtc='2026-10-01T00:00:00Z'}]){const r=structuredClone(raw);mutate(r);expect(()=>readCohorts(r)).toThrow()}
  })
})
