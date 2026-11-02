import {describe,it,expect,vi,afterEach} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {CONSTELLATIONS,readConstellation,constellationOrbits,constellationState,featuredPlane} from './constellation'
import {createConstellationFrames,validConstellationFrame,type ConstellationFrame} from './constellation-frame'
import {constellationSampler} from './constellation-sampler'
afterEach(()=>vi.unstubAllGlobals())
for(const id of ['starlink','kuiper'] as const){const index=CONSTELLATIONS[id],body=readFileSync('public/'+index.file.slice(2)),release=readConstellation(JSON.parse(body.toString()),id),start=Date.parse(release.study.startUtc),end=Date.parse(release.study.endUtc),orbits=constellationOrbits(release)
 describe(id+' full retained population',()=>{
  it('retains every valid age-eligible identity and its provider name without a cap',()=>{expect(createHash('sha256').update(body).digest('hex')).toBe(index.sha256);expect(release.movers).toHaveLength(index.records);expect(new Set(release.movers.map(m=>m.id)).size).toBe(index.records);expect(release.statistics.capExclusions).toBe(0)
   const audit=JSON.parse(readFileSync('docs/evidence/large-constellations-2026-11-02.json','utf8')).groups[id];expect(audit.validation.independentAgreement).toMatchObject({passed:true,payloadSha256:index.sha256,identities:index.records,samples:index.records*3});expect(audit.exclusionLedger).toHaveLength(index.statistics.excludedIdentities);expect(audit.exclusionLedger.every((m:{reason:string})=>m.reason==='outside-age-window')).toBe(true)
   if(id==='starlink')expect(release.movers.some(m=>m.name.endsWith('[DTC]'))).toBe(true)
  })
  it('shares direct-propagation coordinates and age eligibility on every full worker packet',()=>{
   const sample=createConstellationFrames(release)
   for(const [revision,time] of [start,end,start+900000,start].entries()){const f=sample(time,revision);expect(validConstellationFrame(f,time,revision,index.records)).toBe(true);expect(f.available.reduce((a,b)=>a+b,0)).toBe(time===end?index.statistics.endEligible:index.statistics.initialEligible-(time===start+900000?orbits.filter(o=>o.end<time).length:0))
    for(let i=0;i<orbits.length;i++){const direct=constellationState(orbits[i],time);expect(f.available[i]).toBe(direct?1:0);if(direct){expect(Math.hypot(...direct.world.toArray().map((x,j)=>x-f.positions[i*3+j]))).toBeLessThan(1e-12);expect(Math.hypot(...direct.normal.toArray().map((x,j)=>x-f.normals[i*3+j]))).toBeLessThan(1e-12)}}
   }
   expect(()=>sample(end+1,0)).toThrow();expect(()=>sample(start,NaN)).toThrow()
  })
  it('reconciles the offline featured neighbourhood against all measured opening normals',()=>{
   const plane=featuredPlane(orbits,start,release.featured),threshold=Math.cos(Math.PI/180),members=new Set(plane.members)
   for(let i=0;i<orbits.length;i++){const n=constellationState(orbits[i],start)?.normal;expect(members.has(i)).toBe(Boolean(n&&n.dot(plane.normal)>=threshold))}
   expect(release.featured!.guideIds.length).toBeLessThanOrEqual(24);expect(release.featured!.memberIds).toHaveLength(id==='starlink'?100:6)
   const bad=structuredClone(release);bad.featured!.memberIds.push('999999999');expect(()=>readConstellation(bad,id)).toThrow();expect(()=>readConstellation(release,id==='starlink'?'kuiper':'starlink')).toThrow()
  })
 })
}
it('commits only the latest requested UTC and rejects a mismatched worker packet',async()=>{
 const release=readConstellation(JSON.parse(readFileSync('public/'+CONSTELLATIONS.oneweb.file.slice(2),'utf8'))),sample=createConstellationFrames(release),start=Date.parse(release.study.startUtc)
 class FakeWorker {static instance:FakeWorker;onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;messages:{type:string;time:number;revision:number}[]=[];terminated=false
  constructor(){FakeWorker.instance=this}postMessage(m:{type:string;time:number;revision:number}){if(m.type==='init')queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));else this.messages.push(m)}terminate(){this.terminated=true}emit(frame:ConstellationFrame){this.onmessage?.({data:{type:'frame',frame}})}
 }
 vi.stubGlobal('Worker',FakeWorker);const sampler=await constellationSampler(release),worker=FakeWorker.instance,frames:ConstellationFrame[]=[],errors:string[]=[];sampler.listen(f=>frames.push(f),()=>errors.push('failed'))
 sampler.request(start);sampler.request(start+600000);sampler.request(start+1200000);expect(worker.messages).toHaveLength(1)
 worker.emit(sample(start,1));expect(frames).toHaveLength(0);expect(worker.messages).toHaveLength(2);expect(worker.messages[1]).toMatchObject({time:start+1200000,revision:3})
 worker.emit(sample(start+1200000,3));expect(frames.map(f=>f.time)).toEqual([start+1200000]);expect(sampler.busy).toBe(false)
 sampler.request(start+300000);worker.emit(sample(start+600000,4));expect(errors).toEqual(['failed']);expect(worker.terminated).toBe(true);expect(frames).toHaveLength(1)
})
