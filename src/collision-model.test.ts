import {describe,it,expect} from 'vitest'
import {Orbit,PARENTS,PERIOD,MU,RADIUS,END,START,SEED,experiment,add,scale,dot,norm,guidedTime,guidedCue,cloudHistory,alive,SECONDARY_TIME,SECONDARY_SAMPLES,J2,cross,type Vec3} from './collision-model'
const difference=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]))
describe('synthetic encounter physics',()=>{
  it('meets at a single point from event-informed circular paths and closes each orbit',()=>{
    expect(difference(PARENTS[0].at(0).position,PARENTS[1].at(0).position)).toBe(0)
    expect(PARENTS[0].inclination*180/Math.PI).toBeCloseTo(86.4,10);expect(PARENTS[1].inclination*180/Math.PI).toBeCloseTo(74,10)
    expect(difference(PARENTS[0].at(START).position,PARENTS[1].at(START).position)).toBeGreaterThan(300)
    for(const parent of PARENTS){expect(difference(parent.at(PERIOD).position,parent.initial.position)).toBeLessThan(1e-8);expect(norm(parent.at(PERIOD/4).position)).toBeCloseTo(RADIUS+800,8)}
  })
  it('replays the same directions at every spread, conserving equal-weight momentum without creating kinetic energy',()=>{
    expect(SEED).toBe(0x5a454e49)
    const slow=experiment(50,false),fast=experiment(1500,false)
    expect(experiment(50,false)).toEqual(slow)
    const incoming=scale(add(PARENTS[0].initial.velocity,PARENTS[1].initial.velocity),.5)
    const before=PARENTS.reduce((sum,p)=>sum+dot(p.initial.velocity,p.initial.velocity),0)/2
    for(const run of [slow,fast]){
      expect(run.samples).toHaveLength(768)
      const outgoing=scale(run.samples.reduce<Vec3>((sum,s)=>add(sum,s.orbit.initial.velocity),[0,0,0]),1/run.samples.length)
      expect(difference(incoming,outgoing)).toBeLessThan(1e-12)
      const after=run.samples.reduce((sum,s)=>sum+dot(s.orbit.initial.velocity,s.orbit.initial.velocity),0)/run.samples.length
      expect(after).toBeLessThan(before)
      for(const s of run.samples){expect(s.orbit.initial.position).toEqual(PARENTS[0].initial.position);expect(Number.isFinite(s.orbit.perigee)).toBe(true);expect(norm(s.kick)*1000).toBeLessThanOrEqual(run.spread)}
      const radii=run.samples.map(s=>norm(s.kick)*1000/run.spread)
      expect(radii.filter(r=>r<.5).length/radii.length).toBeGreaterThan(.08)
      expect(radii.filter(r=>r<.5).length/radii.length).toBeLessThan(.18)
      expect(Math.min(...radii)).toBeLessThan(.2)
    }
    fast.samples.forEach((s,i)=>expect(difference(s.kick,scale(slow.samples[i].kick,30))).toBeLessThan(1e-15))
    expect(fast.periods[0][1]-fast.periods[0][0]).toBeGreaterThan(slow.periods[0][1]-slow.periods[0][0])
  })
  it('conserves orbital energy and angular momentum across direct seeks and reversed propagation',()=>{
    for(const sample of experiment(1500,false).samples){
      const initial=sample.orbit.initial,energy=dot(initial.velocity,initial.velocity)/2-MU/norm(initial.position)
      const angular=(s:typeof initial)=>dot(s.position,s.position)*dot(s.velocity,s.velocity)-dot(s.position,s.velocity)**2
      for(const t of [1,600,PERIOD,END,-PERIOD]){const state=sample.orbit.at(t);expect(Math.abs((dot(state.velocity,state.velocity)/2-MU/norm(state.position))-energy)).toBeLessThan(1e-10);expect(angular(state)/angular(initial)).toBeCloseTo(1,12)}
      const later=sample.orbit.at(END),back=new Orbit(later).at(-END)
      expect(difference(back.position,initial.position)).toBeLessThan(1e-6)
    }
    expect(()=>experiment(NaN)).toThrow();expect(()=>experiment(1501)).toThrow();expect(()=>new Orbit({position:[1,0,0],velocity:[1,0,0]})).toThrow()
  })
  it('separates authored pacing from physical time and keeps moving through contact',()=>{
    expect(guidedTime(-1)).toBe(START);expect(guidedTime(12)).toBe(0);expect(guidedTime(12.25)).toBeGreaterThan(0);expect(guidedTime(200)).toBe(END)
    for(const t of [START,-1,0,1,600,PERIOD,100*PERIOD,END])expect(guidedTime(guidedCue(t))).toBeCloseTo(t,7)
  })
  it('agrees with an independent Cartesian RK4 integration through three orbits',()=>{
    const orbit=experiment(1500,false).samples[17].orbit,initial=orbit.initial,duration=3*PERIOD
    let state=[...initial.position,...initial.velocity]
    const derivative=(s:number[])=>{const r=Math.hypot(...s.slice(0,3)),f=-MU/r**3;return[s[3],s[4],s[5],f*s[0],f*s[1],f*s[2]]}
    const shifted=(s:number[],k:number[],h:number)=>s.map((v,i)=>v+k[i]*h)
    const count=Math.ceil(duration/2),h=duration/count
    for(let i=0;i<count;i++){
      const a=derivative(state),b=derivative(shifted(state,a,h/2)),c=derivative(shifted(state,b,h/2)),d=derivative(shifted(state,c,h))
      state=state.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6)
    }
    const analytic=orbit.at(duration)
    expect(difference(state.slice(0,3),analytic.position)).toBeLessThan(.0001)
    expect(difference(state.slice(3),analytic.velocity)).toBeLessThan(.000001)
  })
  it('makes short histories relative to the moving release orbit and joins exact current tips',()=>{
    const run=experiment(600,false),s=run.samples[39],centre=run.centres[0],t=60,past=50
    expect(difference(cloudHistory(s,centre,t,t),s.orbit.at(t).position)).toBeLessThan(1e-10)
    const tail=cloudHistory(s,centre,t,past)
    expect(difference(tail,s.orbit.at(t).position)).toBeLessThan(10)
    expect(difference(s.orbit.at(past).position,s.orbit.at(t).position)).toBeGreaterThan(60)
  })
})

