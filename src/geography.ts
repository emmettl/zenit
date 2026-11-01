import {CanvasTexture,Color,SRGBColorSpace,SphereGeometry} from 'three'
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
export function earthTexture({width=2048,coastlines=true,edgeSoftness=0}:{width?:number;coastlines?:boolean;edgeSoftness?:number}={}):CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width/2
  const context=canvas.getContext('2d');if(!context)throw new Error('Geography drawing unavailable')
  context.fillStyle='#142d3e';context.fillRect(0,0,canvas.width,canvas.height)
  context.fillStyle='#587a6c';context.strokeStyle='#9ab0a0';context.lineWidth=.85
  const feather=[.12,.35,.65,.9].map(mix=>new Color('#142d3e').lerp(new Color('#587a6c'),mix).getStyle())
  for(const polygon of land.polygons){
    context.beginPath()
    for(const ring of polygon){ring.forEach(([longitude,latitude],i)=>{const [x,y]=mapPoint(longitude,latitude,canvas.width,canvas.height);if(i===0)context.moveTo(x,y);else context.lineTo(x,y)});context.closePath()}
    // A quiet coastal feather, using portable canvas strokes rather than a filter.
    // Fill last so the retained land interior stays solid and the ocean edge softens.
    if(edgeSoftness>0){context.lineJoin='round';for(let i=0;i<feather.length;i++){context.strokeStyle=feather[i];context.lineWidth=2*edgeSoftness*(1-i/feather.length);context.stroke()}}
    context.fill('evenodd')
    if(coastlines){context.strokeStyle='#9ab0a0';context.lineWidth=.85;context.stroke()}
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture
}

export function earthGeometry():SphereGeometry {
  const geometry=new SphereGeometry(1,96,64),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
  for(let i=0;i<positions.count;i++)positions.setXYZ(i,...earthSurface(uv.getY(i)*180-90,uv.getX(i)*360-180).toArray())
  geometry.computeVertexNormals();return geometry
}
