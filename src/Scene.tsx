import {useEffect,useRef} from 'react'
import {BufferGeometry,DirectionalLight,Float32BufferAttribute,HemisphereLight,Line,LineBasicMaterial,LineSegments,Mesh,MeshPhongMaterial,PerspectiveCamera,Points,Scene,ShaderMaterial,SphereGeometry,Vector3,WebGLRenderer} from 'three'
import {Body,GeoVector} from 'astronomy-engine'
import {cameraPose,earthSurface,horizonDirection,OBSERVER,observerNormal,POLAR_RATIO} from './camera'
import {blockedByEarth,type Catalogue,catalogueDirection,stellarRotation,starColour,twilightOpacity} from './stellar'
import {type Orbit,type Propagator,orbitalPosition,orbitalTrail} from './orbital'
import {type Cohorts,type PopulationFrame,type GroupId,enabledMover,groupColour} from './cohorts'
interface Props {progress:number; time:number; catalogue:Catalogue|null; orbit:Orbit|null; showStars:boolean; showTrail:boolean; cohorts:Cohorts|null; frame:PopulationFrame|null; groups:GroupId[]; scale:'whole'|'near'; traced:Propagator|null; selectedId:string|null; onSelect:(id:string)=>void; onFailure:()=>void}
export function SceneView({progress,time,catalogue,orbit,showStars,showTrail,cohorts,frame,groups,scale,traced,selectedId,onSelect,onFailure}:Props) {
  const host=useRef<HTMLDivElement>(null),values=useRef({progress,time,showStars,showTrail,selectedId,frame,groups,scale,traced}),redraw=useRef<(()=>void)|null>(null)
  useEffect(()=>{values.current={progress,time,showStars,showTrail,selectedId,frame,groups,scale,traced};redraw.current?.()},[progress,time,showStars,showTrail,selectedId,frame,groups,scale,traced])
  useEffect(()=>{
    const element=host.current;if(!element)return
    let renderer:WebGLRenderer
    try {renderer=new WebGLRenderer({antialias:true,alpha:false})}catch{onFailure();return}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor('#05090e');renderer.autoClear=false
    const scene=new Scene(),sky=new Scene(),camera=new PerspectiveCamera(43,1,0.000002,100),skyCamera=new PerspectiveCamera(43,1,.1,2)
    const geometry=new SphereGeometry(1,96,64),material=new MeshPhongMaterial({color:'#102633',shininess:8,specular:'#42677b',polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1})
    const earth=new Mesh(geometry,material);earth.scale.y=POLAR_RATIO;scene.add(earth)
    scene.add(new HemisphereLight('#94b8ca','#08131b',.35))
    const light=new DirectionalLight('#b6dae9',3.2);scene.add(light)
    const vertices:number[]=[]
    for(let lat=-60;lat<=60;lat+=30)for(let lon=-180;lon<180;lon+=2)vertices.push(...earthSurface(lat,lon).addScaledVector(observerNormal(lat,lon),.0000005).toArray(),...earthSurface(lat,lon+2).addScaledVector(observerNormal(lat,lon+2),.0000005).toArray())
    for(let lon=-180;lon<180;lon+=30)for(let lat=-90;lat<90;lat+=2)vertices.push(...earthSurface(lat,lon).addScaledVector(observerNormal(lat,lon),.0000005).toArray(),...earthSurface(lat+2,lon).addScaledVector(observerNormal(lat+2,lon),.0000005).toArray())
    const gridGeometry=new BufferGeometry();gridGeometry.setAttribute('position',new Float32BufferAttribute(vertices,3))
    const gridMaterial=new LineBasicMaterial({color:'#375c70',transparent:true,opacity:.42});scene.add(new LineSegments(gridGeometry,gridMaterial))
    const directions=(catalogue?.stars??[]).map(catalogueDirection),starGeometry=new BufferGeometry()
    starGeometry.setAttribute('position',new Float32BufferAttribute(directions.flatMap(x=>x.toArray()),3))
    starGeometry.setAttribute('tint',new Float32BufferAttribute((catalogue?.stars??[]).flatMap(x=>starColour(x.bv)),3))
    starGeometry.setAttribute('magnitude',new Float32BufferAttribute((catalogue?.stars??[]).map(x=>x.mag),1))
    starGeometry.setAttribute('starIndex',new Float32BufferAttribute(directions.map((_,i)=>i),1))
    const up=observerNormal(OBSERVER.latitude,OBSERVER.longitude)
    const starMaterial=new ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{pixelRatio:{value:renderer.getPixelRatio()},selected:{value:-1},ground:{value:0},solarOpacity:{value:1},up:{value:up}},vertexShader:`attribute vec3 tint; attribute float magnitude; attribute float starIndex;
      uniform float pixelRatio; uniform float selected; uniform float ground; uniform float solarOpacity; uniform vec3 up;
      varying vec3 colour; varying float opacity;
      void main(){float chosen=1.0-step(0.1,abs(starIndex-selected));colour=mix(tint,vec3(1.0,0.77,0.42),chosen);opacity=clamp(0.4+(6.0-magnitude)*0.1,0.4,1.0)*solarOpacity;gl_PointSize=(clamp(1.15+(6.0-magnitude)*0.42,1.15,4.5)+chosen*5.0)*pixelRatio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);if(ground>0.5&&dot((modelMatrix*vec4(position,1.0)).xyz,up)<=0.0)gl_Position=vec4(2.0,2.0,2.0,1.0);}`,
      fragmentShader:`varying vec3 colour; varying float opacity;void main(){vec2 p=gl_PointCoord-0.5;float r=length(p);if(r>0.5)discard;float light=exp(-10.0*dot(p,p))*(1.0-smoothstep(0.3,0.5,r));gl_FragColor=vec4(colour,opacity*light);}`})
    const stars=new Points(starGeometry,starMaterial);stars.frustumCulled=false;stars.matrixAutoUpdate=false;sky.add(stars)
    const issGeometry=new BufferGeometry();issGeometry.setAttribute('position',new Float32BufferAttribute([0,0,0],3))
    const issMaterial=new ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{size:{value:10*renderer.getPixelRatio()},selected:{value:0}},vertexShader:`uniform float size;void main(){gl_PointSize=size;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform float selected;void main(){vec2 p=abs(gl_PointCoord-0.5);if(p.x+p.y>0.48)discard;gl_FragColor=vec4(mix(vec3(0.35,0.88,1.0),vec3(1.0,0.77,0.42),selected),1.0);}`})
    const iss=new Points(issGeometry,issMaterial);iss.frustumCulled=false;scene.add(iss)
    const populationGeometry=new BufferGeometry(),count=cohorts?.movers.length??0
    populationGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(count*3),3))
    populationGeometry.setAttribute('tint',new Float32BufferAttribute((cohorts?.movers??[]).flatMap(groupColour),3))
    populationGeometry.setAttribute('bodyVisible',new Float32BufferAttribute(new Float32Array(count),1))
    populationGeometry.setAttribute('bodyIndex',new Float32BufferAttribute(Array.from({length:count},(_,i)=>i),1))
    const populationMaterial=new ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{pixelRatio:{value:renderer.getPixelRatio()},selected:{value:-1}},vertexShader:`attribute vec3 tint;attribute float bodyVisible;attribute float bodyIndex;uniform float pixelRatio;uniform float selected;varying vec3 colour;void main(){float chosen=1.0-step(0.1,abs(bodyIndex-selected));colour=mix(tint,vec3(1.0,0.94,0.72),chosen);gl_PointSize=(4.0+chosen*5.0)*pixelRatio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);if(bodyVisible<0.5)gl_Position=vec4(2.0,2.0,2.0,1.0);}`,fragmentShader:`varying vec3 colour;void main(){vec2 p=abs(gl_PointCoord-0.5);if(p.x+p.y>0.48)discard;gl_FragColor=vec4(colour,0.95);}`})
    const populationPoints=new Points(populationGeometry,populationMaterial);populationPoints.frustumCulled=false;scene.add(populationPoints)
    const trailGeometry=new BufferGeometry();trailGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(31*3),3));trailGeometry.setAttribute('color',new Float32BufferAttribute(Array.from({length:31},(_,i)=>[.2+.15*i/30,.35+.53*i/30,.4+.6*i/30]).flat(),3))
    const trailMaterial=new LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8});const trail=new Line(trailGeometry,trailMaterial);trail.frustumCulled=false;scene.add(trail)
    const marker=document.createElement('button');marker.className='iss-marker';marker.textContent='ISS';marker.setAttribute('aria-label','Inspect ISS');marker.onclick=()=>onSelect(values.current.selectedId??'iss:25544');element.appendChild(marker)
    element.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.dataset.starCount=String(directions.length)
    const aim=orbit?horizonDirection(orbit.release.pass.maximumElevationDegrees,orbit.release.pass.peakAzimuthDegrees):undefined
    let satelliteWorld:Vector3|null=null;let markerId='iss:25544'
    const draw=()=>{
      const value=values.current,date=new Date(value.time),pose=cameraPose(value.progress,aim,value.scale==='whole'&&cohorts?24*Math.max(1,1/camera.aspect):4.2),rotation=stellarRotation(date.toISOString())
      camera.position.copy(pose.position);camera.quaternion.copy(pose.rotation);camera.fov=skyCamera.fov=pose.fieldOfView;camera.near=Math.min(.05,Math.max(.0000001,(new Vector3(pose.position.x,pose.position.y/POLAR_RATIO,pose.position.z).length()-1)*.15));camera.updateProjectionMatrix();camera.updateMatrixWorld()
      skyCamera.quaternion.copy(pose.rotation);skyCamera.updateProjectionMatrix();skyCamera.updateMatrixWorld();stars.matrix.copy(rotation);stars.matrixWorldNeedsUpdate=true
      stars.visible=value.showStars;starMaterial.uniforms.ground.value=value.progress>=.98?1:0;starMaterial.uniforms.selected.value=catalogue?.stars.findIndex(x=>x.id===value.selectedId)??-1
      const sun=GeoVector(Body.Sun,date,false),sunDirection=new Vector3(sun.x,sun.y,sun.z).applyMatrix4(rotation).normalize();light.position.copy(sunDirection.clone().multiplyScalar(5));const opacity=value.progress>=.98?twilightOpacity(Math.asin(sunDirection.dot(up))*180/Math.PI):1;starMaterial.uniforms.solarOpacity.value=opacity;renderer.domElement.dataset.surfaceStarOpacity=opacity.toFixed(3)
      const selectedId=value.selectedId?.split(':')[1],attachment=cohorts?.attachments.find(x=>x.id===selectedId),selectedBodyId=attachment?.parentId??selectedId,selectedIndex=cohorts?.movers.findIndex(x=>x.id===selectedBodyId)??-1
      const position=orbit?orbitalPosition(orbit,value.time):null,issEnabled=!cohorts||value.groups.includes('stations');satelliteWorld=null
      iss.visible=Boolean(position)&&issEnabled&&(value.progress<.98||position!.altitude>0);issMaterial.uniforms.selected.value=selectedBodyId==='25544'?1:0
      if(position){const attribute=issGeometry.getAttribute('position');attribute.setXYZ(0,...position.world.toArray());attribute.needsUpdate=true}
      const traceEnabled=selectedBodyId==='25544'?issEnabled:selectedIndex>=0&&cohorts?enabledMover(cohorts.movers[selectedIndex],value.groups):false;const allPath=value.traced&&value.showTrail&&traceEnabled?orbitalTrail(value.traced,value.time):[];const site=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(up,OBSERVER.heightKm/6378.137);const path=value.progress>=.98?allPath.filter(x=>x.clone().sub(site).dot(up)>0):allPath;trail.visible=path.length>1
      const trailAttribute=trailGeometry.getAttribute('position');path.forEach((x,i)=>trailAttribute.setXYZ(i,...x.toArray()));trailAttribute.needsUpdate=true;trailGeometry.setDrawRange(0,path.length)
      let eligible=0,shown=0,failedCount=0,markerWorld:Vector3|null=null
      const bodyPositions=populationGeometry.getAttribute('position'),active=populationGeometry.getAttribute('bodyVisible')
      const packet=value.frame
      for(let i=0;i<count;i++){
        const mover=cohorts!.movers[i],status=packet?.availability[i]??0
        if(status===2)failedCount++
        if(status===1)eligible++
        const world=packet?new Vector3(packet.positions[i*3],packet.positions[i*3+1],packet.positions[i*3+2]):new Vector3()
        const enabled=status===1&&enabledMover(mover,value.groups)
        if(enabled)shown++
        const above=world.clone().sub(site).dot(up)>0
        active.setX(i,enabled&&(mover.id!=='25544'||!orbit)&&(value.progress<.98||above)?1:0);bodyPositions.setXYZ(i,...world.toArray())
        if(i===selectedIndex&&enabled&&(value.progress<.98||above))markerWorld=world
      }
      bodyPositions.needsUpdate=true;active.needsUpdate=true;populationMaterial.uniforms.selected.value=selectedIndex
      if(selectedBodyId==='25544'&&iss.visible&&position)markerWorld=position.world
      if(!cohorts){eligible=position?1:0;shown=iss.visible?1:0;if(position&&iss.visible)markerWorld=position.world}
      let visible=false
      if(markerWorld){const direction=markerWorld.clone().sub(camera.position).normalize(),ndc=markerWorld.clone().project(camera);visible=!blockedByEarth(camera.position,direction,markerWorld.distanceTo(camera.position))&&ndc.z>-1&&ndc.z<1&&Math.abs(ndc.x)<.94&&Math.abs(ndc.y)<.94;marker.style.left=`${(ndc.x+1)*50}%`;marker.style.top=`${(1-ndc.y)*50}%`;satelliteWorld=markerWorld}
      markerId=value.selectedId??'iss:25544';marker.textContent=attachment?attachment.name:selectedBodyId==='25544'?'ISS':cohorts?.movers[selectedIndex]?.name??'ISS';marker.setAttribute('aria-label',selectedBodyId==='25544'?'Inspect ISS':'Inspect selected satellite');marker.onclick=()=>onSelect(markerId);marker.hidden=!visible
      renderer.domElement.dataset.orbitalCount=String(eligible);renderer.domElement.dataset.filteredCount=String(shown);renderer.domElement.dataset.propagationFailures=String(failedCount);renderer.domElement.dataset.studyTime=String(value.time);renderer.domElement.dataset.issPosition=position?position.world.toArray().map(x=>x.toFixed(9)).join(','):''
      renderer.clear();renderer.render(sky,skyCamera);renderer.clearDepth();renderer.render(scene,camera)
    }
    const resize=()=>{const {width,height}=element.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=skyCamera.aspect=width/Math.max(1,height);draw()}
    const pick=(event:PointerEvent)=>{
      const bounds=element.getBoundingClientRect(),px=event.clientX-bounds.left,py=event.clientY-bounds.top
      if(satelliteWorld&&!marker.hidden){const ndc=satelliteWorld.clone().project(camera);if(Math.hypot((ndc.x+1)*bounds.width/2-px,(1-ndc.y)*bounds.height/2-py)<16){onSelect(markerId);return}}
      if(cohorts&&values.current.frame){let best=-1,distance=144;for(let i=0;i<count;i++){const mover=cohorts.movers[i];if(values.current.frame.availability[i]!==1||!enabledMover(mover,values.current.groups))continue;const world=new Vector3().fromArray(values.current.frame.positions,i*3),direction=world.clone().sub(camera.position),length=direction.length();direction.divideScalar(length);if(blockedByEarth(camera.position,direction,length)||(values.current.progress>=.98&&world.clone().sub(earthSurface(OBSERVER.latitude,OBSERVER.longitude)).dot(up)<=0))continue;const ndc=world.project(camera);if(ndc.z< -1||ndc.z>1)continue;const dx=(ndc.x+1)*bounds.width/2-px,dy=(1-ndc.y)*bounds.height/2-py,d=dx*dx+dy*dy;if(d<distance){best=i;distance=d}}if(best>=0){onSelect(cohorts.movers[best].id==='25544'?'iss:25544':'sat:'+cohorts.movers[best].id);return}}
      if(!catalogue||!values.current.showStars)return
      const forward=new Vector3(0,0,-1).applyQuaternion(skyCamera.quaternion);let best=-1,distance=100
      for(let i=0;i<directions.length;i++){const direction=directions[i].clone().applyMatrix4(stars.matrix);if(direction.dot(forward)<=0||blockedByEarth(camera.position,direction)||(values.current.progress>=.98&&direction.dot(up)<=0))continue;const ndc=direction.project(skyCamera),dx=(ndc.x+1)*bounds.width/2-px,dy=(1-ndc.y)*bounds.height/2-py,squared=dx*dx+dy*dy;if(squared<distance){best=i;distance=squared}}
      if(best>=0)onSelect(catalogue.stars[best].id)
    }
    const lost=(event:Event)=>{event.preventDefault();onFailure()};renderer.domElement.addEventListener('webglcontextlost',lost);renderer.domElement.addEventListener('pointerup',pick)
    const observer=new ResizeObserver(resize);observer.observe(element);redraw.current=draw;resize()
    return()=>{observer.disconnect();redraw.current=null;renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('pointerup',pick);for(const resource of [geometry,material,gridGeometry,gridMaterial,starGeometry,starMaterial,issGeometry,issMaterial,trailGeometry,trailMaterial,populationGeometry,populationMaterial])resource.dispose();renderer.dispose();renderer.domElement.remove();marker.remove()}
  },[onFailure,onSelect,catalogue,orbit,cohorts])
  return <div ref={host} className="scene" role="img" aria-label={`Earth-fixed view of Earth, ${catalogue?.stars.length??0} HYG stars and ${cohorts?.movers.length??(orbit?1:0)} retained orbital movers.`}/>
}
