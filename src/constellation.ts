import {Vector3} from 'three'
import {json2satrec,type OMMJsonObject} from 'satellite.js'
import {orbitalState,type Propagator} from './orbital'
import index from './constellation-release.json' with {type:'json'}
import large from './large-constellation-releases.json' with {type:'json'}
export const CONSTELLATIONS={oneweb:{...index,label:'OneWeb',namePattern:'^ONEWEB-[0-9]+$',statistics:{inputRows:651,retainedIdentities:647,excludedIdentities:4,capExclusions:0,initialEligible:647,endEligible:643},maximumMovers:1000,maximumBytes:750000},...large}
export type ConstellationId=keyof typeof CONSTELLATIONS
export const validConstellation=(id:string):id is ConstellationId=>Object.hasOwn(CONSTELLATIONS,id)
export interface FeaturedPlane {id:string;memberIds:string[];thresholdDegrees:number;epochUtc:string;selection:string;guideIds:string[]}
export interface ConstellationMover {id:string;name:string;element:OMMJsonObject;eligibleStartUtc:string;eligibleEndUtc:string}
export interface ConstellationRelease {schemaVersion:number;kind:string;constellation?:ConstellationId;featured?:FeaturedPlane;study:typeof index.study;source:{sha256:string};rights:{id:string};model:{library:string;version:string;gravity:string;operationMode:string;propagationFrame:string;ageLimitHours:number};statistics:{inputRows:number;retainedIdentities:number;excludedIdentities:number;capExclusions:number;initialEligible:number;endEligible:number};movers:ConstellationMover[]}
export interface ConstellationOrbit extends Propagator {mover:ConstellationMover}
export function readConstellation(value:unknown,id:ConstellationId='oneweb'):ConstellationRelease {
 const r=value as ConstellationRelease,index=CONSTELLATIONS[id]
 if(r?.schemaVersion!==1||r.kind!=='constellation-proof'||JSON.stringify(r.study)!==JSON.stringify(index.study)||r.source?.sha256!==index.sourceSha256||r.rights?.id!=='basic-ssa-citation'||r.model?.library!=='satellite.js'||r.model.version!=='7.1.0'||r.model.gravity!=='WGS72'||r.model.operationMode!=='a'||r.model.propagationFrame!=='TEME'||r.model.ageLimitHours!==24||!Array.isArray(r.movers)||r.movers.length!==index.records||r.movers.length>index.maximumMovers||r.statistics?.retainedIdentities!==r.movers.length||r.statistics.inputRows!==index.statistics.inputRows||r.statistics.excludedIdentities!==index.statistics.excludedIdentities||r.statistics.capExclusions!==0)throw Error('Unsupported constellation release')
 const ids=new Set<string>(),start=Date.parse(r.study.startUtc),end=Date.parse(r.study.endUtc)
 for(const m of r.movers){const e=m.element,ep=Date.parse(e?.EPOCH),first=Date.parse(m.eligibleStartUtc),last=Date.parse(m.eligibleEndUtc)
  if(!/^[1-9][0-9]{0,8}$/.test(m.id)||ids.has(m.id)||e.NORAD_CAT_ID!==m.id||!new RegExp(index.namePattern).test(m.name)||m.name!==e.OBJECT_NAME||!/^\d{4}-\d{3}[A-Z]+$/.test(e.OBJECT_ID)||e.CENTER_NAME!=='EARTH'||e.REF_FRAME!=='TEME'||e.TIME_SYSTEM!=='UTC'||e.MEAN_ELEMENT_THEORY!=='SGP4'||e.CLASSIFICATION_TYPE!=='U'||e.EPHEMERIS_TYPE!==0||!e.EPOCH.endsWith('Z')||!Number.isFinite(ep)||first!==Math.max(start,ep-86400000)||last!==Math.min(end,ep+86400000)||first>last)throw Error('Invalid constellation identity or eligibility')
  for(const k of ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'])if(typeof e[k]!=='number'||!Number.isFinite(e[k]))throw Error('Invalid constellation elements')
  if(Number(e.MEAN_MOTION)<=0||Number(e.ECCENTRICITY)<0||Number(e.ECCENTRICITY)>=1||Number(e.INCLINATION)<0||Number(e.INCLINATION)>180||['RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'].some(k=>Number(e[k])<0||Number(e[k])>=360))throw Error('Invalid constellation element range')
  ids.add(m.id)
 }
 if(r.statistics.initialEligible!==r.movers.filter(m=>Date.parse(m.eligibleStartUtc)<=start).length||r.statistics.endEligible!==r.movers.filter(m=>Date.parse(m.eligibleEndUtc)>=end).length)throw Error('Unreconciled constellation population')
 if(id!=='oneweb'){const f=r.featured;if(r.constellation!==id||!f||f.thresholdDegrees!==1||f.epochUtc!==r.study.startUtc||!ids.has(f.id)||!f.memberIds.includes(f.id)||new Set(f.memberIds).size!==f.memberIds.length||f.memberIds.some(id=>!ids.has(id))||f.guideIds.length>24||f.guideIds[0]!==f.id||new Set(f.guideIds).size!==f.guideIds.length||f.guideIds.some(id=>!ids.has(id)))throw Error('Invalid retained plane neighbourhood')}
 return r
}
export async function loadConstellation(signal:AbortSignal,id:ConstellationId='oneweb',root=new URL('../',document.baseURI)){
 const index=CONSTELLATIONS[id]
 if(!/^\.\/data\/orbital\/constellation-[a-f0-9]{12}\.json$/.test(index.file))throw Error('Invalid constellation path')
 const response=await fetch(new URL(index.file,root),{signal});if(!response.ok)throw Error('Constellation snapshot unavailable')
 const bytes=await response.arrayBuffer();if(bytes.byteLength>index.maximumBytes)throw Error('Constellation snapshot size limit')
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')
 if(digest!==index.sha256)throw Error('Constellation integrity check failed')
 return readConstellation(JSON.parse(new TextDecoder().decode(bytes)),id)
}
export function constellationOrbits(release:ConstellationRelease):ConstellationOrbit[]{return release.movers.map(m=>({mover:m,baseline:json2satrec(m.element,'a'),epoch:Date.parse(m.element.EPOCH),start:Date.parse(m.eligibleStartUtc),end:Date.parse(m.eligibleEndUtc)}))}
export function constellationState(orbit:ConstellationOrbit,time:number,gmst?:number){
 const state=orbitalState(orbit,time,gmst);if(!state)return null
 const r=new Vector3(state.teme.x,state.teme.y,state.teme.z),v=new Vector3(state.velocity.x,state.velocity.y,state.velocity.z)
 return {...state,normal:r.cross(v).normalize()}
}
export function featuredPlane(orbits:ConstellationOrbit[],time:number,retained?:FeaturedPlane){
 if(retained){const byId=new Map(orbits.map((o,i)=>[o.mover.id,i])),lead=byId.get(retained.id)!,members=retained.memberIds.map(id=>byId.get(id)!),normal=constellationState(orbits[lead],time)?.normal;if(!normal)throw Error('Featured plane unavailable at opening UTC');return {lead,members,normal}}
 const normals=orbits.map(o=>constellationState(o,time)?.normal??null),threshold=Math.cos(Math.PI/180)
 let lead=-1,best=0
 for(let i=0;i<orbits.length;i++){
  const e=orbits[i].mover.element,period=1440/Number(e.MEAN_MOTION)
  if(!normals[i]||period<108||period>111||Number(e.ECCENTRICITY)>=.003)continue
  const count=normals.filter(n=>n&&n.dot(normals[i]!)>=threshold).length
  if(count>best||(count===best&&(lead<0||Number(orbits[i].mover.id)<Number(orbits[lead].mover.id)))){best=count;lead=i}
 }
 if(lead<0)throw Error('No eligible near-circular plane neighbourhood')
 const members=normals.map((n,i)=>n&&n.dot(normals[lead]!)>=threshold?i:-1).filter(i=>i>=0)
 return {lead,members,normal:normals[lead]!.clone()}
}
