import {Vector3} from 'three'
import {PARENTS,RADIUS,type Vec3} from './collision-model'

export const world=(r:Vec3)=>new Vector3(r[0]/RADIUS,r[2]/RADIUS,-r[1]/RADIUS)
const smooth=(value:number)=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x)}
export interface CloudFrame {centre:Vector3;extent:number;radial:Vector3;along:Vector3;normal:Vector3}
export function cloudFrame(positions:Vector3[],time:number):CloudFrame {
  const centre=positions.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/positions.length)
  const radial=centre.clone().normalize(),along=world(PARENTS[0].at(Math.max(0,time)).velocity).normalize(),normal=new Vector3().crossVectors(radial,along).normalize()
  return {centre,extent:Math.max(...positions.map(p=>p.distanceTo(centre))),radial,along,normal}
}
export function composition(time:number,cloud:CloudFrame,aspect:number,follow=false){
  const fit=Math.max(1,1/aspect),fullPosition=new Vector3(3,1.6,2.5).multiplyScalar(fit)
  if(time<0){
    const a=world(PARENTS[0].at(time).position),b=world(PARENTS[1].at(time).position),target=a.clone().add(b).multiplyScalar(.5)
    // Hold the final framing so the bodies actually converge on screen.
    const distance=Math.max(10/RADIUS,a.distanceTo(b)*2.3)*fit
    return {target,position:target.clone().add(new Vector3(1,.08,.12).normalize().multiplyScalar(distance)),up:new Vector3(0,1,0),reveal:0}
  }
  const reveal=follow?0:smooth((time-600)/1800),turn=.35+Math.log1p(time/20)*.13
  const direction=cloud.radial.clone().multiplyScalar(.4).addScaledVector(cloud.normal,Math.cos(turn)).addScaledVector(cloud.along,Math.sin(turn)).normalize()
  const distance=Math.max(4/RADIUS,cloud.extent*3.8)*fit
  // A short push into the release joins the held encounter to the cloud camera.
  const release=smooth(time/5),held=10/RADIUS*fit
  const localDistance=held*(1-release)+distance*release
  const approach=new Vector3(1,.08,.12).normalize()
  const localDirection=approach.lerp(direction,release).normalize()
  const target=cloud.centre.clone().multiplyScalar(1-reveal)
  const position=cloud.centre.clone().addScaledVector(localDirection,localDistance).lerp(fullPosition,reveal)
  const up=new Vector3(0,1,0).lerp(cloud.radial,release).normalize().lerp(new Vector3(0,1,0),reveal).normalize()
  return {target,position,up,reveal}
}
