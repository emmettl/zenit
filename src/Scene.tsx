import {useEffect,useRef} from 'react'
import {BufferGeometry,DirectionalLight,Float32BufferAttribute,HemisphereLight,Line,LineBasicMaterial,LineSegments,Mesh,MeshPhongMaterial,PerspectiveCamera,PlaneGeometry,Points,Scene,ShaderMaterial,Vector3,WebGLRenderer} from 'three'
import {Body,GeoVector} from 'astronomy-engine'
import {cameraPose,earthSurface,horizonDirection,OBSERVER,observerNormal,POLAR_RATIO,orbitalCamera,orbitView,type CameraPose,type OrbitalView,ARRIVAL,cameraPhase,smoothBetween} from './camera'
import {blockedByEarth,type Catalogue,catalogueDirection,stellarRotation,starColour,twilightOpacity} from './stellar'
import {type Orbit,type Propagator,orbitalPosition,orbitalTrail} from './orbital'
import {earthTexture,earthGeometry,land} from './geography'
import {type Cohorts,type PopulationFrame,type GroupId,enabledMover,groupColour} from './cohorts'
interface Props {onInteraction:()=>void;opacity:number;cameraZoom:number;following:boolean;cameraReset:number;onReset:()=>void;progress:number; time:number; catalogue:Catalogue|null; orbit:Orbit|null; showStars:boolean; showTrail:boolean; cohorts:Cohorts|null; frame:PopulationFrame|null; groups:GroupId[]; scale:'whole'|'near'; traced:Propagator|null; selectedId:string|null; onSelect:(id:string)=>void; onFailure:()=>void}
export function SceneView({onInteraction,opacity,progress,time,catalogue,orbit,showStars,showTrail,cohorts,frame,groups,scale,traced,selectedId,onSelect,onFailure,following,cameraReset,cameraZoom,onReset}:Props) {
  const host=useRef<HTMLDivElement>(null),values=useRef({progress,time,showStars,showTrail,selectedId,frame,groups,scale,traced,following,cameraReset,cameraZoom}),redraw=useRef<(()=>void)|null>(null)
  const navigation=useRef<{orbit:OrbitalView|null;follow:OrbitalView|null;followId:string|null;start:CameraPose|null;last:CameraPose|null;reset:number;scale:string;zoom:number}>({orbit:null,follow:null,followId:null,start:null,last:null,reset:cameraReset,scale,zoom:cameraZoom})
  const resetHandler=useRef(onReset);resetHandler.current=onReset
  const interactionHandler=useRef(onInteraction);interactionHandler.current=onInteraction
  useEffect(()=>{values.current={progress,time,showStars,showTrail,selectedId,frame,groups,scale,traced,following,cameraReset,cameraZoom};redraw.current?.()},[progress,time,showStars,showTrail,selectedId,frame,groups,scale,traced,following,cameraReset,cameraZoom])
  useEffect(()=>{
    const element=host.current;if(!element)return
    let renderer:WebGLRenderer
    try {renderer=new WebGLRenderer({antialias:true,alpha:false})}catch{onFailure();return}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor('#05090e');renderer.autoClear=false
    const scene=new Scene(),sky=new Scene(),groundScene=new Scene(),camera=new PerspectiveCamera(43,1,0.000002,100),skyCamera=new PerspectiveCamera(43,1,.1,2)
    let texture:ReturnType<typeof earthTexture>|null=null
    try{texture=earthTexture()}catch{/* The globe and analytic horizon remain usable without a texture. */}
    const geometry=earthGeometry(),material=new MeshPhongMaterial({map:texture,color:texture?'#ffffff':'#102633',transparent:true,shininess:8,specular:'#42677b',polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1})
    const earth=new Mesh(geometry,material);scene.add(earth)
    scene.add(new HemisphereLight('#94b8ca','#08131b',.65))
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
    const groundGeometry=new PlaneGeometry(2,2)
    const groundMaterial=new ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{origin:{value:new Vector3()},cameraWorld:{value:camera.matrixWorld.clone()},inverseProjection:{value:camera.projectionMatrixInverse.clone()},up:{value:up},amount:{value:0}},vertexShader:`varying vec2 screen;void main(){screen=position.xy;gl_Position=vec4(position.xy,0.0,1.0);}`,fragmentShader:`precision highp float;varying vec2 screen;uniform vec3 origin;uniform mat4 cameraWorld;uniform mat4 inverseProjection;uniform vec3 up;uniform float amount;
      void main(){vec3 ray=normalize(mat3(cameraWorld)*(inverseProjection*vec4(screen,1.0,1.0)).xyz);vec3 o=origin*vec3(1.0,${1/ (1-1/298.257223563)},1.0);vec3 d=ray*vec3(1.0,${1/ (1-1/298.257223563)},1.0);float a=dot(d,d),b=dot(o,d),c=dot(o,o)-1.0;float disc=b*b-a*c;bool ground=b<0.0&&disc>=0.0&&(-b-sqrt(max(0.0,disc)))/a>0.0;float band=exp(-abs(dot(ray,up)+0.0043)*70.0);vec3 colour=ground?vec3(0.018,0.035,0.041)+band*vec3(0.03,0.055,0.065):vec3(0.13,0.25,0.31);gl_FragColor=vec4(colour,amount*(ground?1.0:band*0.5));}`})
    const groundQuad=new Mesh(groundGeometry,groundMaterial);groundQuad.frustumCulled=false;groundScene.add(groundQuad)
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
    element.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','group');renderer.domElement.setAttribute('aria-label','Orbital camera: arrow keys to orbit, plus and minus to zoom, Home to reset');renderer.domElement.dataset.starCount=String(directions.length);renderer.domElement.dataset.landPolygons=String(land.polygons.length);renderer.domElement.dataset.geography=texture?'ready':'fallback'
    const aim=orbit?horizonDirection(orbit.release.pass.maximumElevationDegrees,orbit.release.pass.peakAzimuthDegrees):undefined
    let satelliteWorld:Vector3|null=null;let markerId='iss:25544'
    const draw=()=>{
      const value=values.current,date=new Date(value.time),rotation=stellarRotation(date.toISOString())
      const selectedId=value.selectedId?.split(':')[1],attachment=cohorts?.attachments.find(x=>x.id===selectedId),selectedBodyId=attachment?.parentId??selectedId,selectedIndex=cohorts?.movers.findIndex(x=>x.id===selectedBodyId)??-1
      const position=orbit?orbitalPosition(orbit,value.time):null,issEnabled=!cohorts||value.groups.includes('stations')
      const packetTarget=selectedIndex>=0&&value.frame?.availability[selectedIndex]===1&&enabledMover(cohorts!.movers[selectedIndex],value.groups)?new Vector3().fromArray(value.frame.positions,selectedIndex*3):null
      const followed=selectedBodyId==='25544'&&issEnabled&&position?position.world:packetTarget
      const nav=navigation.current,baseRadius=value.scale==='whole'&&cohorts?24*Math.max(1,1/camera.aspect):4.2
      if(nav.reset!==value.cameraReset){nav.orbit=null;nav.follow=null;nav.followId=null;nav.reset=value.cameraReset;if(value.progress===0)nav.start=null}
      if(nav.scale!==value.scale){nav.orbit=null;nav.scale=value.scale}
      const zoomDelta=value.cameraZoom-nav.zoom;nav.zoom=value.cameraZoom
      let pose:CameraPose
      if(value.progress===0){
        nav.start=null
        if(value.following&&followed){
          if(nav.followId!==selectedBodyId||!nav.follow){nav.follow={yaw:0,pitch:0,distance:2.5};nav.followId=selectedBodyId??null}
          if(zoomDelta)nav.follow.distance=Math.max(.15,Math.min(60,nav.follow.distance*Math.exp(-zoomDelta*.2)))
          pose=orbitalCamera(nav.follow,followed,true)
        }else {nav.follow=null;nav.followId=null;if(zoomDelta){nav.orbit??=orbitView(cameraPose(0,aim,baseRadius).position);nav.orbit.distance=Math.max(1.08,Math.min(60,nav.orbit.distance*Math.exp(-zoomDelta*.2)))}pose=nav.orbit?orbitalCamera(nav.orbit):cameraPose(0,aim,baseRadius)}
        nav.last={position:pose.position.clone(),rotation:pose.rotation.clone(),fieldOfView:pose.fieldOfView}
      }else {nav.start??=nav.last;pose=cameraPose(value.progress,aim,baseRadius,nav.start??undefined)}
      renderer.domElement.style.touchAction=value.progress===0?'none':'pan-y';renderer.domElement.style.cursor=value.progress===0?'grab':'default'
      renderer.domElement.dataset.cameraPosition=pose.position.toArray().map(x=>x.toFixed(9)).join(',');renderer.domElement.dataset.cameraRotation=pose.rotation.toArray().map(x=>x.toFixed(9)).join(',');renderer.domElement.dataset.cameraTarget=value.progress===0&&value.following&&followed?followed.toArray().map(x=>x.toFixed(9)).join(','):'0,0,0';renderer.domElement.dataset.following=value.progress===0&&value.following&&followed?selectedBodyId??'':'none'
      camera.position.copy(pose.position);camera.quaternion.copy(pose.rotation);camera.fov=skyCamera.fov=pose.fieldOfView;camera.near=Math.min(.05,Math.max(.0000001,(new Vector3(pose.position.x,pose.position.y/POLAR_RATIO,pose.position.z).length()-1)*.15));camera.updateProjectionMatrix();camera.updateMatrixWorld()
      const groundAmount=smoothBetween(.60,ARRIVAL,value.progress);earth.visible=groundAmount<1;material.opacity=1-groundAmount;gridMaterial.opacity=.42*(1-groundAmount);groundMaterial.uniforms.amount.value=groundAmount;groundMaterial.uniforms.origin.value.copy(pose.position);groundMaterial.uniforms.cameraWorld.value.copy(camera.matrixWorld);groundMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);renderer.domElement.dataset.cameraPhase=cameraPhase(value.progress);renderer.domElement.dataset.groundOpacity=groundAmount.toFixed(3)
      skyCamera.quaternion.copy(pose.rotation);skyCamera.updateProjectionMatrix();skyCamera.updateMatrixWorld();stars.matrix.copy(rotation);stars.matrixWorldNeedsUpdate=true
      stars.visible=value.showStars;starMaterial.uniforms.ground.value=value.progress>=ARRIVAL?1:0;starMaterial.uniforms.selected.value=catalogue?.stars.findIndex(x=>x.id===value.selectedId)??-1
      const sun=GeoVector(Body.Sun,date,false),sunDirection=new Vector3(sun.x,sun.y,sun.z).applyMatrix4(rotation).normalize();light.position.copy(sunDirection.clone().multiplyScalar(5));const opacity=value.progress>=ARRIVAL?twilightOpacity(Math.asin(sunDirection.dot(up))*180/Math.PI):1;starMaterial.uniforms.solarOpacity.value=opacity;renderer.domElement.dataset.surfaceStarOpacity=opacity.toFixed(3)
      satelliteWorld=null
      iss.visible=Boolean(position)&&issEnabled&&(value.progress<ARRIVAL||position!.altitude>0);issMaterial.uniforms.selected.value=selectedBodyId==='25544'?1:0
      if(position){const attribute=issGeometry.getAttribute('position');attribute.setXYZ(0,...position.world.toArray());attribute.needsUpdate=true}
      const traceEnabled=selectedBodyId==='25544'?issEnabled:selectedIndex>=0&&cohorts?enabledMover(cohorts.movers[selectedIndex],value.groups):false;const allPath=value.traced&&value.showTrail&&traceEnabled?orbitalTrail(value.traced,value.time):[];const site=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(up,OBSERVER.heightKm/6378.137);const path=value.progress>=ARRIVAL?allPath.filter(x=>x.clone().sub(site).dot(up)>0):allPath;trail.visible=path.length>1
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
        active.setX(i,enabled&&(mover.id!=='25544'||!orbit)&&(value.progress<ARRIVAL||above)?1:0);bodyPositions.setXYZ(i,...world.toArray())
        if(i===selectedIndex&&enabled&&(value.progress<ARRIVAL||above))markerWorld=world
      }
      bodyPositions.needsUpdate=true;active.needsUpdate=true;populationMaterial.uniforms.selected.value=selectedIndex
      if(selectedBodyId==='25544'&&iss.visible&&position)markerWorld=position.world
      if(!cohorts){eligible=position?1:0;shown=iss.visible?1:0;if(position&&iss.visible)markerWorld=position.world}
      let visible=false
      if(markerWorld){const direction=markerWorld.clone().sub(camera.position).normalize(),ndc=markerWorld.clone().project(camera);visible=!blockedByEarth(camera.position,direction,markerWorld.distanceTo(camera.position))&&ndc.z>-1&&ndc.z<1&&Math.abs(ndc.x)<.94&&Math.abs(ndc.y)<.94;marker.style.left=`${(ndc.x+1)*50}%`;marker.style.top=`${(1-ndc.y)*50}%`;satelliteWorld=markerWorld}
      markerId=value.selectedId??'iss:25544';marker.textContent=attachment?attachment.name:selectedBodyId==='25544'?'ISS':cohorts?.movers[selectedIndex]?.name??'ISS';marker.setAttribute('aria-label',selectedBodyId==='25544'?'Inspect ISS':'Inspect selected satellite');marker.onclick=()=>onSelect(markerId);marker.hidden=!visible
      renderer.domElement.dataset.orbitalCount=String(eligible);renderer.domElement.dataset.filteredCount=String(shown);renderer.domElement.dataset.propagationFailures=String(failedCount);renderer.domElement.dataset.studyTime=String(value.time);renderer.domElement.dataset.issPosition=position?position.world.toArray().map(x=>x.toFixed(9)).join(','):''
      renderer.clear();renderer.render(sky,skyCamera);renderer.render(groundScene,skyCamera);renderer.clearDepth();renderer.render(scene,camera)
    }
    const resize=()=>{const {width,height}=element.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=skyCamera.aspect=width/Math.max(1,height);draw()}
    const pick=(event:{clientX:number;clientY:number})=>{
      const bounds=element.getBoundingClientRect(),px=event.clientX-bounds.left,py=event.clientY-bounds.top
      if(satelliteWorld&&!marker.hidden){const ndc=satelliteWorld.clone().project(camera);if(Math.hypot((ndc.x+1)*bounds.width/2-px,(1-ndc.y)*bounds.height/2-py)<16){onSelect(markerId);return}}
      if(cohorts&&values.current.frame){let best=-1,distance=144;for(let i=0;i<count;i++){const mover=cohorts.movers[i];if(values.current.frame.availability[i]!==1||!enabledMover(mover,values.current.groups))continue;const world=new Vector3().fromArray(values.current.frame.positions,i*3),direction=world.clone().sub(camera.position),length=direction.length();direction.divideScalar(length);if(blockedByEarth(camera.position,direction,length)||(values.current.progress>=ARRIVAL&&world.clone().sub(earthSurface(OBSERVER.latitude,OBSERVER.longitude)).dot(up)<=0))continue;const ndc=world.project(camera);if(ndc.z< -1||ndc.z>1)continue;const dx=(ndc.x+1)*bounds.width/2-px,dy=(1-ndc.y)*bounds.height/2-py,d=dx*dx+dy*dy;if(d<distance){best=i;distance=d}}if(best>=0){onSelect(cohorts.movers[best].id==='25544'?'iss:25544':'sat:'+cohorts.movers[best].id);return}}
      if(!catalogue||!values.current.showStars)return
      const forward=new Vector3(0,0,-1).applyQuaternion(skyCamera.quaternion);let best=-1,distance=100
      for(let i=0;i<directions.length;i++){const direction=directions[i].clone().applyMatrix4(stars.matrix);if(direction.dot(forward)<=0||blockedByEarth(camera.position,direction)||(values.current.progress>=ARRIVAL&&direction.dot(up)<=0))continue;const ndc=direction.project(skyCamera),dx=(ndc.x+1)*bounds.width/2-px,dy=(1-ndc.y)*bounds.height/2-py,squared=dx*dx+dy*dy;if(squared<distance){best=i;distance=squared}}
      if(best>=0)onSelect(catalogue.stars[best].id)
    }
    const canvas=renderer.domElement
    let gesture:{id:number;x:number;y:number;travel:number}|null=null
    const activeView=()=>{const nav=navigation.current;if(values.current.following&&nav.follow)return nav.follow;return nav.orbit??=orbitView(camera.position)}
    const turn=(dx:number,dy:number)=>{const view=activeView();view.yaw-=dx;view.pitch=Math.max(-Math.PI/2+.02,Math.min(Math.PI/2-.02,view.pitch+dy));draw()}
    const zoom=(delta:number)=>{const view=activeView();view.distance=Math.max(values.current.following ? .15 : 1.08,Math.min(60,view.distance*Math.exp(delta)));draw()}
    const down=(event:PointerEvent)=>{if(values.current.progress!==0||event.button!==0||gesture)return;interactionHandler.current();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,travel:0};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true})}
    const move=(event:PointerEvent)=>{if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture.travel+=Math.hypot(dx,dy);gesture.x=event.clientX;gesture.y=event.clientY;if(values.current.progress===0&&gesture.travel>5)turn(dx*.006,dy*.006)}
    const upPointer=(event:PointerEvent)=>{if(event.button!==0||(values.current.progress===0&&!gesture)||(gesture&&gesture.id!==event.pointerId))return;const moved=gesture?.travel??0;gesture=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(moved<=5)pick(event)}
    const cancel=()=>{gesture=null}
    const wheel=(event:WheelEvent)=>{if(values.current.progress!==0)return;event.preventDefault();interactionHandler.current();zoom(Math.max(-.5,Math.min(.5,event.deltaY*(event.deltaMode===1?.03:event.deltaMode===2?.4:.0015))))}
    const keyboard=(event:KeyboardEvent)=>{if(values.current.progress!==0||event.target!==canvas)return;const actions:Record<string,()=>void>={ArrowLeft:()=>turn(-.08,0),ArrowRight:()=>turn(.08,0),ArrowUp:()=>turn(0,-.08),ArrowDown:()=>turn(0,.08),'+':()=>zoom(-.15),'=':()=>zoom(-.15),'-':()=>zoom(.15),Home:()=>resetHandler.current()};if(actions[event.key]){event.preventDefault();interactionHandler.current();actions[event.key]()}}
    const lost=(event:Event)=>{event.preventDefault();onFailure()};canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',upPointer);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keyboard)
    const observer=new ResizeObserver(resize);observer.observe(element);redraw.current=draw;resize()
    return()=>{observer.disconnect();redraw.current=null;renderer.domElement.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',upPointer);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keyboard);for(const resource of [geometry,material,gridGeometry,gridMaterial,starGeometry,starMaterial,issGeometry,issMaterial,trailGeometry,trailMaterial,populationGeometry,populationMaterial,groundGeometry,groundMaterial])resource.dispose();texture?.dispose();renderer.dispose();renderer.domElement.remove();marker.remove()}
  },[onFailure,onSelect,catalogue,orbit,cohorts])
  return <div ref={host} className="scene" style={{opacity}} role="region" aria-label={`Earth-fixed view of Earth, ${catalogue?.stars.length??0} HYG stars and ${cohorts?.movers.length??(orbit?1:0)} retained orbital movers.`}/>
}
