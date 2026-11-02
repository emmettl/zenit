import {createConstellationFrames} from './constellation-frame'
const scope=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown,transfer?:Transferable[])=>void}
let sample:ReturnType<typeof createConstellationFrames>|null=null
scope.onmessage=event=>{try{
 if(event.data.type==='init'){sample=createConstellationFrames(event.data.release);scope.postMessage({type:'ready'});return}
 if(event.data.type!=='sample'||!sample)throw Error('Constellation worker not ready')
 const frame=sample(event.data.time,event.data.revision);scope.postMessage({type:'frame',frame},[frame.positions.buffer,frame.normals.buffer,frame.available.buffer] as ArrayBuffer[])
}catch{scope.postMessage({type:'error'})}}
