import {Group,Mesh,MeshPhongMaterial,BoxGeometry,CylinderGeometry,EdgesGeometry,LineSegments,LineBasicMaterial,InstancedMesh,TetrahedronGeometry,Color,DynamicDrawUsage} from 'three'

export const FAMILY_COLOURS=['#79cbe2','#e4b17d']
/** Authored diagram glyphs, with no identity or physical-dimension claim. */
export function bodyGlyph(family:number){
  const group=new Group(),hull=new MeshPhongMaterial({color:family===0?'#d9e9ef':'#d9ae78',shininess:35,flatShading:true}),panel=new MeshPhongMaterial({color:'#224b74',shininess:60})
  const box=(x:number,y:number,z:number,material:MeshPhongMaterial,px=0,py=0)=>{
    const geometry=new BoxGeometry(x,y,z),mesh=new Mesh(geometry,material);mesh.position.set(px,py,0);group.add(mesh)
    const edges=new LineSegments(new EdgesGeometry(geometry),new LineBasicMaterial({color:family===0?'#a3dfef':'#f1cda0',transparent:true,opacity:.5}));edges.position.copy(mesh.position);group.add(edges)
  }
  if(family===0){
    box(1,.8,.85,hull);box(.2,.12,.12,hull,0,.6)
    for(const sign of [-1,1]){box(.55,.08,.1,hull,sign*.75);box(1.7,.06,1,panel,sign*1.8);for(const offset of [-.55,0,.55])box(.025,.08,1.02,hull,sign*1.8+offset)}
  }else{
    const bus=new Mesh(new CylinderGeometry(.65,.65,1.5,10),hull);group.add(bus)
    box(.08,3.8,.08,hull);box(2.6,.08,.08,hull);box(1.6,.06,.75,panel,1.2,.2);box(.25,.25,.25,hull,0,2)
  }
  return group
}
export function fragmentGlyphs(count:number){
  const material=new MeshPhongMaterial({color:'#ffffff',shininess:30,flatShading:true,specular:'#b7d9df'})
  const mesh=new InstancedMesh(new TetrahedronGeometry(1,0),material,count);mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.frustumCulled=false
  for(let i=0;i<count;i++){const base=new Color(FAMILY_COLOURS[Math.floor(i/(count/2))]);base.lerp(new Color('#f4f2e7'),i%19===0?.65:.1);mesh.setColorAt(i,base)}
  return mesh
}
