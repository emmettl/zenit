// Edition-owned synthetic experiment. No TLEs, catalogue identities or event fit.
export type Vec3 = readonly [number, number, number]
export interface State {position: Vec3; velocity: Vec3}
export const MU = 398600.4418 // km³/s², conventional Earth GM
export const RADIUS = 6378.137 // km; spherical reference height, not WGS84 altitude
export const RELEASE_HEIGHT = 800
export const RELEASE_LATITUDE = 72.5
export const INCLINATIONS = [86.4,74] as const
export const SEED = 0x5a454e49
export const SAMPLES_PER_FAMILY = 384
export const SECONDARY_SAMPLES = 256
export const RETENTION = .97 // energy remains dissipative throughout the wider release range
export const J2 = 1.08262668e-3
export const ENTRY_HEIGHT = 120 // prescribed atmospheric-entry boundary; not a drag/lifetime model
export const START = -30
export const add = (a:Vec3,b:Vec3):Vec3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]]
export const scale = (a:Vec3,s:number):Vec3 => [a[0]*s,a[1]*s,a[2]*s]
export const dot = (a:Vec3,b:Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
export const norm = (a:Vec3) => Math.sqrt(dot(a,a))
export const cross = (a:Vec3,b:Vec3):Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const rotate=(v:Vec3,axis:Vec3,angle:number):Vec3=>add(add(scale(v,Math.cos(angle)),scale(cross(axis,v),Math.sin(angle))),scale(axis,dot(axis,v)*(1-Math.cos(angle))))

/** Bound elliptic orbit, with an optional first-order mean-element J2 approximation.
 * Kepler's equation and secular basis rotations are evaluated directly on every seek.
 * The release state is exact at t=0; short-period osculating/mean corrections are omitted.
 */
export class Orbit {
  readonly a:number
  readonly e:number
  readonly period:number
  readonly perigee:number
  readonly apogee:number
  readonly inclination:number
  readonly nodeRate:number
  readonly apsisRate:number
  readonly meanRate:number
  readonly entryTime:number
  private readonly normal:Vec3
  private readonly p:Vec3
  private readonly q:Vec3
  private readonly m0:number
  readonly initial:State
  readonly j2:boolean
  constructor(initial:State,j2=false) {
    this.initial=initial
    this.j2=j2
    const {position:r,velocity:v}=initial, radius=norm(r), h=cross(r,v)
    if (![...r,...v].every(Number.isFinite)||radius===0||norm(h)<1e-9) throw new Error('Non-radial finite state required')
    const eccentric=add(scale(cross(v,h),1/MU),scale(r,-1/radius))
    this.a=1/(2/radius-dot(v,v)/MU)
    this.e=norm(eccentric)<1e-12?0:norm(eccentric)
    if(this.a<=0||this.e>=1)throw new Error('Bound elliptic state required')
    this.p=this.e===0?scale(r,1/radius):scale(eccentric,1/this.e)
    this.normal=scale(h,1/norm(h));this.q=cross(this.normal,this.p)
    const e0=Math.atan2(dot(r,this.q)/(this.a*Math.sqrt(1-this.e*this.e)),dot(r,this.p)/this.a+this.e)
    this.m0=e0-this.e*Math.sin(e0)
    this.period=2*Math.PI*Math.sqrt(this.a**3/MU)
    this.perigee=this.a*(1-this.e)-RADIUS
    this.apogee=this.a*(1+this.e)-RADIUS
    this.inclination=Math.acos(this.normal[2])
    const n=2*Math.PI/this.period,c=Math.cos(this.inclination),factor=J2*(RADIUS/(this.a*(1-this.e*this.e)))**2
    this.nodeRate=j2?-1.5*n*factor*c:0
    this.apsisRate=j2?.75*n*factor*(5*c*c-1):0
    this.meanRate=n*(1+(j2?.75*factor*Math.sqrt(1-this.e*this.e)*(3*c*c-1):0))
    if(this.perigee<ENTRY_HEIGHT&&this.e>0){
      const crossing=2*Math.PI-Math.acos(Math.max(-1,Math.min(1,(1-(RADIUS+ENTRY_HEIGHT)/this.a)/this.e)))
      this.entryTime=((crossing-this.e*Math.sin(crossing)-this.m0)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)/this.meanRate
    }else this.entryTime=Infinity
  }
  at(seconds:number):State {
    if(!Number.isFinite(seconds))throw new Error('Finite elapsed time required')
    if(seconds===0)return this.initial
    const raw=this.m0+seconds*this.meanRate, m=Math.atan2(Math.sin(raw),Math.cos(raw))
    let e=this.e>.8?Math.sign(m||1)*Math.PI:m
    for(let i=0;i<32;i++){const step=(e-this.e*Math.sin(e)-m)/(1-this.e*Math.cos(e));e-=step;if(Math.abs(step)<1e-13)break}
    const c=Math.cos(e),s=Math.sin(e),b=Math.sqrt(1-this.e*this.e)
    const p=rotate(rotate(this.p,this.normal,this.apsisRate*seconds),[0,0,1],this.nodeRate*seconds),q=rotate(rotate(this.q,this.normal,this.apsisRate*seconds),[0,0,1],this.nodeRate*seconds)
    const position=add(scale(p,this.a*(c-this.e)),scale(q,this.a*b*s))
    const factor=this.a*this.a*this.meanRate/norm(position),normal=rotate(this.normal,[0,0,1],this.nodeRate*seconds)
    const velocity=add(add(add(scale(p,-factor*s),scale(q,factor*b*c)),scale(cross(normal,position),this.apsisRate)),scale(cross([0,0,1],position),this.nodeRate))
    return {position,velocity}
  }
}

const radius=RADIUS+RELEASE_HEIGHT,speed=Math.sqrt(MU/radius),latitude=RELEASE_LATITUDE*Math.PI/180
const releasePosition:Vec3=[radius*Math.cos(latitude),0,radius*Math.sin(latitude)],north:Vec3=[-Math.sin(latitude),0,Math.cos(latitude)],east:Vec3=[0,1,0]
// Published event latitude and inclinations inform this idealised circular encounter.
// These are not recovered 2009 satellite states or a fit to the debris catalogue.
export const PARENTS = INCLINATIONS.map((inclination,family)=>{
  const alpha=Math.acos(Math.cos(inclination*Math.PI/180)/Math.cos(latitude))*(family===0?1:-1)
  return new Orbit({position:releasePosition,velocity:scale(add(scale(east,Math.cos(alpha)),scale(north,Math.sin(alpha))),speed)})
})
export const PERIOD = 2*Math.PI*Math.sqrt(radius**3/MU)
export const END = 500*PERIOD
export const SECONDARY_TIME = 100*PERIOD
export const RELATIVE_SPEED = norm(add(PARENTS[0].initial.velocity,scale(PARENTS[1].initial.velocity,-1)))
export interface Sample {family:0|1|2; orbit:Orbit; kick:Vec3; born:number; consumed:number}
export interface Secondary {time:number; sourceIndex:number; target:Orbit; position:Vec3; relativeSpeed:number; specificEnergy:number; projectileMass:number; targetMass:number; kickMaximum:number; availableEnergy:number}
export interface Experiment {spread:number; j2:boolean; samples:Sample[]; centres:Orbit[]; periods:[number,number][]; secondary:Secondary|null}

function random(seed:number){let value=seed;return()=>{value+=0x6d2b79f5;let t=Math.imul(value^value>>>15,1|value);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
export function experiment(spread:number,j2=true,secondary=false):Experiment {
  if(!Number.isFinite(spread)||spread<50||spread>1500)throw new Error('Release speed must be 50–1,500 m/s')
  const rng=random(SEED), com=scale(add(PARENTS[0].initial.velocity,PARENTS[1].initial.velocity),.5),samples:Sample[]=[],centres:Orbit[]=[]
  for(const family of [0,1] as const){
    const mean=add(com,scale(add(PARENTS[family].initial.velocity,scale(com,-1)),RETENTION))
    centres.push(new Orbit({position:releasePosition,velocity:mean},j2))
    for(let i=0;i<SAMPLES_PER_FAMILY/2;i++){
      const z=2*rng()-1,angle=2*Math.PI*rng(),r=Math.sqrt(1-z*z),magnitude=Math.cbrt(rng()),direction:Vec3=[r*Math.cos(angle),r*Math.sin(angle),z]
      for(const sign of [-1,1]){
        // Uniform volume in velocity space: a filled cloud, rather than a shell.
        const kick=scale(direction,sign*magnitude*spread/1000)
        samples.push({family,kick,born:0,consumed:Infinity,orbit:new Orbit({position:releasePosition,velocity:add(mean,kick)},j2)})
      }
    }
  }
  const run:Experiment={spread,j2,samples,centres,secondary:null,periods:[0,1].map(family=>{const periods=samples.filter(s=>s.family===family).map(s=>s.orbit.period);return[Math.min(...periods),Math.max(...periods)]})}
  if(secondary)addSecondary(run)
  return run
}

export function alive(sample:Sample,time:number){return time>=sample.born&&time<sample.consumed&&time<sample.born+sample.orbit.entryTime}
export function sampleAt(sample:Sample,time:number){return sample.orbit.at(time-sample.born)}
function addSecondary(run:Experiment){
  const time=SECONDARY_TIME,sourceIndex=run.samples.findIndex(s=>{
    const h=norm(s.orbit.at(time).position)-RADIUS
    return alive(s,time)&&h>500&&h<1200
  })
  if(sourceIndex<0)throw new Error('No surviving source for the controlled encounter')
  const source=run.samples[sourceIndex],state=source.orbit.at(time),radial=scale(state.position,1/norm(state.position))
  const tangent=add(state.velocity,scale(radial,-dot(state.velocity,radial))),unit=scale(tangent,1/norm(tangent)),normal=cross(radial,unit),angle=130*Math.PI/180
  const targetVelocity=scale(add(scale(unit,Math.cos(angle)),scale(normal,Math.sin(angle))),Math.sqrt(MU/norm(state.position)))
  const target=new Orbit({position:state.position,velocity:targetVelocity},run.j2),projectileMass=1,targetMass=1000,total=projectileMass+targetMass
  const relativeSpeed=norm(add(state.velocity,scale(targetVelocity,-1))),availableEnergy=.5*projectileMass*targetMass/total*relativeSpeed**2
  const mean=scale(add(scale(state.velocity,projectileMass),scale(targetVelocity,targetMass)),1/total)
  const maximum=Math.min(.4,Math.sqrt(2*availableEnergy/total)*.7)
  run.secondary={time,sourceIndex,target,position:state.position,relativeSpeed,specificEnergy:.5*projectileMass*relativeSpeed**2*1000/targetMass,projectileMass,targetMass,kickMaximum:maximum*1000,availableEnergy}
  source.consumed=time;run.centres.push(new Orbit({position:state.position,velocity:mean},run.j2))
  const rng=random(SEED^0x53454332)
  for(let i=0;i<SECONDARY_SAMPLES/2;i++){
    const z=2*rng()-1,phi=2*Math.PI*rng(),r=Math.sqrt(1-z*z),m=Math.cbrt(rng())*maximum
    for(const sign of [-1,1]){const kick:Vec3=[sign*m*r*Math.cos(phi),sign*m*r*Math.sin(phi),sign*m*z]
      run.samples.push({family:2,kick,born:time,consumed:Infinity,orbit:new Orbit({position:state.position,velocity:add(mean,kick)},run.j2)})
    }
  }
}

/** A history in the frame translating with the family's mean release orbit.
 * The tip remains the fragment's exact current inertial position.
 */
export function cloudHistory(sample:Sample,centre:Orbit,time:number,past:number):Vec3 {
  return add(add(sample.orbit.at(past).position,scale(centre.at(past).position,-1)),centre.at(time).position)
}

// Slow the last fraction of a second, then travel with the young cloud.
// Physical elapsed time remains explicit and every seek evaluates the same states.
const OPENING:Array<[number,number]>=[[0,START],[4,-2],[7,-.2],[12,0],[19,5],[29,60],[39,600],[48,3*PERIOD],[60,25*PERIOD]]
const CUES:Array<[number,number]>=[...OPENING,[78,100*PERIOD],[105,250*PERIOD],[145,END]]
const SECONDARY_CUES:Array<[number,number]>=[...OPENING,[76,SECONDARY_TIME-5*PERIOD],[78,SECONDARY_TIME-30],[82,SECONDARY_TIME-.2],[87,SECONDARY_TIME],[94,SECONDARY_TIME+5],[104,SECONDARY_TIME+60],[114,SECONDARY_TIME+600],[123,SECONDARY_TIME+3*PERIOD],[143,250*PERIOD],[183,END]]
function viewingClock(cues:Array<[number,number]>){
  const secants=cues.slice(1).map(([x,y],i)=>(y-cues[i][1])/(x-cues[i][0]))
  // Positive harmonic-mean slopes keep the clock monotone, with continuous speed
  // across each cue. Contact is a moving instant, never a constant-time segment.
  const slopes=cues.map((_,i)=>i===0?secants[0]:i===cues.length-1?secants.at(-1)!:2/(1/secants[i-1]+1/secants[i]))
  return (seconds:number)=>{
    if(seconds<=cues[0][0])return cues[0][1]
    for(let i=1;i<cues.length;i++){
      const [b,tb]=cues[i],[a,ta]=cues[i-1]
      if(seconds<=b){
        const width=b-a,u=(seconds-a)/width,u2=u*u,u3=u2*u
        return ta+(tb-ta)*(3*u2-2*u3)+width*(slopes[i-1]*(u3-2*u2+u)+slopes[i]*(u3-u2))
      }
    }
    return cues.at(-1)![1]
  }
}
const primaryClock=viewingClock(CUES),secondaryClock=viewingClock(SECONDARY_CUES)
export const GUIDED_DURATION=145
export function guidedDuration(secondary=false){return secondary?183:GUIDED_DURATION}
export function guidedTime(cue:number,secondary=false):number {
  return (secondary?secondaryClock:primaryClock)(Math.max(0,Math.min(guidedDuration(secondary),cue)))
}
export function guidedCue(time:number,secondary=false):number {
  const cues=secondary?SECONDARY_CUES:CUES
  const t=Math.max(START,Math.min(END,time))
  for(let i=1;i<cues.length;i++)if(t<=cues[i][1]){
    let lo=cues[i-1][0],hi=cues[i][0]
    if(t===cues[i-1][1])return lo
    if(t===cues[i][1])return hi
    for(let n=0;n<48;n++){const mid=(lo+hi)/2;if(guidedTime(mid,secondary)<t)lo=mid;else hi=mid}
    return (lo+hi)/2
  }
  return guidedDuration(secondary)
}
