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
export function cameraPose(progress: number,aim=horizonDirection(30,0),startRadius=4.2) {
  const p=Math.max(0,Math.min(1,progress)),t=p*p*(3-2*p),normal=observerNormal(OBSERVER.latitude,OBSERVER.longitude)
  const start=new Vector3(-0.7,-0.35,-1).normalize().multiplyScalar(startRadius)
  const landing=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(normal,LANDING_HEIGHT)
  const radial=start.clone().normalize().lerp(landing.clone().normalize(),t).normalize()
  const position=radial.multiplyScalar(Math.exp(Math.log(start.length())*(1-t)+Math.log(landing.length())*t))
  const orbital=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,new Vector3(),new Vector3(0,1,0)))
  const surface=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,position.clone().add(aim),normal))
  const tilt=Math.max(0,(t-.55)/.45)
  return {position,rotation:orbital.slerp(surface,tilt*tilt*(3-2*tilt)),fieldOfView:43+57*t}
}
