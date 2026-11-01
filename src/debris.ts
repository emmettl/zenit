import index from './debris-release.json'
export interface DebrisMover {id:string;name:string;group:'iridium-33'|'cosmos-2251';role:'original-catalogue-identity'|'debris-labelled-record';element:Record<string,string|number>;eligibleStartUtc:string;eligibleEndUtc:string}
export interface DebrisRelease {schemaVersion:number;kind:string;study:{startUtc:string;endUtc:string;initialUtc:string};groups:{id:DebrisMover['group'];label:string;parentId:string;colour:string;initialEligibleRecords:number;endEligibleRecords:number}[];model:{library:string;version:string;gravity:string;operationMode:string;propagationFrame:string;ageLimitHours:number};rights:{id:string};movers:DebrisMover[];statistics:{inputRows:number;retainedIdentities:number;excludedIdentities:number;capExclusions:number};sources:{id:string;sha256:string}[]}
const families={'iridium-33':{name:'IRIDIUM 33',prefix:'1997-051',parent:'24946',source:'748a8d806094a8afac6b8f3002b4656d443ee098bf34d6368404e19c551b5576'},'cosmos-2251':{name:'COSMOS 2251',prefix:'1993-036',parent:'22675',source:'33994dd25bccd8388d13ba86ad16d89961d54310f02f71abdfd404c9fb9ff2c6'}}
export function readDebris(value:unknown):DebrisRelease {
 const r=value as DebrisRelease,start=Date.parse(r?.study?.startUtc),end=Date.parse(r?.study?.endUtc)
 if(r?.schemaVersion!==1||r.kind!=='debris-chapter'||JSON.stringify(r.study)!==JSON.stringify(index.study)||end-start!==1800000||r.model?.library!=='satellite.js'||r.model.version!=='7.1.0'||r.model.gravity!=='WGS72'||r.model.operationMode!=='a'||r.model.propagationFrame!=='TEME'||r.model.ageLimitHours!==24||r.rights?.id!=='basic-ssa-citation'||!Array.isArray(r.movers)||r.movers.length!==index.records||r.statistics?.retainedIdentities!==r.movers.length||r.statistics.inputRows!==694||r.statistics.excludedIdentities!==232||r.statistics.capExclusions!==0)throw Error('Unsupported debris release')
 if(!Array.isArray(r.groups)||r.groups.length!==2||new Set(r.groups.map(g=>g.id)).size!==2||!Array.isArray(r.sources)||r.sources.length!==2)throw Error('Invalid debris families')
 for(const [id,family] of Object.entries(families)){if(!r.groups.some(g=>g.id===id&&g.parentId===family.parent)||!r.sources.some(s=>s.id===id&&s.sha256===family.source))throw Error('Unverified debris association')}
 const ids=new Set<string>()
 for(const m of r.movers){const f=families[m.group],e=m.element,epoch=Date.parse(String(e?.EPOCH)),first=Date.parse(m.eligibleStartUtc),last=Date.parse(m.eligibleEndUtc)
  if(!Object.hasOwn(families,m.group)||!f||!/^\d{1,9}$/.test(m.id)||ids.has(m.id)||e.NORAD_CAT_ID!==m.id||m.name!==e.OBJECT_NAME||!String(e.OBJECT_ID).startsWith(f.prefix)||m.name!==(m.id===f.parent?f.name:f.name+' DEB')||m.role!==(m.id===f.parent?'original-catalogue-identity':'debris-labelled-record')||e.CENTER_NAME!=='EARTH'||e.REF_FRAME!=='TEME'||e.TIME_SYSTEM!=='UTC'||e.MEAN_ELEMENT_THEORY!=='SGP4'||e.CLASSIFICATION_TYPE!=='U'||e.EPHEMERIS_TYPE!==0||!String(e.EPOCH).endsWith('Z')||!Number.isFinite(epoch)||first!==Math.max(start,epoch-86400000)||last!==Math.min(end,epoch+86400000)||first>last)throw Error('Invalid debris identity, frame or eligibility')
  for(const key of ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'])if(typeof e[key]!=='number'||!Number.isFinite(e[key]))throw Error('Invalid debris elements')
  if(Number(e.MEAN_MOTION)<=0||Number(e.ECCENTRICITY)<0||Number(e.ECCENTRICITY)>=1||Number(e.INCLINATION)<0||Number(e.INCLINATION)>180||['RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'].some(k=>Number(e[k])<0||Number(e[k])>=360))throw Error('Invalid debris element range')
  ids.add(m.id)
 }
 for(const g of r.groups){const members=r.movers.filter(m=>m.group===g.id);if(!members.some(m=>m.id===g.parentId)||g.initialEligibleRecords!==members.filter(m=>Date.parse(m.eligibleStartUtc)<=start&&Date.parse(m.eligibleEndUtc)>=start).length||g.endEligibleRecords!==members.filter(m=>Date.parse(m.eligibleStartUtc)<=end&&Date.parse(m.eligibleEndUtc)>=end).length)throw Error('Unreconciled debris family')}
 return r
}
export async function loadDebris(signal:AbortSignal,root=new URL('../',document.baseURI)):Promise<DebrisRelease>{
 if(!/^\.\/data\/orbital\/cohorts-[a-f0-9]{12}\.json$/.test(index.file))throw Error('Invalid debris source path')
 const response=await fetch(new URL(index.file,root),{signal});if(!response.ok)throw Error('Debris study unavailable')
 const bytes=await response.arrayBuffer();if(bytes.byteLength>750000)throw Error('Debris study size limit')
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(digest!==index.sha256)throw Error('Debris study integrity failed')
 return readDebris(JSON.parse(new TextDecoder().decode(bytes)))
}
