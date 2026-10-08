import {CanvasTexture,SRGBColorSpace,SphereGeometry} from 'three'
import {earthSurface} from './camera'
import geography from './earth-land.json'
export const land=geography
export function mapPoint(longitude:number,latitude:number,width=2048,height=1024):[number,number] {
  return [(longitude+180)/360*width,(90-latitude)/180*height]
}
export function landAt(longitude:number,latitude:number):boolean {
  const inside=(ring:number[][])=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [x,y]=ring[i],[px,py]=ring[j];if((y>latitude)!==(py>latitude)&&longitude<(px-x)*(latitude-y)/(py-y)+x)hit=!hit
  }return hit}
  return land.polygons.some(polygon=>inside(polygon[0])&&!polygon.slice(1).some(inside))
}
export function earthTexture():CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024
  const context=canvas.getContext('2d');if(!context)throw new Error('Geography drawing unavailable')
  context.fillStyle='#142d3e';context.fillRect(0,0,canvas.width,canvas.height)
  context.fillStyle='#587a6c';context.strokeStyle='#9ab0a0';context.lineWidth=.85
  for(const polygon of land.polygons){context.beginPath();for(const ring of polygon){ring.forEach(([longitude,latitude],i)=>{const [x,y]=mapPoint(longitude,latitude);if(i===0)context.moveTo(x,y);else context.lineTo(x,y)});context.closePath()}context.fill('evenodd');context.stroke()}
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture
}

export function earthGeometry():SphereGeometry {
  const geometry=new SphereGeometry(1,96,64),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
  for(let i=0;i<positions.count;i++)positions.setXYZ(i,...earthSurface(uv.getY(i)*180-90,uv.getX(i)*360-180).toArray())
  geometry.computeVertexNormals();return geometry
}
