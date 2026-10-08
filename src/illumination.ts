import {Body,GeoVector} from 'astronomy-engine'
import {Vector3} from 'three'
import {EARTH_RADIUS_KM} from './camera'
import {stellarRotation} from './stellar'
export const AU_KM=149597870.7,SUN_RADIUS_KM=695700
export type IlluminationState='sunlit'|'penumbra'|'umbra'
export const ILLUMINATION_LABELS={sunlit:'Sunlit',penumbra:'Partial Earth shadow',umbra:'Earth shadow (umbra)'} as const
/** Same EQJ-to-Earth-fixed basis as the stellar field; distances in equatorial Earth radii. */
export function earthFixedSun(time:number):Vector3 {
  const date=new Date(time),sun=GeoVector(Body.Sun,date,false)
  return new Vector3(sun.x,sun.y,sun.z).applyMatrix4(stellarRotation(date.toISOString())).multiplyScalar(AU_KM/EARTH_RADIUS_KM)
}
/** Finite solar disc, spherical Earth (6378.137 km). Kelso angular-contact criteria.
 * The eased transition is an authored display weight, not an irradiance fraction. */
export function illumination(position:Vector3,sun:Vector3) {
  if(!position.toArray().every(Number.isFinite)||!sun.toArray().every(Number.isFinite)||position.length()<=1)throw Error('Invalid illumination geometry')
  const toSun=sun.clone().sub(position),distance=toSun.length()
  if(distance<=SUN_RADIUS_KM/EARTH_RADIUS_KM)throw Error('Invalid solar distance')
  const earthAngle=Math.asin(1/position.length()),sunAngle=Math.asin(SUN_RADIUS_KM/EARTH_RADIUS_KM/distance)
  const separation=position.clone().negate().angleTo(toSun)
  const state:IlluminationState=separation>=earthAngle+sunAngle?'sunlit':earthAngle>=sunAngle&&separation<=earthAngle-sunAngle?'umbra':'penumbra'
  const t=Math.max(0,Math.min(1,(separation-earthAngle+sunAngle)/(2*sunAngle)))
  return {state,transition:state==='sunlit'?1:state==='umbra'?0:t*t*(3-2*t)}
}
/** Keep model glyphs and paths visible even when geometrically eclipsed. */
export const illuminationWeight=(transition:number)=>.5+.5*transition
/** Bound historical solar samples across redraws and seeks; never cache orbital positions. */
export function solarSampler(){const cache=new Map<number,Vector3>();return(time:number)=>{let sun=cache.get(time);if(!sun){sun=earthFixedSun(time);if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(time,sun)}return sun}}
