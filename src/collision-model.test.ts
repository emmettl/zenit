import {describe,it,expect} from 'vitest'
import {Orbit,PARENTS,PERIOD,MU,RADIUS,END,START,SEED,experiment,add,scale,dot,norm,guidedTime,guidedCue,cloudHistory,type Vec3} from './collision-model'
const difference=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]))
describe('synthetic encounter physics',()=>{
  it('meets at a single point from perpendicular circular paths and closes each orbit',()=>{
    expect(difference(PARENTS[0].at(0).position,PARENTS[1].at(0).position)).toBe(0)
    expect(dot(PARENTS[0].at(0).velocity,PARENTS[1].at(0).velocity)).toBeCloseTo(0,12)
    expect(difference(PARENTS[0].at(START).position,PARENTS[1].at(START).position)).toBeGreaterThan(300)
    for(const parent of PARENTS){expect(difference(parent.at(PERIOD).position,parent.initial.position)).toBeLessThan(1e-8);expect(norm(parent.at(PERIOD/4).position)).toBeCloseTo(RADIUS+800,8)}
  })
  it('replays the same directions at every spread, conserving equal-weight momentum without creating kinetic energy',()=>{
    expect(SEED).toBe(0x5a454e49)
    const slow=experiment(10),fast=experiment(100)
    expect(experiment(10)).toEqual(slow)
    const incoming=scale(add(PARENTS[0].initial.velocity,PARENTS[1].initial.velocity),.5)
    const before=PARENTS.reduce((sum,p)=>sum+dot(p.initial.velocity,p.initial.velocity),0)/2
    for(const run of [slow,fast]){
      expect(run.samples).toHaveLength(768)
      const outgoing=scale(run.samples.reduce<Vec3>((sum,s)=>add(sum,s.orbit.initial.velocity),[0,0,0]),1/run.samples.length)
      expect(difference(incoming,outgoing)).toBeLessThan(1e-12)
      const after=run.samples.reduce((sum,s)=>sum+dot(s.orbit.initial.velocity,s.orbit.initial.velocity),0)/run.samples.length
      expect(after).toBeLessThan(before)
      for(const s of run.samples){expect(s.orbit.initial.position).toEqual(PARENTS[0].initial.position);expect(s.orbit.perigee).toBeGreaterThan(300);expect(norm(s.kick)*1000).toBeLessThanOrEqual(run.spread)}
      const radii=run.samples.map(s=>norm(s.kick)*1000/run.spread)
      expect(radii.filter(r=>r<.5).length/radii.length).toBeGreaterThan(.08)
      expect(radii.filter(r=>r<.5).length/radii.length).toBeLessThan(.18)
      expect(Math.min(...radii)).toBeLessThan(.2)
    }
    fast.samples.forEach((s,i)=>expect(difference(s.kick,scale(slow.samples[i].kick,10))).toBeLessThan(1e-15))
    expect(fast.periods[0][1]-fast.periods[0][0]).toBeGreaterThan(slow.periods[0][1]-slow.periods[0][0])
  })
  it('conserves orbital energy and angular momentum across direct seeks and reversed propagation',()=>{
    for(const sample of experiment(100).samples){
      const initial=sample.orbit.initial,energy=dot(initial.velocity,initial.velocity)/2-MU/norm(initial.position)
      const angular=(s:typeof initial)=>dot(s.position,s.position)*dot(s.velocity,s.velocity)-dot(s.position,s.velocity)**2
      for(const t of [1,600,PERIOD,END,-PERIOD]){const state=sample.orbit.at(t);expect(Math.abs((dot(state.velocity,state.velocity)/2-MU/norm(state.position))-energy)).toBeLessThan(1e-10);expect(angular(state)/angular(initial)).toBeCloseTo(1,12)}
      const later=sample.orbit.at(END),back=new Orbit(later).at(-END)
      expect(difference(back.position,initial.position)).toBeLessThan(1e-6)
    }
    expect(()=>experiment(NaN)).toThrow();expect(()=>experiment(101)).toThrow();expect(()=>new Orbit({position:[1,0,0],velocity:[1,0,0]})).toThrow()
  })
  it('separates authored pacing from physical time and holds contact before release',()=>{
    expect(guidedTime(-1)).toBe(START);expect(guidedTime(12.25)).toBe(0);expect(guidedTime(100)).toBe(END)
    for(const t of [START,-1,0,1,600,PERIOD,END])expect(guidedTime(guidedCue(t))).toBeCloseTo(t,9)
  })
  it('agrees with an independent Cartesian RK4 integration through three orbits',()=>{
    const orbit=experiment(100).samples[17].orbit,initial=orbit.initial
    let state=[...initial.position,...initial.velocity]
    const derivative=(s:number[])=>{const r=Math.hypot(...s.slice(0,3)),f=-MU/r**3;return[s[3],s[4],s[5],f*s[0],f*s[1],f*s[2]]}
    const shifted=(s:number[],k:number[],h:number)=>s.map((v,i)=>v+k[i]*h)
    const count=Math.ceil(END/2),h=END/count
    for(let i=0;i<count;i++){
      const a=derivative(state),b=derivative(shifted(state,a,h/2)),c=derivative(shifted(state,b,h/2)),d=derivative(shifted(state,c,h))
      state=state.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6)
    }
    const analytic=orbit.at(END)
    expect(difference(state.slice(0,3),analytic.position)).toBeLessThan(.0001)
    expect(difference(state.slice(3),analytic.velocity)).toBeLessThan(.000001)
  })
  it('makes short histories relative to the moving release orbit and joins exact current tips',()=>{
    const run=experiment(60),s=run.samples[39],centre=run.centres[0],t=60,past=50
    expect(difference(cloudHistory(s,centre,t,t),s.orbit.at(t).position)).toBeLessThan(1e-10)
    const tail=cloudHistory(s,centre,t,past)
    expect(difference(tail,s.orbit.at(t).position)).toBeLessThan(1)
    expect(difference(s.orbit.at(past).position,s.orbit.at(t).position)).toBeGreaterThan(70)
  })
})
