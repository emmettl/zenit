import {createPopulation,populationFrame,readCohorts,type Population} from './cohorts'
const workerScope=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown,transfer?:Transferable[])=>void}
let population:Population|null=null
workerScope.onmessage=(event:MessageEvent)=>{
  try {
    if(event.data.type==='init'){population=createPopulation(readCohorts(event.data.snapshot));workerScope.postMessage({type:'ready'});return}
    if(!population||event.data.type!=='sample'||!Number.isFinite(event.data.time)||!Number.isInteger(event.data.revision))throw Error('Invalid sample request')
    const frame=populationFrame(population,event.data.time,event.data.revision)
    workerScope.postMessage({type:'frame',...frame},[frame.positions.buffer as ArrayBuffer,frame.availability.buffer as ArrayBuffer])
  }catch{workerScope.postMessage({type:'error'})}
}