describe('long-clock dynamics and secondary release',()=>{
  it('turns orbital planes at the first-order J2 rate, with a switchable two-body reference',()=>{
    const radius=RADIUS+700,v=Math.sqrt(MU/radius),angle=98*Math.PI/180,initial={position:[radius,0,0] as Vec3,velocity:[0,v*Math.cos(angle),v*Math.sin(angle)] as Vec3}
    const j2=new Orbit(initial,true),plain=new Orbit(initial)
    expect(j2.nodeRate*86400*180/Math.PI).toBeCloseTo(.963,2)
    expect(plain.nodeRate).toBe(0);expect(plain.apsisRate).toBe(0)
    const a=j2.at(END).position,b=plain.at(END).position
    expect(difference(a,b)).toBeGreaterThan(1000)
    expect(norm(a)).toBeCloseTo(radius,7)
  })
  it('removes atmosphere-crossing samples at their first radial crossing and reverses deterministically',()=>{
    const run=experiment(1500),falling=run.samples.filter(s=>Number.isFinite(s.orbit.entryTime))
    expect(falling.length).toBeGreaterThan(100)
    for(const s of falling){const t=s.orbit.entryTime;expect(norm(s.orbit.at(t).position)-RADIUS).toBeCloseTo(120,6);expect(alive(s,t-.01)).toBe(true);expect(alive(s,t+.01)).toBe(false)}
    expect(run.samples.filter(s=>alive(s,END)).length).toBeLessThan(600)
    expect(run.samples.filter(s=>alive(s,0))).toHaveLength(768)
    expect(Math.max(...run.samples.map(s=>s.orbit.apogee))).toBeGreaterThan(8000)
  })
  it('releases a secondary family at an actual prescribed intersection, with conserved mass-weighted momentum and bounded energy',()=>{
    for(const spread of [50,600,1500]){
      const run=experiment(spread,true,true),event=run.secondary!,source=run.samples[event.sourceIndex],state=source.orbit.at(event.time),target=event.target.at(0),children=run.samples.filter(s=>s.family===2)
      expect(difference(state.position,target.position)).toBe(0);expect(event.time).toBe(SECONDARY_TIME);expect(children).toHaveLength(SECONDARY_SAMPLES)
      expect(difference(source.orbit.at(event.time-1).position,event.target.at(-1).position)).toBeGreaterThan(10)
      expect(alive(source,event.time-.01)).toBe(true);expect(alive(source,event.time)).toBe(false)
      const incoming=add(scale(state.velocity,event.projectileMass),scale(target.velocity,event.targetMass)),mass=event.projectileMass+event.targetMass
      const mean=scale(children.reduce<Vec3>((sum,s)=>add(sum,s.orbit.initial.velocity),[0,0,0]),1/children.length)
      expect(difference(scale(mean,mass),incoming)).toBeLessThan(1e-8)
      const kickEnergy=children.reduce((sum,s)=>sum+dot(s.kick,s.kick)*.5*mass/children.length,0)
      expect(kickEnergy).toBeLessThan(event.availableEnergy);expect(event.specificEnergy).toBeGreaterThan(40)
      expect(children.every(s=>!alive(s,event.time-.01)&&alive(s,event.time))).toBe(true)
    }
  })
  it('slows the secondary encounter independently of the primary clock and reaches 500 orbits',()=>{
    expect(END/PERIOD).toBeCloseTo(500,10);expect(guidedTime(87,true)).toBe(SECONDARY_TIME);expect(guidedTime(87.25,true)).toBeGreaterThan(SECONDARY_TIME)
    for(const t of [0,60,10*PERIOD,SECONDARY_TIME-1,SECONDARY_TIME,SECONDARY_TIME+10,END])expect(guidedTime(guidedCue(t,true),true)).toBeCloseTo(t,6)
  })
  it('has positive, continuous playback speed around both impacts and every pace change',()=>{
    for(const secondary of [false,true]){
      const joins=secondary?[4,7,12,19,29,39,48,60,76,78,82,87,94,104,114,123,143]:[4,7,12,19,29,39,48,60,78,105]
      for(const cue of joins){
        const dt=.00001,left=(guidedTime(cue,secondary)-guidedTime(cue-dt,secondary))/dt,right=(guidedTime(cue+dt,secondary)-guidedTime(cue,secondary))/dt
        expect(left).toBeGreaterThan(0);expect(right).toBeGreaterThan(0)
        expect(Math.abs(left-right)/Math.max(left,right)).toBeLessThan(.01)
      }
      for(const cue of secondary?[12,87]:[12]){
        let previous=guidedTime(cue-.75,secondary)
        for(let frame=1;frame<=90;frame++){const next=guidedTime(cue-.75+frame/60,secondary);expect(next).toBeGreaterThan(previous);previous=next}
      }
    }
  })
  it('agrees with an independent Cartesian J2 integration on nodal drift over five days',()=>{
    const radius=RADIUS+800,v=Math.sqrt(MU/radius),inc=55*Math.PI/180,initial={position:[radius,0,0] as Vec3,velocity:[0,v*Math.cos(inc),v*Math.sin(inc)] as Vec3},orbit=new Orbit(initial,true)
    let state=[...initial.position,...initial.velocity]
    const derivative=(s:number[])=>{const [x,y,z]=s,r=Math.hypot(x,y,z),u=z*z/(r*r),c=1.5*J2*(RADIUS/r)**2,f=-MU/r**3;return[s[3],s[4],s[5],f*x*(1+c*(1-5*u)),f*y*(1+c*(1-5*u)),f*z*(1+c*(3-5*u))]}
    const shifted=(s:number[],k:number[],h:number)=>s.map((v,i)=>v+k[i]*h),h=10,duration=5*86400
    for(let i=0;i<duration/h;i++){const a=derivative(state),b=derivative(shifted(state,a,h/2)),c=derivative(shifted(state,b,h/2)),d=derivative(shifted(state,c,h));state=state.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6)}
    const normal=cross(state.slice(0,3) as unknown as Vec3,state.slice(3) as unknown as Vec3),node=Math.atan2(normal[0],-normal[1])
    expect(Math.abs(node-orbit.nodeRate*duration)).toBeLessThan(.01)
  })
})
