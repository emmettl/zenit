import {gstime,json2satrec,type OMMJsonObject} from 'satellite.js'
import {DEFAULT_OBSERVER,observerKey,type ObserverLocation} from './observer'
import {sampleSurfaceTrails,type SurfaceTrail} from './surface-trails'
import {orbitalState,type Propagator} from './orbital'
export const GROUP_IDS=['stations','gnss','geo'] as const
export type GroupId=typeof GROUP_IDS[number]
export const GROUP_COLOURS:Record<GroupId,[number,number,number]>={stations:[.35,.88,1],gnss:[.72,.71,1],geo:[.93,.61,.39]}
export interface SourceMetadata {objectType:string|null;launchDate:string|null;orbitType:string;orbitCenter:string;source:string}
export interface Mover {id:string;name:string;groups:GroupId[];element:OMMJsonObject;eligibleStartUtc:string;eligibleEndUtc:string;metadata:SourceMetadata|null}
export interface Attachment {id:string;name:string;parentId:string;groups:GroupId[];elementEpoch:string;metadata:SourceMetadata}
export interface Cohorts {schemaVersion:1;kind:'orbital-cohorts';groups:{id:GroupId;label:string;description:string;inputRows:number;retainedMovers:number;initialEligibleMovers:number;attachments:number;excluded:number}[];statistics:{inputRows:number;distinctIdentities:number;duplicateMembershipRows:number;independentMovers:number;initialEligibleMovers:number;attachments:number;excludedIndependentIdentities:number;ceiling:number};movers:Mover[];attachments:Attachment[];exclusionLedger:{id:string;groups:GroupId[];reason:string;parentId?:string}[];study:{startUtc:string;endUtc:string;initialUtc:string};source:{sources:{id:string;sha256:string;responseDateUtc:string}[]};rights:{id:string};model:{version:string;operationMode:string;gravity:string;maximumElementAgeHours:number}}
export interface Population {snapshot:Cohorts;propagators:Propagator[]}
export interface PopulationFrame {observerKey:string;time:number;revision:number;positions:Float64Array;availability:Uint8Array;trailsRequested:boolean;surfaceTrails:SurfaceTrail[]}
export function readCohorts(value:unknown):Cohorts {
  const r=value as Cohorts
  if(!r||r.schemaVersion!==1||r.kind!=='orbital-cohorts'||r.model?.version!=='7.1.0'||r.model.operationMode!=='a'||r.model.gravity!=='WGS72'||r.model.maximumElementAgeHours!==24||r.rights?.id!=='basic-ssa-citation'||!Array.isArray(r.movers)||r.movers.length>1000||r.movers.length!==r.statistics?.independentMovers||r.statistics.ceiling!==1000||!Array.isArray(r.attachments)||r.attachments.length!==r.statistics.attachments||r.groups?.length!==3)throw Error('Unsupported cohort release')
  const start=Date.parse(r.study?.startUtc),end=Date.parse(r.study?.endUtc),initial=Date.parse(r.study?.initialUtc)
  if(![start,end,initial].every(Number.isFinite)||end-start!==43200000||initial<start||initial>end)throw Error('Invalid cohort study')
  const ids=new Set<string>()
  for(const mover of r.movers){const e=mover.element,epoch=Date.parse(e?.EPOCH),first=Date.parse(mover.eligibleStartUtc),last=Date.parse(mover.eligibleEndUtc)
    if(!/^[1-9][0-9]{0,8}$/.test(mover.id)||ids.has(mover.id)||String(e?.NORAD_CAT_ID)!==mover.id||typeof mover.name!=='string'||!Array.isArray(mover.groups)||!mover.groups.length||new Set(mover.groups).size!==mover.groups.length||mover.groups.some(x=>!GROUP_IDS.includes(x))||e.CENTER_NAME!=='EARTH'||e.REF_FRAME!=='TEME'||e.TIME_SYSTEM!=='UTC'||e.MEAN_ELEMENT_THEORY!=='SGP4'||e.EPHEMERIS_TYPE!==0||!e.EPOCH.endsWith('Z'))throw Error('Invalid mover identity, membership or frame')
    for(const key of ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'])if(typeof e[key]!=='number'||!Number.isFinite(e[key]))throw Error('Invalid mover elements')
    if(Number(e.MEAN_MOTION)<=0||Number(e.ECCENTRICITY)<0||Number(e.ECCENTRICITY)>=1||Number(e.INCLINATION)<0||Number(e.INCLINATION)>180||!Number.isFinite(epoch)||first!==Math.max(start,epoch-86400000)||last!==Math.min(end,epoch+86400000)||last<first)throw Error('Invalid mover eligibility')
    ids.add(mover.id)
  }
  const attachments=new Set<string>()
  for(const item of r.attachments){if(ids.has(item.id)||attachments.has(item.id)||!ids.has(item.parentId)||item.metadata?.orbitType!=='DOC'||item.metadata.orbitCenter!==item.parentId||!Number.isFinite(Date.parse(item.elementEpoch)))throw Error('Invalid attachment');attachments.add(item.id)}
  if(r.statistics.distinctIdentities!==r.movers.length+r.attachments.length+r.statistics.excludedIndependentIdentities||r.statistics.inputRows-r.statistics.distinctIdentities!==r.statistics.duplicateMembershipRows)throw Error('Unreconciled population')
  for(const id of GROUP_IDS){const group=r.groups.find(x=>x.id===id);if(!group||group.retainedMovers!==r.movers.filter(x=>x.groups.includes(id)).length||group.attachments!==r.attachments.filter(x=>x.groups.includes(id)).length||group.initialEligibleMovers!==r.movers.filter(x=>x.groups.includes(id)&&Date.parse(x.eligibleStartUtc)<=initial&&Date.parse(x.eligibleEndUtc)>=initial).length)throw Error('Unreconciled group')}
  return r
}
export async function loadCohorts(signal:AbortSignal,manifestPath='./data/zenit-manifest.json'):Promise<Cohorts> {
  const response=await fetch(manifestPath,{signal});if(!response.ok)throw Error('Cohort manifest unavailable')
  const manifest=await response.json(),evidence=manifest.evidence?.orbital
  if(!/^orbital\/cohorts-[a-f0-9]{12}\.json$/.test(evidence?.file)||!/^([a-f0-9]{64})$/.test(evidence?.sha256))throw Error('Cohort release unavailable')
  const payload=await fetch('./data/'+evidence.file,{signal});if(!payload.ok)throw Error('Cohort release unavailable')
  const bytes=await payload.arrayBuffer();if(bytes.byteLength>1000000)throw Error('Cohort payload exceeds bound')
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')
  if(digest!==evidence.sha256)throw Error('Cohort integrity check failed')
  const result=readCohorts(JSON.parse(new TextDecoder().decode(bytes)));if(result.movers.length!==evidence.records||JSON.stringify(result.study)!==JSON.stringify(manifest.study))throw Error('Cohort manifest mismatch')
  return result
}
export function createPopulation(snapshot:Cohorts):Population {return {snapshot,propagators:snapshot.movers.map(mover=>({baseline:json2satrec(mover.element,'a'),epoch:Date.parse(mover.element.EPOCH),start:Date.parse(mover.eligibleStartUtc),end:Date.parse(mover.eligibleEndUtc)}))}}
export function populationFrame(population:Population,time:number,revision=0,trailsRequested=false,observer:ObserverLocation=DEFAULT_OBSERVER):PopulationFrame {
  if(!Number.isFinite(time)||time<Date.parse(population.snapshot.study.startUtc)||time>Date.parse(population.snapshot.study.endUtc))throw Error('Sample outside the frozen study')
  const rotation=gstime(new Date(time))
  const positions=new Float64Array(population.propagators.length*3),availability=new Uint8Array(population.propagators.length)
  population.propagators.forEach((propagator,i)=>{if(time<propagator.start||time>propagator.end)return;const state=orbitalState(propagator,time,rotation);if(!state){availability[i]=2;return}availability[i]=1;positions.set(state.world.toArray(),i*3)})
  const frame:PopulationFrame={observerKey:observerKey(observer),time,revision,positions,availability,trailsRequested,surfaceTrails:[]}
  if(trailsRequested)frame.surfaceTrails=sampleSurfaceTrails(population,frame,observer)
  return frame
}
export function enabledMover(mover:Mover,groups:readonly GroupId[]):boolean {return mover.groups.some(x=>groups.includes(x))}
export function groupColour(mover:Mover):[number,number,number] {if(mover.groups.length===1)return GROUP_COLOURS[mover.groups[0]];return [.65,.88,.72]}
