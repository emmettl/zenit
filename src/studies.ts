import raw from './study-windows.json'
import {loadOrbit,readOrbit,type Orbit} from './orbital'
import {loadCohorts,readCohorts,type Cohorts} from './cohorts'
import type {StationPass} from './pass-search.mjs'
export interface StudyWindow {id:string;label:string;manifest:string;manifestSha256?:string;study:{startUtc:string;endUtc:string;initialUtc:string};sequences:Record<string,StationPass>}
export const STUDIES=raw.windows as unknown as StudyWindow[]
export const stationName=(id:string,name?:string)=>id==='25544'?'ISS':id==='48274'?'Tiangong / Tianhe':name??'Station'
export async function loadStudy(window:StudyWindow,signal:AbortSignal):Promise<{orbit:Orbit;cohorts:Cohorts}>{
 if(!window.manifestSha256)return {orbit:await loadOrbit(signal),cohorts:await loadCohorts(signal)}
 const response=await fetch(window.manifest,{signal});if(!response.ok)throw Error('Dated window unavailable');const bytes=await response.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(digest!==window.manifestSha256)throw Error('Dated window integrity failed')
 const manifest=JSON.parse(new TextDecoder().decode(bytes));if(JSON.stringify(manifest.study)!==JSON.stringify(window.study))throw Error('Dated window mismatch')
 const get=async(kind:'iss'|'orbital')=>{const e=manifest.evidence[kind];if(!/^orbital\/(iss|cohorts)-[a-f0-9]{12}\.json$/.test(e.file)||!/^([a-f0-9]{64})$/.test(e.sha256))throw Error('Unsupported dated source');const r=await fetch('./data/'+e.file,{signal});if(!r.ok)throw Error('Dated payload unavailable');const b=await r.arrayBuffer();if(b.byteLength>1000000)throw Error('Dated payload size');const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');if(h!==e.sha256)throw Error('Dated payload integrity failed');return JSON.parse(new TextDecoder().decode(b))}
 const [iss,coh]=await Promise.all([get('iss'),get('orbital')]),orbit=readOrbit(iss),cohorts=readCohorts(coh);if(JSON.stringify(orbit.release.study)!==JSON.stringify(window.study)||JSON.stringify(cohorts.study)!==JSON.stringify(window.study)||cohorts.movers.length!==manifest.evidence.orbital.records||JSON.stringify(cohorts.movers.find(x=>x.id==='25544')?.element)!==JSON.stringify(orbit.release.elements[0]))throw Error('Conflicting dated release');return{orbit,cohorts}
}
