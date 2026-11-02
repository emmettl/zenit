import {Vector3,MathUtils} from 'three'
export const REVEAL_DURATION=42
const smooth=(a:number,b:number,t:number)=>{const u=MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u)}
export function constellationReveal(seconds:number){
 const cue=MathUtils.clamp(seconds,0,REVEAL_DURATION)
 return {cue,plane:smooth(8,17,cue),whole:smooth(24,37,cue),pullback:smooth(7,20,cue),stage:cue<8?0:cue<24?1:2,complete:cue>=REVEAL_DURATION}
}
export function constellationPose(cue:number,position:Vector3,normal:Vector3,globalDirection:Vector3,aspect:number){
 const radial=position.clone().normalize(),along=normal.clone().cross(radial).normalize(),pull=constellationReveal(cue).pullback
 const target=position.clone().multiplyScalar(1-pull)
 const close=position.clone().addScaledVector(radial,.27).addScaledVector(normal,.16).addScaledVector(along,-.25)
 const wide=globalDirection.clone().normalize().multiplyScalar(3.9*Math.max(1,1/aspect))
 const camera=close.lerp(wide,pull)
 // Keep authored travel above the ellipsoid even when close/wide vectors oppose.
 if(camera.length()<1.04)camera.setLength(1.04)
 return {position:camera,target,up:radial.lerp(new Vector3(0,1,0),smooth(4,26,cue)).normalize()}
}
/** Circular orientation diagram only, not a propagated trajectory. */
export function orientationCircle(position:Vector3,normal:Vector3,segments=192){
 const a=position.clone().normalize(),b=normal.clone().cross(a).normalize(),radius=position.length()
 return Array.from({length:segments+1},(_,i)=>a.clone().multiplyScalar(Math.cos(i/segments*Math.PI*2)*radius).addScaledVector(b,Math.sin(i/segments*Math.PI*2)*radius))
}
