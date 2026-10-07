import {useEffect,useRef,useState} from 'react'
import {type Cohorts,type PopulationFrame} from './cohorts'
/** At most one outstanding sample; coalesce clock ticks instead of building a queue.
 * Packet timestamps are the instant used by both orbit and sky rendering.
 * Manual seeks invalidate old revisions before any result can be displayed.
 */
export function usePopulation(snapshot:Cohorts|null,time:number,revision:number,attempt:number) {
  const [frame,setFrame]=useState<PopulationFrame|null>(null),[failed,setFailed]=useState(false)
  const latest=useRef({time,revision});latest.current={time,revision}
  useEffect(()=>{
    setFrame(null);setFailed(false);if(!snapshot)return
    let worker:Worker
    try{worker=new Worker(new URL('./population.worker.ts',import.meta.url),{type:'module'})}catch{setFailed(true);return}
    let ready=false,busy=false,lastTime=NaN,lastRevision=-1
    const send=()=>{const request=latest.current;if(!ready||busy||(request.time===lastTime&&request.revision===lastRevision))return;busy=true;lastTime=request.time;lastRevision=request.revision;worker.postMessage({type:'sample',...request})}
    worker.onmessage=(event:MessageEvent)=>{
      if(event.data.type==='ready'){ready=true;send();return}
      if(event.data.type==='error'){setFailed(true);ready=false;busy=false;return}
      if(event.data.type==='frame'){busy=false;const packet=event.data as PopulationFrame;if(packet.revision===latest.current.revision&&packet.positions instanceof Float64Array&&packet.availability instanceof Uint8Array&&packet.positions.length===snapshot.movers.length*3&&packet.availability.length===snapshot.movers.length)setFrame(packet)}
    }
    worker.onerror=()=>{setFailed(true);ready=false}
    worker.postMessage({type:'init',snapshot});const interval=setInterval(send,33)
    return()=>{clearInterval(interval);worker.terminate()}
  },[snapshot,attempt])
  return {frame:frame?.revision===revision&&!failed?frame:null,failed}
}
