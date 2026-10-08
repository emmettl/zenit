import {Matrix4,Quaternion,Vector3} from 'three'
import {ARRIVAL,horizonDirection,OBSERVER,observerNormal,smoothBetween,type CameraPose} from './camera'
import {horizonReading} from './stellar'
export interface SkyView {altitude:number;azimuth:number}
export function skyView(rotation:Quaternion):SkyView {return horizonReading(new Vector3(0,0,-1).applyQuaternion(rotation))}
export function turnSky(view:SkyView,horizontal:number,vertical:number):SkyView {
  return {azimuth:((view.azimuth+horizontal)%360+360)%360,altitude:Math.max(-10,Math.min(85,view.altitude+vertical))}
}
/** Rotate around the fixed observer. On ascent, blend back into the authored
 * return path without changing observer position, projection or the study clock.
 */
export function skyPose(base:CameraPose,view:SkyView,progress:number):CameraPose {
  const up=observerNormal(OBSERVER.latitude,OBSERVER.longitude),direction=horizonDirection(view.altitude,view.azimuth)
  const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(base.position,base.position.clone().add(direction),up))
  return {...base,rotation:base.rotation.clone().slerp(rotation,smoothBetween(.28,ARRIVAL,progress))}
}
