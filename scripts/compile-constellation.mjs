/** Manual offline compilation. No acquisition during builds or visitor sessions. */
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {json2satrec,sgp4,eciToEcf,gstime} from 'satellite.js'
const root='work/sources/constellation-2026-11-02/',hash=b=>createHash('sha256').update(b).digest('hex')
const pins={'oneweb':'6b04ee799fe82bb53a9c802bd4b065daaee05b58b4eac13e0cf46232e50bb647','celestrak-usage':'7f7ae31ed4f29264f0a1ef35e4e6e73ef48fb0a7b5ae428cea8411632de7162b','celestrak-formats':'441d4fc9d9938058d0426b706d325c620c0b08a81de9f973d3587265c3e3103b','space-track-terms':'07f4461cad60ee70fb2214927f927973b83a753716b66f6e4385bde7cbfd3d6d'}
const sources=[];let rows
for(const [id,pin] of Object.entries(pins)){
 const body=await readFile(root+id+(id==='oneweb'?'.json':'.html')),capture=JSON.parse(await readFile(root+id+'-capture.json','utf8'))
 if(hash(body)!==pin||capture.sha256!==pin||capture.responseStatus!==200||capture.url!==capture.finalUrl)throw Error('Unverified source '+id)
 sources.push({id,url:capture.url,capturedAt:capture.capturedAt,responseDate:capture.responseHeaders.Date,sha256:pin,bytes:body.length,retainedPath:root+id+(id==='oneweb'?'.json':'.html')})
 if(id==='oneweb')rows=JSON.parse(body)
 if(id==='space-track-terms'&&!body.toString().includes('express blanket approval for transfer/redistribution'))throw Error('Redistribution approval missing')
}
const study={startUtc:'2026-11-02T10:30:00.000Z',endUtc:'2026-11-02T11:00:00.000Z',initialUtc:'2026-11-02T10:30:00.000Z'},start=Date.parse(study.startUtc),end=Date.parse(study.endUtc),movers=[],exclusionLedger=[],samples=[],seen=new Set()
const numeric=['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT','EPHEMERIS_TYPE','ELEMENT_SET_NO','REV_AT_EPOCH']
const at=(element,t)=>sgp4({...json2satrec(element,'a')},(t-Date.parse(element.EPOCH))/60000)
for(const row of rows){
 const id=String(row.NORAD_CAT_ID);if(seen.has(id))throw Error('Duplicate source identity');seen.add(id)
 const element=Object.fromEntries(['OBJECT_NAME','OBJECT_ID','EPOCH','CLASSIFICATION_TYPE',...numeric].map(k=>[k,row[k]]));element.NORAD_CAT_ID=id;element.EPOCH=row.EPOCH.endsWith('Z')?row.EPOCH:row.EPOCH+'Z'
 let valid=/^[1-9][0-9]{0,8}$/.test(id)&&/^ONEWEB-\d+$/.test(row.OBJECT_NAME)&&/^\d{4}-\d{3}[A-Z]+$/.test(row.OBJECT_ID)&&row.CLASSIFICATION_TYPE==='U'&&row.EPHEMERIS_TYPE===0&&numeric.every(k=>Number.isFinite(row[k]))&&row.MEAN_MOTION>0&&row.ECCENTRICITY>=0&&row.ECCENTRICITY<1&&row.INCLINATION>=0&&row.INCLINATION<=180&&['RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'].every(k=>row[k]>=0&&row[k]<360)
 for(const [k,v] of Object.entries({CENTER_NAME:'EARTH',REF_FRAME:'TEME',TIME_SYSTEM:'UTC',MEAN_ELEMENT_THEORY:'SGP4'})){if(row[k]!==undefined&&row[k]!==v)valid=false;element[k]=v}
 const epoch=Date.parse(element.EPOCH),first=Math.max(start,epoch-86400000),last=Math.min(end,epoch+86400000)
 if(!valid||!Number.isFinite(epoch)){exclusionLedger.push({id,reason:'invalid-elements'});continue}
 if(first>last){exclusionLedger.push({id,epoch:element.EPOCH,reason:'outside-age-window'});continue}
 let failure=null
 for(let t=first;;t=Math.min(last,t+30000)){const pv=at(element,t);if(!pv||![...Object.values(pv.position),...Object.values(pv.velocity)].every(Number.isFinite)){failure=t;break}if(t===last)break}
 if(failure!==null){exclusionLedger.push({id,reason:'propagation-failure',time:new Date(failure).toISOString()});continue}
 movers.push({id,name:row.OBJECT_NAME,element,eligibleStartUtc:new Date(first).toISOString(),eligibleEndUtc:new Date(last).toISOString()})
 for(const time of [...new Set([first,(first+last)/2,last])]){const pv=at(element,time);samples.push({id,element,time,temeKm:pv.position,velocityKmS:pv.velocity,fixedKm:eciToEcf(pv.position,gstime(new Date(time)))})}
}
movers.sort((a,b)=>Number(a.id)-Number(b.id));if(movers.length>1000)throw Error('Constellation budget exceeded; never silently cap')
const normals=movers.map(m=>{const pv=at(m.element,start),r=pv.position,v=pv.velocity,n=[r.y*v.z-r.z*v.y,r.z*v.x-r.x*v.z,r.x*v.y-r.y*v.x],length=Math.hypot(...n);return n.map(x=>x/length)})
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),threshold=Math.cos(Math.PI/180)
let lead=-1,best=0
for(const [i,m] of movers.entries()){const period=1440/m.element.MEAN_MOTION;if(period<108||period>111||m.element.ECCENTRICITY>=.003)continue;const count=normals.filter(n=>dot(n,normals[i])>=threshold).length;if(count>best){best=count;lead=i}}
if(lead<0)throw Error('Featured plane unavailable')
const memberIds=movers.filter((_,i)=>dot(normals[i],normals[lead])>=threshold).map(m=>m.id),featured={id:movers[lead].id,name:movers[lead].name,initialMembers:memberIds.length,memberIds,thresholdDegrees:1,frame:'Propagated TEME angular-momentum normal at initial study UTC.'}
const model={library:'satellite.js',version:'7.1.0',gravity:'WGS72',operationMode:'a',propagationFrame:'TEME',ageLimitHours:24,earthFixedTransform:'TEME to ECF via GMST; world = (x, z, -y) / 6378.137',sampleMode:'Direct propagation from a fresh copy of the frozen baseline at each displayed UTC; no interpolation.'}
const rights={id:'basic-ssa-citation',attribution:'CelesTrak standard GP; USSPACECOM / 18th Space Defense Squadron via Space-Track.org.',reference:'https://www.space-track.org/documentation#/odr',providerPolicy:'https://celestrak.org/usage-policy.php',fields:'Basic GP/OMM fields only. OneWeb group membership and names are provider-supplied. No optional status, availability or service metadata.',changes:'NORAD identities normalized to decimal strings; UTC suffix and documented Earth/TEME/UTC/SGP4 defaults explicit; per-object age bounds added.'}
const statistics={inputRows:rows.length,retainedIdentities:movers.length,excludedIdentities:exclusionLedger.length,capExclusions:0,initialEligible:movers.filter(m=>Date.parse(m.eligibleStartUtc)<=start).length,endEligible:movers.filter(m=>Date.parse(m.eligibleEndUtc)>=end).length}
const {retainedPath:privatePath,...source}=sources.find(s=>s.id==='oneweb')
const release={schemaVersion:1,kind:'constellation-proof',study,source,model,rights,statistics,movers},bytes=JSON.stringify(release)+'\n',sha256=hash(bytes),file='constellation-'+sha256.slice(0,12)+'.json'
await mkdir('public/data/orbital',{recursive:true});await mkdir('work/constellation-proof',{recursive:true})
await writeFile('public/data/orbital/'+file,bytes);await writeFile('src/constellation-release.json',JSON.stringify({file:'./data/orbital/'+file,sha256,records:movers.length,study,sourceSha256:pins.oneweb},null,2)+'\n')
await writeFile('work/constellation-proof/reference-samples.json',JSON.stringify(samples)+'\n')
const report={title:'How a constellation takes shape — bounded visual proof',status:'bounded-visual-proof',sources,study,model,rights,statistics,exclusionLedger,selection:'Every valid, age-eligible identity from one retained CelesTrak OneWeb standard GP group. No visual cap; no active-service or complete-constellation claim.',presentation:{sequence:'One satellite, one measured orientation neighbourhood, all eligible retained identities. Authored reveal at one continuously advancing model UTC; not a deployment history.',plane:'At initial UTC, select the densest 1-degree angular-momentum-normal neighbourhood among near-circular main-shell records (108–111 minute mean period; eccentricity <0.003). Break ties by smallest numeric NORAD identity. All initially eligible records within 1 degree of its normal form the featured neighbourhood; no operator plane identifiers are inferred.',guides:'Optional circular orientation diagrams at sampled radii, using propagated angular-momentum normals. Not observed tracks, trajectories, coverage footprints or communications links.',frame:'Earth-fixed display. Direct SGP4 states; positions, orientation guides, inspection and UTC share the same instant.',scope:'The proof ends at the whole-population reveal. Coverage modelling and ground-location controls remain later work.'},release:{file:'data/orbital/'+file,sha256,bytes:Buffer.byteLength(bytes),gzipBytes:gzipSync(bytes).length},validation:{sampling:'Every retained identity propagated every 30 seconds within its eligibility interval; independent cases at first, middle and last eligible UTC.',independentAgreement:null,physicalPhonePerformance:'Unmeasured. No physical-phone frame-rate claim.'}}
report.presentation.featured=featured
await writeFile('docs/evidence/constellation-proof-2026-11-02.json',JSON.stringify(report,null,2)+'\n')
console.log({file,sha256,...statistics,gzipBytes:report.release.gzipBytes})
