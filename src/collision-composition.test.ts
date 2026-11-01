import {expect,it} from 'vitest'
import {experiment,SAMPLES_PER_FAMILY,RADIUS} from './collision-model'
import {cloudFrame,composition,world} from './collision-composition'
const run=experiment(60)
function cloud(time:number){return cloudFrame(run.samples.slice(0,SAMPLES_PER_FAMILY).map(s=>world(s.orbit.at(time).position)),time)}
it('keeps the young cloud centred at its actual position and reveals Earth only after ten minutes',()=>{
  for(const t of [0,.1,5,60,300,600]){
    const frame=cloud(t),pose=composition(t,frame,1)
    expect(pose.target.distanceTo(frame.centre)).toBeLessThan(1e-12)
    expect(pose.reveal).toBe(0)
    expect(pose.position.distanceTo(pose.target)).toBeGreaterThan(frame.extent*3)
    expect(pose.position.length()).toBeGreaterThan(1.03)
  }
  expect(cloud(60).extent*RADIUS).toBeGreaterThan(3)
  expect(composition(2400,cloud(2400),1).target.length()).toBe(0)
  const followed=composition(2400,cloud(2400),1,true)
  expect(followed.target.distanceTo(cloud(2400).centre)).toBeLessThan(1e-12)
  expect(followed.reveal).toBe(0)
})
it('joins both camera stages continuously and preserves the physical framing across aspect ratios',()=>{
  for(const t of [0,5,600,2400]){
    const a=composition(t-.000001,cloud(Math.max(0,t-.000001)),1),b=composition(t+.000001,cloud(t+.000001),1)
    expect(a.position.distanceTo(b.position)*RADIUS).toBeLessThan(.001)
    expect(a.target.distanceTo(b.target)*RADIUS).toBeLessThan(.001)
    expect(a.up.distanceTo(b.up)).toBeLessThan(.001)
  }
  const narrow=composition(60,cloud(60),.5),wide=composition(60,cloud(60),2)
  expect(narrow.position.distanceTo(narrow.target)/wide.position.distanceTo(wide.target)).toBeCloseTo(2)
  expect(narrow.target.distanceTo(wide.target)).toBe(0)
  expect(wide.up.dot(cloud(60).radial)).toBeGreaterThan(.8)
})
