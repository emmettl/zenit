import {json2satrec,sgp4,eciToEcf,gstime} from 'satellite.js'
import type {ConstellationRelease} from './constellation'
export interface ConstellationFrame {time:number;revision:number;positions:Float64Array;normals:Float64Array;available:Uint8Array;sampleMs:number}
export function createConstellationFrames(release:ConstellationRelease){
 const first=Date.parse(release.study.startUtc),last=Date.parse(release.study.endUtc),orbits=release.movers.map(m=>({baseline:json2satrec(m.element,'a'),epoch:Date.parse(m.element.EPOCH),first:Date.parse(m.eligibleStartUtc),last:Date.parse(m.eligibleEndUtc)}))
 return (time:number,revision:number):ConstellationFrame=>{
  if(!Number.isFinite(time)||time<first||time>last||!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid constellation frame request')
  const began=performance.now(),positions=new Float64Array(orbits.length*3),normals=new Float64Array(orbits.length*3),available=new Uint8Array(orbits.length),gmst=gstime(new Date(time))
  orbits.forEach((o,i)=>{if(time<o.first||time>o.last||Math.abs(time-o.epoch)>86400000)return
   const p=sgp4({...o.baseline},(time-o.epoch)/60000);if(!p||![...Object.values(p.position),...Object.values(p.velocity)].every(Number.isFinite))return
   const r=p.position,v=p.velocity,f=eciToEcf(r,gmst),x=r.y*v.z-r.z*v.y,y=r.z*v.x-r.x*v.z,z=r.x*v.y-r.y*v.x,length=Math.hypot(x,y,z)
   if(!Number.isFinite(length)||length===0)return
   positions.set([f.x/6378.137,f.z/6378.137,-f.y/6378.137],i*3);normals.set([x/length,y/length,z/length],i*3);available[i]=1
  })
  return {time,revision,positions,normals,available,sampleMs:performance.now()-began}
 }
}
export function validConstellationFrame(frame:ConstellationFrame,time:number,revision:number,count:number){
 return frame.time===time&&frame.revision===revision&&frame.positions instanceof Float64Array&&frame.normals instanceof Float64Array&&frame.available instanceof Uint8Array&&frame.positions.length===count*3&&frame.normals.length===count*3&&frame.available.length===count&&frame.positions.every(Number.isFinite)&&frame.normals.every(Number.isFinite)&&frame.available.every(x=>x===0||x===1)
}
