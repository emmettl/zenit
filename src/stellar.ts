import { Body, GeoVector, MakeTime, Observer, RotateVector, Rotation_EQJ_HOR, Vector as AstroVector } from 'astronomy-engine'
import { Matrix4, Vector3 } from 'three'
import { OBSERVER, POLAR_RATIO, observerNormal } from './camera'

export const SKY_TIME = '2026-10-07T21:00:00Z'
export interface Star {
  id: string; hyg: number; name: string | null; designation: string | null
  hip: string | null; hd: string | null; hr: string | null; gl: string | null
  ra: number; dec: number; mag: number; bv: number | null; distance: number | null
  spectral: string | null; pmra: number | null; pmdec: number | null
  variable: string | null; minMag: number | null; maxMag: number | null
  component: number | null; primary: number | null
}
export interface Catalogue { stars: Star[]; source: { version: string; revision: string }; epoch: number }
const fields = ['id','hyg','name','designation','hip','hd','hr','gl','ra','dec','mag','bv','distance','spectral','pmra','pmdec','variable','minMag','maxMag','component','primary'] as const
const optionalNumbers = ['bv','distance','pmra','pmdec','minMag','maxMag','component','primary'] as const
const optionalStrings = ['name','designation','hip','hd','hr','gl','spectral','variable'] as const

export function readCatalogue(value: unknown): Catalogue {
  if (!value || typeof value !== 'object') throw new Error('Stellar catalogue is unavailable')
  const raw = value as Record<string, unknown>
  const source = raw.source as Catalogue['source']
  const stats = raw.statistics as { selectedRecords: number }
  const selection = raw.selection as { maximumVisualMagnitude: number }
  if (raw.schemaVersion !== 1 || raw.kind !== 'stellar-catalogue' || raw.frame !== 'J2000 mean equatorial' || raw.epoch !== 2000 || source?.version !== '4.4' ||
    !Array.isArray(raw.fields) || JSON.stringify(raw.fields) !== JSON.stringify(fields) || !Array.isArray(raw.rows) || raw.rows.length > 10000 || raw.rows.length !== stats?.selectedRecords || selection?.maximumVisualMagnitude !== 6) throw new Error('Unsupported stellar catalogue')
  const ids = new Set<string>()
  const stars = raw.rows.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== fields.length) throw new Error('Invalid stellar row')
    const star = Object.fromEntries(fields.map((key, i) => [key, row[i]])) as unknown as Star
    if (!Number.isInteger(star.hyg) || star.hyg <= 0 || star.id !== `hyg-v44:${star.hyg}` || ids.has(star.id) ||
      !Number.isFinite(star.ra) || star.ra < 0 || star.ra >= 2*Math.PI || !Number.isFinite(star.dec) || Math.abs(star.dec)>Math.PI/2 || !Number.isFinite(star.mag) || star.mag>6) throw new Error('Invalid stellar identity, direction or magnitude')
    for (const key of optionalNumbers) if (star[key] !== null && (typeof star[key] !== 'number' || !Number.isFinite(star[key]))) throw new Error('Invalid stellar measurement')
    for (const key of optionalStrings) if (star[key] !== null && typeof star[key] !== 'string') throw new Error('Invalid stellar label')
    if (star.distance !== null && (star.distance <= 0 || star.distance >= 100000)) throw new Error('Unnormalized stellar distance')
    ids.add(star.id); return star
  })
  return { stars, source, epoch: 2000 }
}

export async function loadCatalogue(signal: AbortSignal): Promise<Catalogue> {
  const manifestResponse = await fetch('./data/zenit-manifest.json', { signal })
  if (!manifestResponse.ok) throw new Error('Stellar manifest could not be loaded')
  const manifest = await manifestResponse.json()
  const evidence = manifest.evidence?.stellar
  if (!Number.isFinite(Date.parse(manifest.sky?.orientationTimeUtc)) || !evidence || !/^stellar\/hyg-v44-bright-[a-f0-9]{12}\.json$/.test(evidence.file) || !/^[a-f0-9]{64}$/.test(evidence.sha256)) throw new Error('Stellar release is unavailable')
  const response = await fetch('./data/' + evidence.file, { signal })
  if (!response.ok) throw new Error('Stellar catalogue could not be loaded')
  const bytes = await response.arrayBuffer()
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x=>x.toString(16).padStart(2,'0')).join('')
  if (digest !== evidence.sha256) throw new Error('Stellar catalogue failed its integrity check')
  const catalogue = readCatalogue(JSON.parse(new TextDecoder().decode(bytes)))
  if (catalogue.stars.length !== evidence.records) throw new Error('Stellar count does not match the release')
  return catalogue
}

