import {Matrix4,Quaternion,Vector3} from 'three'
import {smoothBetween,type CameraPose} from './camera'
const direction=new Vector3(-.7,-.35,-1).normalize()
/** Camera framing only: Earth radii stay linear and the ISS direction comes from the displayed packet UTC. */
export function openingCamera(elapsed:number,aspect:number,iss:Vector3|null):CameraPose {
  const fit=Math.max(1,1/Math.max(.2,aspect)),navigation=smoothBetween(2600,4800,elapsed),ring=smoothBetween(6800,9000,elapsed),station=smoothBetween(12000,15000,elapsed)
  let radius=Math.exp(Math.log(4.2)*(1-navigation)+Math.log(14)*navigation)
  radius=Math.exp(Math.log(radius)*(1-ring)+Math.log(24)*ring)
  radius=Math.exp(Math.log(radius)*(1-station)+Math.log(3.5)*station)*fit
  const target=iss&&iss.length()>1?iss.clone().normalize():direction.clone()
  const turn=new Quaternion().setFromUnitVectors(direction,target)
  const position=direction.clone().applyQuaternion(new Quaternion().slerp(turn,station)).multiplyScalar(radius)
  const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,new Vector3(),new Vector3(0,1,0)))
  return {position,rotation,fieldOfView:43}
}
