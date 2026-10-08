import {useEffect,useRef,useState} from 'react'
import {validSurfaceTrails} from './surface-trails'
import {type Cohorts,type PopulationFrame} from './cohorts'
/** At most one outstanding sample; coalesce clock ticks instead of building a queue.
 * Packet timestamps are the instant used by both orbit and sky rendering.
 * Manual seeks reject superseded results while retaining the last coherent scene.
 */
export function usePopulation(snapshot:Cohorts|null,time:number,revision:number,attempt:number,trailsRequested=false) {
  const [completed,setCompleted]=useState<{frame:PopulationFrame;snapshot:Cohorts;attempt:number}|null>(null),[failed,setFailed]=useState(false)
  const latest=useRef({time,revision,trailsRequested});latest.current={time,revision,trailsRequested}
  useEffect(()=>{
    setCompleted(null);setFailed(false);if(!snapshot)return
    let worker:Worker
    try{worker=new Worker(new URL('./population.worker.ts',import.meta.url),{type:'module'})}catch{setFailed(true);return}
    let disposed=false,ready=false,busy=false,lastTime=NaN,lastRevision=-1,lastTrails=false
    const send=()=>{const request=latest.current;if(!ready||busy||(request.time===lastTime&&request.revision===lastRevision&&request.trailsRequested===lastTrails))return;busy=true;lastTime=request.time;lastRevision=request.revision;lastTrails=request.trailsRequested;worker.postMessage({type:'sample',...request})}
    worker.onmessage=(event:MessageEvent)=>{
      if(disposed)return
      if(event.data.type==='ready'){ready=true;send();return}
      if(event.data.type==='error'){setFailed(true);ready=false;busy=false;return}
      if(event.data.type==='frame'){busy=false;const packet=event.data as PopulationFrame;if(packet.revision===latest.current.revision&&validSurfaceTrails(packet,snapshot.movers.length)&&packet.positions instanceof Float64Array&&packet.availability instanceof Uint8Array&&packet.positions.length===snapshot.movers.length*3&&packet.availability.length===snapshot.movers.length)setCompleted({frame:packet,snapshot,attempt});send()}
    }
    worker.onerror=()=>{setFailed(true);ready=false}
    worker.postMessage({type:'init',snapshot});const interval=setInterval(send,33)
    return()=>{disposed=true;clearInterval(interval);worker.terminate()}
  },[snapshot,attempt])
  // A pending seek keeps glyphs, sky and follow geometry on one accepted timestamp.
  // Dataset replacement, retry and failure must never reuse the old population.
  const frame=completed?.snapshot===snapshot&&completed.attempt===attempt&&!failed?completed.frame:null
  return {frame,failed,pending:Boolean(snapshot&&!failed&&(!frame||frame.revision!==revision))}
}
