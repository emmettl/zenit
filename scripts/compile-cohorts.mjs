/** Offline cohort compilation from retained, pinned source-probe bodies. */
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {json2satrec,sgp4} from 'satellite.js'
const root='work/sources/cohorts-2026-10-07/'
const capture=JSON.parse(await readFile(root+'capture.json','utf8'))
const manifest=JSON.parse(await readFile('public/data/zenit-manifest.json','utf8'))
const issEvidence=manifest.evidence.iss??manifest.evidence.orbital
const story=JSON.parse(await readFile('public/data/'+issEvidence.file,'utf8'))
const study=story.study,start=Date.parse(study.startUtc),end=Date.parse(study.endUtc),initial=Date.parse(study.initialUtc)
const hashes={stations:'9a8dd20063818e9782e17cc0fbb363bb9687fd38bc4df0416c7ec7deec0cbe0c',gnss:'a36af6fab6f198e9fd9e605bd968b1b4b39b937631dc343c76146e98dc67255a',geo:'e9b64b76fa4b2133c6f3cce1a30d5fd89894fc0ba53a7689ae09525ef61e1ad1','stations-satcat':'60140c6a1d8b9902bfb9019be85bd43ef4cbc6d67d6dd41da4bded6b3d64d8b2'}
const sources=[],groups=[{id:'stations',label:'Stations',description:'CelesTrak stations group; includes independent payloads and debris.'},{id:'gnss',label:'Navigation',description:'CelesTrak GNSS group; includes medium and geosynchronous orbits.'},{id:'geo',label:'Geosynchronous',description:'CelesTrak active geosynchronous group; inclined/eccentric members remain distinct.'}],identities=new Map()
async function source(name){const file=name.includes('satcat')?name+'.json':name+'-gp.json',body=await readFile(root+file),hash=createHash('sha256').update(body).digest('hex');if(hash!==hashes[name])throw Error('Source hash mismatch: '+name);const audit=capture.samples.find(x=>x.sample===(name.includes('satcat')?name:name+'-gp'));sources.push({id:name,url:audit.url,responseDateUtc:audit.responseDateUtc,sha256:hash,bytes:body.byteLength,exactAcquisitionTimeUtc:null,retention:'Original source probe; exact local acquisition timestamp not recorded. Server response Date is distinct from epoch and later retention time.'});return JSON.parse(body)}
const ledger=[]
for(const group of groups){const rows=await source(group.id);group.inputRows=rows.length;const seen=new Set();for(const row of rows){const id=String(row.NORAD_CAT_ID);if(seen.has(id))throw Error('Duplicate within group');seen.add(id);const element={...row,NORAD_CAT_ID:id,EPOCH:row.EPOCH.endsWith('Z')?row.EPOCH:row.EPOCH+'Z',CENTER_NAME:'EARTH',REF_FRAME:'TEME',TIME_SYSTEM:'UTC',MEAN_ELEMENT_THEORY:'SGP4'};let entry=identities.get(id);if(!entry){entry={id,name:row.OBJECT_NAME,groups:[],element,sourceGroups:[]};identities.set(id,entry)}entry.groups.push(group.id);entry.sourceGroups.push(group.id);if(Date.parse(element.EPOCH)>Date.parse(entry.element.EPOCH))entry.element=element}}
const metadata=await source('stations-satcat'),joined=new Map(metadata.map(x=>[String(x.NORAD_CAT_ID),x]))
if(joined.size!==metadata.length)throw Error('Duplicate SATCAT identity')
const attachments=[],movers=[]
for(const entry of identities.values()){
 const meta=entry.groups.includes('stations')?joined.get(entry.id):null
 if(entry.groups.includes('stations')&&!meta)throw Error('Unmatched station SATCAT identity')
 entry.metadata=meta?{objectType:meta.OBJECT_TYPE??null,launchDate:meta.LAUNCH_DATE??null,orbitType:meta.ORBIT_TYPE,orbitCenter:String(meta.ORBIT_CENTER),source:'stations-satcat'}:null
 if(meta?.ORBIT_TYPE==='DOC'){
  const parentId=String(meta.ORBIT_CENTER);if(!identities.has(parentId))throw Error('Attachment parent absent')
  attachments.push({id:entry.id,name:entry.name,parentId,groups:entry.groups,elementEpoch:entry.element.EPOCH,metadata:entry.metadata});ledger.push({id:entry.id,groups:entry.groups,reason:'attachment',parentId});continue
 }
 if(meta&&(meta.ORBIT_TYPE!=='ORB'||meta.ORBIT_CENTER!=='EA')){ledger.push({id:entry.id,groups:entry.groups,reason:'unsupported-orbit-center'});continue}
 const e=entry.element,epoch=Date.parse(e.EPOCH)
 if(!Number.isFinite(epoch)||e.EPHEMERIS_TYPE!==0||!['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'].every(k=>Number.isFinite(e[k]))||e.MEAN_MOTION<=0||e.ECCENTRICITY<0||e.ECCENTRICITY>=1||e.INCLINATION<0||e.INCLINATION>180){ledger.push({id:entry.id,groups:entry.groups,reason:'invalid-elements'});continue}
 const eligibleStart=Math.max(start,epoch-86400000),eligibleEnd=Math.min(end,epoch+86400000)
 if(eligibleEnd<eligibleStart){ledger.push({id:entry.id,groups:entry.groups,reason:'outside-age-window',epoch:e.EPOCH});continue}
 const baseline=json2satrec(e,'a');let failure=null
 for(let time=eligibleStart;time<=eligibleEnd;time+=60000){const value=sgp4({...baseline},(time-epoch)/60000);if(!value||!Object.values(value.position).every(Number.isFinite)){failure=time;break}}
 if(failure!==null){ledger.push({id:entry.id,groups:entry.groups,reason:'propagation-failure',firstFailedSampleUtc:new Date(failure).toISOString()});continue}
 movers.push({...entry,eligibleStartUtc:new Date(eligibleStart).toISOString(),eligibleEndUtc:new Date(eligibleEnd).toISOString()})
}
movers.sort((a,b)=>Number(a.id)-Number(b.id));attachments.sort((a,b)=>Number(a.id)-Number(b.id))
if(movers.length>1000)throw Error('Population exceeds the 1,000-mover ceiling; no undisclosed cap is allowed')
const iss=movers.find(x=>x.id==='25544');if(!iss)throw Error('ISS missing');if(JSON.stringify(iss.element)!==JSON.stringify(story.elements[0]))throw Error('Cohort ISS differs from the retained pass element set')
for(const group of groups){group.retainedMovers=movers.filter(x=>x.groups.includes(group.id)).length;group.initialEligibleMovers=movers.filter(x=>x.groups.includes(group.id)&&Date.parse(x.eligibleStartUtc)<=initial&&Date.parse(x.eligibleEndUtc)>=initial).length;group.attachments=attachments.filter(x=>x.groups.includes(group.id)).length;group.excluded=ledger.filter(x=>x.groups.includes(group.id)&&x.reason!=='attachment').length}
const statistics={inputRows:groups.reduce((n,g)=>n+g.inputRows,0),distinctIdentities:identities.size,duplicateMembershipRows:groups.reduce((n,g)=>n+g.inputRows,0)-identities.size,independentMovers:movers.length,initialEligibleMovers:movers.filter(x=>Date.parse(x.eligibleStartUtc)<=initial&&Date.parse(x.eligibleEndUtc)>=initial).length,attachments:attachments.length,excludedIndependentIdentities:ledger.filter(x=>x.reason!=='attachment').length,ceiling:1000,capExclusions:0,missingStationMetadata:0}
if(statistics.independentMovers+statistics.attachments+statistics.excludedIndependentIdentities!==statistics.distinctIdentities)throw Error('Population does not reconcile')
const release={schemaVersion:1,kind:'orbital-cohorts',source:{provider:'CelesTrak standard GP and selected SATCAT fields',upstream:'USSPACECOM / 18 SDS via Space-Track',sources},rights:{id:'basic-ssa-citation',reference:'https://www.space-track.org/documentation#/odr',providerPolicy:'https://celestrak.org/usage-policy.php',attribution:'CelesTrak; USSPACECOM / 18th Space Defense Squadron via Space-Track.org.',fieldProvenance:'GP elements and catalogue fields are attributed to their source. Group membership and docking relationships are provider-supplied snapshot facts, not reconstructed historical events. Operating-status enrichment is omitted.'},study,model:{...story.model,selection:'Latest epoch per decimal-string NORAD ID. Ties preserve source order stations, gnss, geo. Keep all source group memberships; one moving glyph per independent identity. Exclude attachments from independent propagation, expose them under their parent. Age eligibility can change across the frozen study.',attachmentPolicy:'Frozen SATCAT attachment relationship across the study; no docking/undocking history reconstructed.',eligibility:'Absolute element offset <= 24 hours, intersected with the declared study window. Source age does not supply covariance or a guaranteed positional error.'},groups,statistics,movers,attachments,exclusionLedger:ledger}
const encoded=JSON.stringify(release)+'\n',sha256=createHash('sha256').update(encoded).digest('hex'),file='cohorts-'+sha256.slice(0,12)+'.json'
await mkdir('public/data/orbital',{recursive:true});await writeFile('public/data/orbital/'+file,encoded)
const notice=await readFile('public/data/orbital/NOTICE.txt','utf8');const extra='\nCohort release: retained 7 October 2026 stations, GNSS and active geosynchronous GP inputs, with selected stations SATCAT fields. Group membership and attachment relationships are frozen provider snapshot facts, not complete orbital regimes or a docking history. Deduplicated by NORAD identity and latest epoch; all memberships retained; docked records attached to parents; invalid, expired and failed records recorded in the exclusion ledger. No optional operating-status enrichment is included.\n'
if(!notice.includes('Cohort release:'))await writeFile('public/data/orbital/NOTICE.txt',notice+extra)
manifest.status='orbital-families';manifest.evidence.iss=issEvidence;manifest.evidence.orbital={status:'cohorts',records:movers.length,initialEligibleRecords:statistics.initialEligibleMovers,attachments:attachments.length,file:'orbital/'+file,sha256,source:'CelesTrak stations / GNSS / active geosynchronous',notice:'orbital/NOTICE.txt'};manifest.scene='A bounded, deduplicated three-family orbital population, the HYG reference sky and retained Sydney ISS pass.';manifest.population=statistics
await writeFile('public/data/zenit-manifest.json',JSON.stringify(manifest,null,2)+'\n');await writeFile('docs/evidence/cohorts-release-2026-10-08.json',JSON.stringify({source:release.source,rights:release.rights,model:release.model,groups,statistics,exclusionLedger:ledger,release:{file:'data/orbital/'+file,sha256,bytes:Buffer.byteLength(encoded)}},null,2)+'\n')
console.log(JSON.stringify({file,sha256,statistics,groups},null,2))
