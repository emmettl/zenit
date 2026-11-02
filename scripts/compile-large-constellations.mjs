/** Offline full-group compilation. Raw captures stay in ignored work/. */
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {json2satrec,sgp4,eciToEcf,gstime} from 'satellite.js'
const root='work/sources/large-constellations-2026-11-02/',hash=b=>createHash('sha256').update(b).digest('hex'),config=[{id:'starlink',label:'Starlink',pin:'2e22394e07aa724c3904d6cbd4502ee1dc7c2fe911d6470fa1870a19bed19d78',pattern:'^STARLINK-[0-9]+( \\[DTC\\])?$'},{id:'kuiper',label:'Kuiper',pin:'60cb0739ebcab95a2e9143dee9babac5ad4fa9cfa2213788133e84404cf1888c',pattern:'^KUIPER-[0-9]+$'}]
const policyAudit=JSON.parse(await readFile('docs/evidence/constellation-proof-2026-11-02.json','utf8')),policies=policyAudit.sources.filter(s=>s.id!=='oneweb')
for(const s of policies)if(hash(await readFile(s.retainedPath))!==s.sha256)throw Error('Retained policy mismatch')
const study={startUtc:'2026-11-02T10:30:00.000Z',endUtc:'2026-11-02T11:00:00.000Z',initialUtc:'2026-11-02T10:30:00.000Z'},start=Date.parse(study.startUtc),end=Date.parse(study.endUtc),groups={},indices={}
const fields=['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT','EPHEMERIS_TYPE','ELEMENT_SET_NO','REV_AT_EPOCH']
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],normal=p=>{const r=p.position,v=p.velocity,n=[r.y*v.z-r.z*v.y,r.z*v.x-r.x*v.z,r.x*v.y-r.y*v.x],length=Math.hypot(...n);return n.map(x=>x/length)}
await mkdir('work/large-constellations',{recursive:true})
for(const group of config){
 const bytes=await readFile(root+group.id+'.json'),capture=JSON.parse(await readFile(root+group.id+'-capture.json','utf8'))
 if(hash(bytes)!==group.pin||capture.sha256!==group.pin||capture.responseStatus!==200||capture.url!==capture.finalUrl)throw Error('Unverified source '+group.id)
 const rows=JSON.parse(bytes),movers=[],ledger=[],samples=[],seen=new Set(),source={id:group.id,url:capture.url,capturedAt:capture.capturedAt,responseDate:capture.responseHeaders.Date,sha256:group.pin,bytes:bytes.length},normals=[]
 for(const row of rows){const id=String(row.NORAD_CAT_ID);if(seen.has(id))throw Error('Duplicate identity '+id);seen.add(id)
  const e=Object.fromEntries(['OBJECT_NAME','OBJECT_ID','EPOCH','CLASSIFICATION_TYPE',...fields].map(k=>[k,row[k]]));e.NORAD_CAT_ID=id;e.EPOCH=row.EPOCH.endsWith('Z')?row.EPOCH:row.EPOCH+'Z'
  let valid=/^[1-9][0-9]{0,8}$/.test(id)&&new RegExp(group.pattern).test(row.OBJECT_NAME)&&/^\d{4}-\d{3}[A-Z]+$/.test(row.OBJECT_ID)&&row.CLASSIFICATION_TYPE==='U'&&row.EPHEMERIS_TYPE===0&&fields.every(k=>Number.isFinite(row[k]))&&row.MEAN_MOTION>0&&row.ECCENTRICITY>=0&&row.ECCENTRICITY<1&&row.INCLINATION>=0&&row.INCLINATION<=180&&['RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'].every(k=>row[k]>=0&&row[k]<360)
  for(const [k,v] of Object.entries({CENTER_NAME:'EARTH',REF_FRAME:'TEME',TIME_SYSTEM:'UTC',MEAN_ELEMENT_THEORY:'SGP4'})){if(row[k]!==undefined&&row[k]!==v)valid=false;e[k]=v}
  const epoch=Date.parse(e.EPOCH),first=Math.max(start,epoch-86400000),last=Math.min(end,epoch+86400000)
  if(!valid||!Number.isFinite(epoch)){ledger.push({id,reason:'invalid-elements'});continue}if(first>last){ledger.push({id,epoch:e.EPOCH,reason:'outside-age-window'});continue}
  const baseline=json2satrec(e,'a'),at=t=>sgp4({...baseline},(t-epoch)/60000);let failed=null
  for(let t=first;;t=Math.min(last,t+30000)){const p=at(t);if(!p||![...Object.values(p.position),...Object.values(p.velocity)].every(Number.isFinite)){failed=t;break}if(t===last)break}
  if(failed!==null){ledger.push({id,reason:'propagation-failure',firstFailedUtc:new Date(failed).toISOString()});continue}
  movers.push({id,name:row.OBJECT_NAME,element:e,eligibleStartUtc:new Date(first).toISOString(),eligibleEndUtc:new Date(last).toISOString()})
  for(const time of [...new Set([first,(first+last)/2,last])]){const p=at(time);samples.push({id,element:e,time,temeKm:p.position,velocityKmS:p.velocity,fixedKm:eciToEcf(p.position,gstime(new Date(time)))})}
 }
 movers.sort((a,b)=>Number(a.id)-Number(b.id));if(movers.length>20000)throw Error('Declared 20,000 mover budget exceeded; never silently cap')
 // Exact 1-degree normal neighbourhoods via a Cartesian grid. Grid only finds
 // candidates; inclusion still uses the actual angular dot-product threshold.
 const cell=2*Math.sin(Math.PI/360),threshold=Math.cos(Math.PI/180),buckets=new Map(),key=(x,y,z)=>x+','+y+','+z
 for(const [i,m] of movers.entries()){const p=sgp4({...json2satrec(m.element,'a')},(start-Date.parse(m.element.EPOCH))/60000);normals[i]=normal(p);if(Date.parse(m.eligibleStartUtc)>start)continue;const xyz=normals[i].map(x=>Math.floor(x/cell)),k=key(...xyz);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)}
 let lead=-1,best=0
 for(const [i,m] of movers.entries()){const period=1440/m.element.MEAN_MOTION;if(Date.parse(m.eligibleStartUtc)>start||period<85||period>130||m.element.ECCENTRICITY>=.003)continue;const xyz=normals[i].map(x=>Math.floor(x/cell));let count=0
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const j of buckets.get(key(xyz[0]+x,xyz[1]+y,xyz[2]+z))??[])if(dot(normals[i],normals[j])>=threshold)count++
  if(count>best){best=count;lead=i}
 }
 if(lead<0)throw Error('Featured plane unavailable')
 const memberIds=movers.filter((m,i)=>Date.parse(m.eligibleStartUtc)<=start&&dot(normals[i],normals[lead])>=threshold).map(m=>m.id),guideIndices=[lead]
 for(let i=0;i<movers.length&&guideIndices.length<24;i++)if(Date.parse(movers[i].eligibleStartUtc)<=start&&guideIndices.every(j=>dot(normals[i],normals[j])<Math.cos(Math.PI/60)))guideIndices.push(i)
 const featured={id:movers[lead].id,memberIds,thresholdDegrees:1,epochUtc:study.startUtc,selection:'Densest 1-degree opening-time angular-momentum-normal neighbourhood among eligible, near-circular (eccentricity <0.003), 85–130 minute records; lowest numeric NORAD ID breaks ties.',guideIds:guideIndices.map(i=>movers[i].id)}
 const statistics={inputRows:rows.length,retainedIdentities:movers.length,excludedIdentities:ledger.length,capExclusions:0,initialEligible:movers.filter(m=>Date.parse(m.eligibleStartUtc)<=start).length,endEligible:movers.filter(m=>Date.parse(m.eligibleEndUtc)>=end).length}
 const model={...policyAudit.model,sampleMode:'Direct SGP4 from fresh baseline copies in a dedicated worker; one complete position/normal packet at one UTC. Float64 transport, Float32 GPU attributes. No interpolation or synthetic population filling.'},rights={...policyAudit.rights,fields:`Basic GP/OMM fields only. ${group.label} group membership and names are provider-supplied. No optional status, availability or service metadata.`}
 const release={schemaVersion:1,kind:'constellation-proof',constellation:group.id,study,source,model,rights,statistics,featured,movers},body=JSON.stringify(release)+'\n',sha256=hash(body),file='constellation-'+sha256.slice(0,12)+'.json',gzipBytes=gzipSync(body).length
 if(gzipBytes>1000000||Buffer.byteLength(body)>8000000)throw Error('Declared per-group payload budget exceeded')
 await writeFile('public/data/orbital/'+file,body);await writeFile('work/large-constellations/'+group.id+'-reference-samples.json',JSON.stringify(samples)+'\n')
 groups[group.id]={label:group.label,source:{...source,retainedPath:root+group.id+'.json'},study,statistics,featured,exclusionLedger:ledger,release:{file:'data/orbital/'+file,sha256,bytes:Buffer.byteLength(body),gzipBytes},validation:{independentAgreement:null,everyThirtySeconds:true}}
 indices[group.id]={file:'./data/orbital/'+file,sha256,records:movers.length,study,sourceSha256:group.pin,label:group.label,namePattern:group.pattern,statistics,maximumMovers:20000,maximumBytes:8000000}
 console.log({group:group.id,...statistics,file,gzipBytes,featured:movers[lead].id,plane:memberIds.length})
}
const report={title:'Full Starlink and Kuiper constellation populations',status:'bounded-full-group-visualisation',study,policySources:policies,rights:{...policyAudit.rights,fields:'Basic GP/OMM fields only. Starlink and Kuiper group membership and names are provider-supplied, including the provider DTC suffix in OBJECT_NAME. No optional status, availability or service enrichment.'},groups,budgets:{scope:'Separate on-demand constellation chapter; original main edition keeps its 1,000-mover budget.',maximumMoversPerGroup:20000,maximumPayloadGzipPerGroup:1000000,maximumPayloadBytesPerGroup:8000000,maximumCompleteArtifactGzip:3500000,originalOpeningArtifactGzip:2000000,selection:'No population cap or sample. Only invalid, wholly stale or unpropagatable records excluded.',orientationGuides:'At most 24 illustrative orientation circles. This guide limit does not remove any satellite identities.'},presentation:{comparison:'One constellation per load, with shared 2 November 2026 10:30–11:00 UTC bounds. Switching preserves displayed UTC and opens the full population paused. Each group is a separate capture; no simultaneous operational completeness claim.',density:'One GPU point per identity. Smaller authored markers at large scale. No synthetic filling, communication links, coverage or deployment reconstruction.'},validation:{independent:'Python sgp4 2.25 / Vallado C++ plus GMST/ECF at first, middle and last eligible time of every retained identity.',physicalPhonePerformance:'Unmeasured; local desktop and WebKit emulation only.'}}
await writeFile('src/large-constellation-releases.json',JSON.stringify(indices,null,2)+'\n');await writeFile('docs/evidence/large-constellations-2026-11-02.json',JSON.stringify(report,null,2)+'\n')
