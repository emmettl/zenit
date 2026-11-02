import type {ConstellationRelease} from './constellation'
import {validConstellationFrame,type ConstellationFrame} from './constellation-frame'
/** Exactly one calculation in flight, plus the latest requested UTC. Superseded
 * seeks never commit a mismatched clock/position packet to the scene. */
export async function constellationSampler(release:ConstellationRelease){
 const worker=new Worker(new URL('./constellation.worker.ts',import.meta.url),{type:'module'})
 let revision=0,busy=false,wanted:{time:number;revision:number}|null=null,current:{time:number;revision:number}|null=null,dead=false
 let onFrame:(frame:ConstellationFrame)=>void=()=>{},onError:()=>void=()=>{}
 const ready=new Promise<void>((resolve,reject)=>{worker.onmessage=e=>{if(e.data.type==='ready')resolve();else reject(Error('Constellation worker could not initialise'))};worker.onerror=()=>reject(Error('Constellation worker unavailable'))})
 worker.postMessage({type:'init',release});try{await ready}catch(e){worker.terminate();throw e}
 const send=()=>{if(dead||busy||!wanted)return;current=wanted;wanted=null;busy=true;worker.postMessage({type:'sample',...current})}
 const fail=()=>{dead=true;busy=false;wanted=null;worker.terminate();onError()}
 worker.onmessage=e=>{const frame=e.data.frame as ConstellationFrame;if(e.data.type!=='frame'||!current||!validConstellationFrame(frame,current.time,current.revision,release.movers.length)){fail();return}busy=false
  if(frame.revision===revision)onFrame(frame)
  send()
 };worker.onerror=fail
 return {request(time:number){if(dead)return;revision++;wanted={time,revision};send()},get busy(){return busy||wanted!==null},listen(frame:(frame:ConstellationFrame)=>void,error:()=>void){onFrame=frame;onError=error},dispose(){dead=true;worker.terminate()}}
}