// HYG directions stay at their J2000 catalogue epoch. The orientation transform
// includes precession/nutation and Earth rotation; it is not proper-motion propagation.
export function stellarRotation(time: string): Matrix4 {
  const date=new Date(time),rotation=Rotation_EQJ_HOR(date,new Observer(0,0,0))
  const basis=[[1,0,0],[0,1,0],[0,0,1]].map(([x,y,z])=>{
    const v=RotateVector(rotation,new AstroVector(x,y,z,MakeTime(date)))
    return new Vector3(v.z,v.x,v.y)
  })
  return new Matrix4().makeBasis(basis[0],basis[1],basis[2])
}
export function catalogueDirection(star: Star): Vector3 {
  const cos=Math.cos(star.dec)
  return new Vector3(cos*Math.cos(star.ra),cos*Math.sin(star.ra),Math.sin(star.dec))
}
export function skyDirections(stars: Star[],time=SKY_TIME): Vector3[] {
  const rotation=stellarRotation(time)
  return stars.map(star=>catalogueDirection(star).applyMatrix4(rotation).normalize())
}

export function horizonReading(direction: Vector3, latitude=OBSERVER.latitude, longitude=OBSERVER.longitude) {
  const up=observerNormal(latitude,longitude)
  const north=new Vector3(0,1,0).addScaledVector(up,-up.y).normalize()
  const east=new Vector3().crossVectors(north,up).normalize()
  return { altitude: Math.asin(Math.max(-1,Math.min(1,direction.dot(up))))*180/Math.PI,
    azimuth: (Math.atan2(direction.dot(east),direction.dot(north))*180/Math.PI+360)%360 }
}

export function starColour(index: number | null): [number,number,number] {
  if (index === null) return [0.94,0.95,1]
  // Authored B-V palette; not a spectrophotometric reconstruction.
  const stops: [number,[number,number,number]][] = [[-0.4,[0.65,0.78,1]],[0,[0.9,0.95,1]],[0.65,[1,0.9,0.75]],[1.5,[1,0.7,0.45]],[2,[1,0.58,0.36]]]
  const value=Math.max(-0.4,Math.min(2,index))
  for (let i=1;i<stops.length;i++) if(value<=stops[i][0]) {
    const weight=(value-stops[i-1][0])/(stops[i][0]-stops[i-1][0])
    return stops[i-1][1].map((x,j)=>x+(stops[i][1][j]-x)*weight) as [number,number,number]
  }
  return stops[stops.length-1][1]
}

export function blockedByEarth(position: Vector3,direction: Vector3,maximumDistance=Infinity): boolean {
  const origin=new Vector3(position.x,position.y/POLAR_RATIO,position.z)
  const ray=new Vector3(direction.x,direction.y/POLAR_RATIO,direction.z)
  const scale=ray.length();ray.divideScalar(scale)
  const projection=origin.dot(ray),discriminant=projection*projection-origin.lengthSq()+1
  return projection<0&&discriminant>=0&&-projection-Math.sqrt(discriminant)<maximumDistance*scale
}

// Authored solar-altitude fade, not atmospheric photometry or observing conditions.
export function twilightOpacity(solarAltitude: number): number {
  return Math.max(0,Math.min(1,(-solarAltitude-6)/12))
}
export function solarAltitude(time: number): number {
  const vector=GeoVector(Body.Sun,new Date(time),false)
  return horizonReading(new Vector3(vector.x,vector.y,vector.z).applyMatrix4(stellarRotation(new Date(time).toISOString())).normalize()).altitude
}
