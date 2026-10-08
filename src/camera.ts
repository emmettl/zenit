import { Matrix4, Quaternion, Vector3 } from 'three'
// Earth-fixed view: X Greenwich/equator, Y north pole, Z 90 degrees west.
export const OBSERVER = { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, heightKm: 0.058 }
export const EARTH_RADIUS_KM = 6378.137
export const POLAR_RATIO = 1-1/298.257223563 // WGS84 ellipsoid
export const LANDING_HEIGHT = OBSERVER.heightKm/EARTH_RADIUS_KM
export function observerNormal(latitude: number,longitude: number): Vector3 {
  const lat=latitude*Math.PI/180,lon=longitude*Math.PI/180
  return new Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon))
}
export function earthSurface(latitude: number,longitude: number): Vector3 {
  const normal=observerNormal(latitude,longitude),e2=1-POLAR_RATIO*POLAR_RATIO,n=1/Math.sqrt(1-e2*normal.y*normal.y)
  return new Vector3(n*normal.x,n*(1-e2)*normal.y,n*normal.z)
}
export function horizonDirection(altitude: number,azimuth: number): Vector3 {
  const up=observerNormal(OBSERVER.latitude,OBSERVER.longitude),north=new Vector3(0,1,0).addScaledVector(up,-up.y).normalize(),east=new Vector3().crossVectors(north,up).normalize()
  const alt=altitude*Math.PI/180,az=azimuth*Math.PI/180
  return north.multiplyScalar(Math.cos(alt)*Math.cos(az)).addScaledVector(east,Math.cos(alt)*Math.sin(az)).addScaledVector(up,Math.sin(alt)).normalize()
}
export interface CameraPose {position:Vector3;rotation:Quaternion;fieldOfView:number}
export interface OrbitalView {yaw:number;pitch:number;distance:number}
export function orbitView(position:Vector3,target=new Vector3()):OrbitalView {
  const offset=position.clone().sub(target),distance=offset.length()
  return {yaw:Math.atan2(offset.x,offset.z),pitch:Math.asin(Math.max(-1,Math.min(1,offset.y/distance))),distance}
}
export function orbitalCamera(view:OrbitalView,target=new Vector3(),localFrame=false):CameraPose {
  const pitch=Math.max(-Math.PI/2+.02,Math.min(Math.PI/2-.02,view.pitch)),distance=Math.max(target.length()>0 ? .15 : 1.08,Math.min(60,view.distance))
  const position=new Vector3(Math.sin(view.yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(view.yaw)*Math.cos(pitch)).multiplyScalar(distance)
  if(localFrame)position.applyQuaternion(new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(target,new Vector3(),new Vector3(0,1,0))))
  position.add(target)
  const ellipsoid=new Vector3(position.x,position.y/POLAR_RATIO,position.z).length()
  if(ellipsoid<1e-12)position.copy(target).normalize().multiplyScalar(1.03)
  else if(ellipsoid<1.03)position.multiplyScalar(1.03/ellipsoid)
  return {position,rotation:new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,target,new Vector3(0,1,0))),fieldOfView:43}
}
export const ARRIVAL=0.64,LOOK_UP=0.78
export function smoothBetween(start:number,end:number,value:number):number {const t=Math.max(0,Math.min(1,(value-start)/(end-start)));return t*t*(3-2*t)}
export function cameraPhase(progress:number):string {return progress<=0?'Orbit':progress<ARRIVAL?'Approaching Sydney':progress<LOOK_UP?'Sydney horizon':progress<1?'Lifting toward the sky':'Looking up'}
export function cameraPose(progress: number,aim=horizonDirection(30,0),startRadius=4.2,from?:CameraPose):CameraPose {
  const p=Math.max(0,Math.min(1,progress)),travel=smoothBetween(0,ARRIVAL,p),normal=observerNormal(OBSERVER.latitude,OBSERVER.longitude)
  const start=from?.position.clone()??new Vector3(-0.7,-0.35,-1).normalize().multiplyScalar(startRadius)
  const landing=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(normal,LANDING_HEIGHT)
  const startDirection=start.clone().normalize(),arc=new Quaternion().setFromUnitVectors(startDirection,landing.clone().normalize())
  const radial=startDirection.applyQuaternion(new Quaternion().slerp(arc,travel))
  const position=radial.multiplyScalar(Math.exp(Math.log(start.length())*(1-travel)+Math.log(landing.length())*travel))
  const ellipsoid=new Vector3(position.x,position.y/POLAR_RATIO,position.z).length()
  if(ellipsoid<1+LANDING_HEIGHT/2)position.multiplyScalar((1+LANDING_HEIGHT/2)/ellipsoid)
  const orbital=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,new Vector3(),new Vector3(0,1,0)))
  if(from)orbital.copy(from.rotation).slerp(new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,new Vector3(),new Vector3(0,1,0))),travel)
  const horizontal=aim.clone().addScaledVector(normal,-aim.dot(normal)).normalize()
  const horizonAim=horizontal.multiplyScalar(Math.cos(2*Math.PI/180)).addScaledVector(normal,Math.sin(2*Math.PI/180))
  const horizon=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,position.clone().add(horizonAim),normal))
  const surface=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,position.clone().add(aim),normal))
  const reveal=smoothBetween(LOOK_UP,1,p),rotation=orbital.slerp(horizon,smoothBetween(.28,ARRIVAL,p)).slerp(surface,reveal)
  return {position,rotation,fieldOfView:(from?.fieldOfView??43)*(1-travel)+82*travel+18*reveal}
}
