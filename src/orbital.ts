import {eciToEcf, ecfToLookAngles, gstime, json2satrec, sgp4, type OMMJsonObject, type SatRec} from 'satellite.js'
import {Vector3} from 'three'
import {EARTH_RADIUS_KM, OBSERVER} from './camera'
import type {ObserverLocation} from './observer'
export interface OrbitalRelease {
  schemaVersion: number; kind: string
  source: {provider: string; upstream: string; capturedAt: string; sha256: string; url: string}
  rights: {id: string}; elements: OMMJsonObject[]
  model: {version: string; gravity: string; operationMode: string; maximumElementAgeHours: number; trailSeconds: number; trailSampleSeconds: number}
  observer: {name: string; latitude: number; longitude: number; heightKm: number}
  study: {startUtc: string; endUtc: string; initialUtc: string}
  pass: {riseUtc: string; peakUtc: string; setUtc: string; maximumElevationDegrees: number; peakAzimuthDegrees: number; solarAltitudeDegrees: number}
}
export interface Propagator {baseline: SatRec; epoch: number; start: number; end: number}
export interface Orbit extends Propagator {release: OrbitalRelease}
export function readOrbit(value: unknown): Orbit {
  const r=value as OrbitalRelease
  if(!r||r.schemaVersion!==1||r.kind!=='orbital-snapshot'||r.elements?.length!==1||r.rights?.id!=='basic-ssa-citation'||r.model?.version!=='7.1.0'||r.model.gravity!=='WGS72'||r.model.operationMode!=='a'||r.model.maximumElementAgeHours!==24||r.model.trailSeconds!==60||r.model.trailSampleSeconds!==2)throw Error('Unsupported orbital release')
  const e=r.elements[0]
  if(String(e.NORAD_CAT_ID)!=='25544'||e.CENTER_NAME!=='EARTH'||e.REF_FRAME!=='TEME'||e.TIME_SYSTEM!=='UTC'||e.MEAN_ELEMENT_THEORY!=='SGP4'||!e.EPOCH.endsWith('Z')||e.EPHEMERIS_TYPE!==0)throw Error('Unsupported orbital frame or identity')
  for(const key of ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'])if(typeof e[key]!=='number'||!Number.isFinite(e[key]))throw Error('Invalid mean elements')
  if(Number(e.MEAN_MOTION)<=0||Number(e.ECCENTRICITY)<0||Number(e.ECCENTRICITY)>=1||Number(e.INCLINATION)<0||Number(e.INCLINATION)>180)throw Error('Invalid mean element range')
  for(const key of ['RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'])if(Number(e[key])<0||Number(e[key])>=360)throw Error('Invalid mean angle')
  if(r.observer?.name!==OBSERVER.name||r.observer.latitude!==OBSERVER.latitude||r.observer.longitude!==OBSERVER.longitude||r.observer.heightKm!==OBSERVER.heightKm)throw Error('Observer does not match composition')
  const epoch=Date.parse(e.EPOCH),start=Date.parse(r.study?.startUtc),end=Date.parse(r.study?.endUtc),initial=Date.parse(r.study?.initialUtc),peak=Date.parse(r.pass?.peakUtc),rise=Date.parse(r.pass?.riseUtc),set=Date.parse(r.pass?.setUtc)
  if(![epoch,start,end,initial,peak,rise,set].every(Number.isFinite)||end-start!==43200000||initial<start||initial>end||!(start<rise&&rise<peak&&peak<set&&set<end)||Math.max(Math.abs(start-epoch),Math.abs(end-epoch))>86400000||r.pass.solarAltitudeDegrees>=-6)throw Error('Invalid study interval or pass')
  if(![r.pass.maximumElevationDegrees,r.pass.peakAzimuthDegrees,r.pass.solarAltitudeDegrees].every(Number.isFinite)||r.pass.maximumElevationDegrees<20||r.pass.maximumElevationDegrees>90||r.pass.peakAzimuthDegrees<0||r.pass.peakAzimuthDegrees>=360||r.pass.solarAltitudeDegrees< -90)throw Error('Invalid pass direction')
  const baseline=json2satrec(e,'a')
  if(baseline.error||!sgp4({...baseline},0))throw Error('Unpropagatable element set')
  return {release:r,baseline,epoch,start,end}
}
export async function loadOrbit(signal: AbortSignal,manifestPath='./data/zenit-manifest.json'): Promise<Orbit> {
  const response=await fetch(manifestPath,{signal});if(!response.ok)throw Error('Orbital manifest unavailable')
  const manifest=await response.json(),evidence=manifest.evidence?.iss??manifest.evidence?.orbital
  if(!/^orbital\/iss-[a-f0-9]{12}\.json$/.test(evidence?.file)||!/^([a-f0-9]{64})$/.test(evidence?.sha256)||evidence.records!==1)throw Error('Orbital release unavailable')
  const payload=await fetch('./data/'+evidence.file,{signal});if(!payload.ok)throw Error('Orbital release unavailable')
  const bytes=await payload.arrayBuffer();if(bytes.byteLength>100000)throw Error('Orbital release too large')
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')
  if(digest!==evidence.sha256)throw Error('Orbital integrity check failed')
  const orbit=readOrbit(JSON.parse(new TextDecoder().decode(bytes)))
  if(JSON.stringify(manifest.study)!==JSON.stringify(orbit.release.study))throw Error('Study does not match orbital release')
  return orbit
}
export function orbitalState(orbit: Propagator,time: number,earthRotation?:number) {
  if(!Number.isFinite(time)||time<orbit.start||time>orbit.end||Math.abs(time-orbit.epoch)>86400000)return null
  // SGP4 mutates its record. Every sample starts from the same frozen initial state.
  const pv=sgp4({...orbit.baseline},(time-orbit.epoch)/60000)
  if(!pv||![...Object.values(pv.position),...Object.values(pv.velocity)].every(Number.isFinite))return null
  const fixed=eciToEcf(pv.position,earthRotation??gstime(new Date(time)))
  return {teme:pv.position,velocity:pv.velocity,fixed,world:new Vector3(fixed.x,fixed.z,-fixed.y).divideScalar(EARTH_RADIUS_KM)}
}
export function orbitalPosition(orbit: Propagator,time: number,observer:ObserverLocation=OBSERVER) {
  const state=orbitalState(orbit,time);if(!state)return null
  const look=ecfToLookAngles({latitude:observer.latitude*Math.PI/180,longitude:observer.longitude*Math.PI/180,height:observer.heightKm},state.fixed)
  return {...state,altitude:look.elevation*180/Math.PI,azimuth:look.azimuth*180/Math.PI,rangeKm:look.rangeSat,ageHours:(time-orbit.epoch)/3600000}
}

export function orbitalTrailSamples(orbit: Propagator,time: number) {
  const points: {time:number;world:Vector3}[]=[]
  for(let seconds=60;seconds>=0;seconds-=2){const sample=orbitalPosition(orbit,time-seconds*1000);if(sample)points.push({time:time-seconds*1000,world:sample.world})}
  return points
}
export function orbitalTrail(orbit:Propagator,time:number):Vector3[]{return orbitalTrailSamples(orbit,time).map(x=>x.world)}
export function advanceStudy(time: number,elapsed: number,rate: number,start: number,end: number) {
  const current=Math.max(start,Math.min(end,time)),span=end-start,delta=Math.max(0,elapsed)*rate
  if(span<=0||!Number.isFinite(delta))return current
  const next=current+delta
  if(delta>0&&next>=end)return start+(next-start)%span
  if(delta<0&&next<=start)return end-(start-next)%span
  return next
}
export function utcLabel(time: number) {return new Date(time).toISOString().replace('T',' ').slice(0,19)+' UTC'}
