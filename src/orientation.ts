import {type Matrix4,type PerspectiveCamera,Vector3} from 'three'
import {ARRIVAL,smoothBetween} from './camera'
import {catalogueDirection,horizonReading,type Star} from './stellar'

export interface ScreenBox {x:number;y:number;width:number;height:number}
export interface SkyLabel extends ScreenBox {id:string;name:string;anchorX:number;anchorY:number}
export const COMPASS_POINTS=['N','NE','E','SE','S','SW','W','NW'] as const
export function compassBearing(direction:Vector3){
  const {azimuth}=horizonReading(direction)
  return {azimuth,point:COMPASS_POINTS[Math.round(azimuth/45)%8]}
}
export function orientationOpacity(progress:number){return smoothBetween(ARRIVAL,ARRIVAL+.08,progress)}
export function brightAnchors(stars:Star[]){return stars.filter((star):star is Star&{name:string}=>Boolean(star.name)&&star.mag<=2).sort((a,b)=>a.mag-b.mag||a.hyg-b.hyg).map(star=>({star,direction:catalogueDirection(star)}))}
function overlaps(a:ScreenBox,b:ScreenBox,padding=12){return a.x<b.x+b.width+padding&&a.x+a.width>b.x-padding&&a.y<b.y+b.height+padding&&a.y+a.height>b.y-padding}
/** Project the actual rotated catalogue rays. No label may name a hidden star,
 * sit behind a panel, cover the selected satellite or crowd another label.
 */
export function surfaceLabels(anchors:ReturnType<typeof brightAnchors>,rotation:Matrix4,camera:PerspectiveCamera,width:number,height:number,exclusions:ScreenBox[]):SkyLabel[]{
  const forward=camera.getWorldDirection(new Vector3()),labels:SkyLabel[]=[],limit=width<=650?3:4
  for(const {star,direction} of anchors){
    const world=direction.clone().applyMatrix4(rotation)
    if(world.dot(forward)<=0||horizonReading(world).altitude<=5)continue
    const ndc=world.clone().project(camera)
    if(ndc.z< -1||ndc.z>1)continue
    const anchorX=(ndc.x+1)*width/2,anchorY=(1-ndc.y)*height/2
    const label={id:star.id,name:star.name,anchorX,anchorY,x:anchorX+10,y:anchorY-10,width:Math.ceil(star.name.length*6.2)+6,height:20}
    if(anchorX<20||label.x+label.width>width-20||label.y<20||label.y+label.height>height-20||exclusions.some(box=>overlaps(label,box))||labels.some(box=>overlaps(label,box,24)))continue
    labels.push(label);if(labels.length===limit)break
  }
  return labels
}
