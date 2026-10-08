import {describe,it,expect} from 'vitest'
import {journeySample,JOURNEY_DURATION} from './journey'
import {cameraPose,ARRIVAL,LOOK_UP} from './camera'
const initial=Date.parse('2026-10-07T17:57:19Z'),start=Date.parse('2026-10-07T11:58:49Z'),end=Date.parse('2026-10-07T23:58:49Z')
const sample=(t:number)=>journeySample(t,initial,start,end)
describe('dated cinematic journey',()=>{
  it('covers the retained peak with a held descent clock and a 10x sky clock',()=>{
    expect(sample(8000+12000*ARRIVAL).time).toBe(initial)
    expect(sample(8000+12000*LOOK_UP).time).toBe(initial)
    expect(sample(20000+9000).time).toBe(Date.parse('2026-10-07T17:58:49Z'))
    expect(sample(29000).progress).toBe(1)
    expect(sample(48000).time).toBe(initial+280000)
    expect(sample(59000).time).toBe(initial+280000)
  })
  it('stays inside dated bounds including narrowed windows',()=>{
    for(let t=0;t<180000;t+=73){const frame=sample(t);expect(frame.time).toBeGreaterThanOrEqual(start);expect(frame.time).toBeLessThanOrEqual(end);expect(frame.progress).toBeGreaterThanOrEqual(0);expect(frame.progress).toBeLessThanOrEqual(1)}
    for(let t=0;t<60000;t+=101){const frame=journeySample(t,initial,initial-1000,initial+1000);expect(frame.time).toBeGreaterThanOrEqual(initial-1000);expect(frame.time).toBeLessThanOrEqual(initial+1000)}
  })
  it('keeps camera and date continuous at each interior phase boundary',()=>{
    for(const t of [8000,20000,48000]){const before=sample(t-.001),after=sample(t+.001);expect(Math.abs(before.time-after.time)).toBeLessThan(1);expect(cameraPose(before.progress).position.distanceTo(cameraPose(after.progress).position)).toBeLessThan(1e-6);expect(cameraPose(before.progress).rotation.angleTo(cameraPose(after.progress).rotation)).toBeLessThan(1e-6)}
  })
  it('conceals the dated repeat at a black orbital seam, with overshoot preserved',()=>{
    expect(sample(0).opacity).toBe(0);expect(sample(JOURNEY_DURATION-.001).opacity).toBeLessThan(1e-10)
    expect(sample(1000).opacity).toBe(1);expect(sample(59000).opacity).toBe(1)
    expect(sample(JOURNEY_DURATION+321)).toEqual(sample(321));expect(sample(JOURNEY_DURATION*5+321)).toEqual(sample(321))
    expect(cameraPose(sample(0).progress).position.distanceTo(cameraPose(sample(60000-.001).progress).position)).toBeLessThan(1e-6)
  })
})
