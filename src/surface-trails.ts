import {PerspectiveCamera,Vector3} from 'three'
import {EARTH_RADIUS_KM,OBSERVER,earthSurface,observerNormal} from './camera'
import {orbitalState} from './orbital'
import {enabledMover,groupColour,type Population,type PopulationFrame,type Cohorts,type GroupId} from './cohorts'
import {earthFixedSun,illumination,illuminationWeight} from './illumination'
import type {ScreenBox} from './orientation'
export const SURFACE_TRAIL_SECONDS=45,SURFACE_TRAIL_STEP=3,SURFACE_TRAIL_SAMPLES=16,SURFACE_TRAIL_CANDIDATES=24
export interface SurfaceTrail {index:number;positions:Float64Array;valid:Uint8Array}
const up=observerNormal(OBSERVER.latitude,OBSERVER.longitude),site=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(up,OBSERVER.heightKm/EARTH_RADIUS_KM)
/** Frozen direct SGP4 samples. No accumulated history, duplicated attachments or inferred velocity. */
export function sampleSurfaceTrails(population:Population,frame:PopulationFrame):SurfaceTrail[] {
  const candidates:{index:number;motion:number}[]=[]
  population.propagators.forEach((orbit,index)=>{
    if(frame.availability[index]!==1||population.snapshot.movers[index].id==='25544')return
    const head=new Vector3().fromArray(frame.positions,index*3).sub(site);if(head.dot(up)<=0)return
    const past=orbitalState(orbit,frame.time-SURFACE_TRAIL_SECONDS*1000);if(!past)return
    const motion=head.normalize().angleTo(past.world.sub(site).normalize())
    // Nearly stationary geosynchronous lights do not acquire decorative streaks.
    if(motion>=.004*Math.PI/180*SURFACE_TRAIL_SECONDS)candidates.push({index,motion})
  })
  return candidates.sort((a,b)=>b.motion-a.motion||a.index-b.index).slice(0,SURFACE_TRAIL_CANDIDATES).map(({index})=>{
    const positions=new Float64Array(SURFACE_TRAIL_SAMPLES*3),valid=new Uint8Array(SURFACE_TRAIL_SAMPLES)
    for(let i=0;i<SURFACE_TRAIL_SAMPLES;i++){
      const time=frame.time-(SURFACE_TRAIL_SAMPLES-1-i)*SURFACE_TRAIL_STEP*1000
      const world=i===SURFACE_TRAIL_SAMPLES-1?new Vector3().fromArray(frame.positions,index*3):orbitalState(population.propagators[index],time)?.world
      if(world&&world.clone().sub(site).dot(up)>0){positions.set(world.toArray(),i*3);valid[i]=1}
    }
    return {index,positions,valid}
  })
}
export function validSurfaceTrails(frame:PopulationFrame,count:number):boolean {
  return typeof frame.trailsRequested==='boolean'&&Array.isArray(frame.surfaceTrails)&&frame.surfaceTrails.length<=SURFACE_TRAIL_CANDIDATES&&(!frame.trailsRequested?frame.surfaceTrails.length===0:true)&&new Set(frame.surfaceTrails.map(x=>x.index)).size===frame.surfaceTrails.length&&frame.surfaceTrails.every(x=>Number.isInteger(x.index)&&x.index>=0&&x.index<count&&x.positions instanceof Float64Array&&x.positions.length===SURFACE_TRAIL_SAMPLES*3&&x.positions.every(Number.isFinite)&&x.valid instanceof Uint8Array&&x.valid.length===SURFACE_TRAIL_SAMPLES&&x.valid.every(v=>v===0||v===1))
}
/** A small camera-dependent subset; pan reprojects a packet without running orbital calculations. */
export function surfaceTrailVertices(frame:PopulationFrame,cohorts:Cohorts,camera:PerspectiveCamera,groups:readonly GroupId[],selected:string|undefined,width:number,height:number,exclusions:ScreenBox[],sunAt=earthFixedSun) {
  const positions:number[]=[],colours:number[]=[],alphas:number[]=[],visible:{id:string;head:number[];segments:number}[]=[]
  const limit=Math.min(width,height)<=650?2:3
  const suns=frame.surfaceTrails.length?Array.from({length:SURFACE_TRAIL_SAMPLES},(_,i)=>sunAt(frame.time-(SURFACE_TRAIL_SAMPLES-1-i)*SURFACE_TRAIL_STEP*1000)):[]
  for(const path of frame.surfaceTrails){
    const mover=cohorts.movers[path.index];if(mover.id===selected||mover.id==='25544'||frame.availability[path.index]!==1||!enabledMover(mover,groups))continue
    const head=new Vector3().fromArray(path.positions,(SURFACE_TRAIL_SAMPLES-1)*3),ndc=head.clone().project(camera),x=(ndc.x+1)*width/2,y=(1-ndc.y)*height/2
    if(ndc.z<=-1||ndc.z>=1||Math.abs(ndc.x)>.94||Math.abs(ndc.y)>.94||exclusions.some(box=>x>=box.x-12&&x<=box.x+box.width+12&&y>=box.y-12&&y<=box.y+box.height+12))continue
    const first=path.valid.findIndex(v=>v===1);if(first<0)continue
    const tail=new Vector3().fromArray(path.positions,first*3).project(camera)
    if(Math.hypot((ndc.x-tail.x)*width/2,(ndc.y-tail.y)*height/2)<1)continue
    const colour=groupColour(mover);let segments=0
    for(let i=1;i<SURFACE_TRAIL_SAMPLES;i++){
      if(!path.valid[i-1]||!path.valid[i])continue // never bridge an invalid or below-horizon sample
      for(const j of [i-1,i]){positions.push(...path.positions.slice(j*3,j*3+3));colours.push(...colour);alphas.push(.34*(j/(SURFACE_TRAIL_SAMPLES-1))**1.4*illuminationWeight(illumination(new Vector3().fromArray(path.positions,j*3),suns[j]).transition))}
      segments++
    }
    if(segments)visible.push({id:mover.id,head:head.toArray(),segments})
    if(visible.length===limit)break
  }
  return {positions,colours,alphas,visible}
}
