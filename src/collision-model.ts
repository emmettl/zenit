// Edition-owned synthetic experiment. No TLEs, catalogue identities or event fit.
export type Vec3 = readonly [number, number, number]
export interface State {position: Vec3; velocity: Vec3}
export const MU = 398600.4418 // km³/s², conventional Earth GM
export const RADIUS = 6378.137 // km; spherical reference height, not WGS84 altitude
export const RELEASE_HEIGHT = 800
export const SEED = 0x5a454e49
export const SAMPLES_PER_FAMILY = 96
export const RETENTION = .995 // assumed retention of velocity relative to the equal-weight COM
export const START = -30
export const add = (a:Vec3,b:Vec3):Vec3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]]
export const scale = (a:Vec3,s:number):Vec3 => [a[0]*s,a[1]*s,a[2]*s]
export const dot = (a:Vec3,b:Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
export const norm = (a:Vec3) => Math.sqrt(dot(a,a))
const cross = (a:Vec3,b:Vec3):Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]

/** Analytic bound two-body orbit, solved from its initial Cartesian state.
 * Kepler's equation is evaluated directly for every requested time, including seeks.
 * This solver deliberately accepts only non-radial, elliptic states.
 */
export class Orbit {
  readonly a:number
  readonly e:number
  readonly period:number
  readonly perigee:number
  private readonly p:Vec3
  private readonly q:Vec3
  private readonly m0:number
  readonly initial:State
  constructor(initial:State) {
    this.initial=initial
    const {position:r,velocity:v}=initial, radius=norm(r), h=cross(r,v)
    if (![...r,...v].every(Number.isFinite)||radius===0||norm(h)<1e-9) throw new Error('Non-radial finite state required')
    const eccentric=add(scale(cross(v,h),1/MU),scale(r,-1/radius))
    this.a=1/(2/radius-dot(v,v)/MU)
    this.e=norm(eccentric)<1e-12?0:norm(eccentric)
    if(this.a<=0||this.e>=1)throw new Error('Bound elliptic state required')
    this.p=this.e===0?scale(r,1/radius):scale(eccentric,1/this.e)
    this.q=cross(scale(h,1/norm(h)),this.p)
    const e0=Math.atan2(dot(r,this.q)/(this.a*Math.sqrt(1-this.e*this.e)),dot(r,this.p)/this.a+this.e)
    this.m0=e0-this.e*Math.sin(e0)
    this.period=2*Math.PI*Math.sqrt(this.a**3/MU)
    this.perigee=this.a*(1-this.e)-RADIUS
  }
  at(seconds:number):State {
    if(!Number.isFinite(seconds))throw new Error('Finite elapsed time required')
    if(seconds===0)return this.initial
    const raw=this.m0+seconds*2*Math.PI/this.period, m=Math.atan2(Math.sin(raw),Math.cos(raw))
    let e=this.e>.8?Math.sign(m||1)*Math.PI:m
    for(let i=0;i<32;i++){const step=(e-this.e*Math.sin(e)-m)/(1-this.e*Math.cos(e));e-=step;if(Math.abs(step)<1e-13)break}
    const c=Math.cos(e),s=Math.sin(e),b=Math.sqrt(1-this.e*this.e)
    const position=add(scale(this.p,this.a*(c-this.e)),scale(this.q,this.a*b*s))
    const factor=Math.sqrt(MU*this.a)/norm(position)
    return {position,velocity:add(scale(this.p,-factor*s),scale(this.q,factor*b*c))}
  }
}

const radius=RADIUS+RELEASE_HEIGHT, speed=Math.sqrt(MU/radius)
export const PARENTS = [55,-35].map(degrees=>new Orbit({position:[radius,0,0],velocity:[0,speed*Math.cos(degrees*Math.PI/180),speed*Math.sin(degrees*Math.PI/180)]}))
export const PERIOD = PARENTS[0].period
export const END = 3*PERIOD
export const RELATIVE_SPEED = norm(add(PARENTS[0].initial.velocity,scale(PARENTS[1].initial.velocity,-1)))
export interface Sample {family:0|1; orbit:Orbit; kick:Vec3}
export interface Experiment {spread:number; samples:Sample[]; periods:[number,number][]}

function random(seed:number){let value=seed;return()=>{value+=0x6d2b79f5;let t=Math.imul(value^value>>>15,1|value);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
export function experiment(spread:number):Experiment {
  if(!Number.isFinite(spread)||spread<10||spread>100)throw new Error('Release speed must be 10–100 m/s')
  const rng=random(SEED), com=scale(add(PARENTS[0].initial.velocity,PARENTS[1].initial.velocity),.5),samples:Sample[]=[]
  for(const family of [0,1] as const){
    const mean=add(com,scale(add(PARENTS[family].initial.velocity,scale(com,-1)),RETENTION))
    for(let i=0;i<SAMPLES_PER_FAMILY/2;i++){
      const z=2*rng()-1,angle=2*Math.PI*rng(),r=Math.sqrt(1-z*z),direction:Vec3=[r*Math.cos(angle),r*Math.sin(angle),z]
      for(const sign of [-1,1]){
        const kick=scale(direction,sign*spread/1000)
        samples.push({family,kick,orbit:new Orbit({position:[radius,0,0],velocity:add(mean,kick)})})
      }
    }
  }
  return {spread,samples,periods:[0,1].map(family=>{const periods=samples.filter(s=>s.family===family).map(s=>s.orbit.period);return[Math.min(...periods),Math.max(...periods)]})}
}

// A 50-second authored viewing clock; the physical elapsed time remains explicit.
const CUES:[[number,number],...Array<[number,number]>]=[[0,START],[8,0],[10,0],[18,180],[28,1800],[50,END]]
export const GUIDED_DURATION=50
export function guidedTime(cue:number):number {
  const seconds=Math.max(0,Math.min(GUIDED_DURATION,cue))
  for(let i=1;i<CUES.length;i++){const [b,tb]=CUES[i],[a,ta]=CUES[i-1];if(seconds<=b)return ta+(tb-ta)*(seconds-a)/(b-a)}
  return END
}
export function guidedCue(time:number):number {
  const t=Math.max(START,Math.min(END,time))
  for(let i=1;i<CUES.length;i++){const [b,tb]=CUES[i],[a,ta]=CUES[i-1];if(t<=tb&&tb>ta)return a+(b-a)*(t-ta)/(tb-ta)}
  return GUIDED_DURATION
}
