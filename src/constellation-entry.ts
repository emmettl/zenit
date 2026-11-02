import {Scene,PerspectiveCamera,WebGLRenderer,Mesh,MeshPhongMaterial,HemisphereLight,DirectionalLight,BufferGeometry,Float32BufferAttribute,Points,ShaderMaterial,Vector3,Color,Line,LineBasicMaterial,MathUtils} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {eciToEcf,eciToGeodetic,gstime} from 'satellite.js'
import {earthGeometry,earthTexture} from './geography'
import {earthFixedSun} from './illumination'
import {loadConstellation,constellationOrbits,constellationState,featuredPlane,type ConstellationRelease} from './constellation'
import {constellationReveal,constellationPose,orientationCircle,REVEAL_DURATION} from './constellation-composition'
import {blockedByEarth} from './stellar'
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const status=el('chapter-state'),retry=el<HTMLButtonElement>('retry')
function mount(release:ConstellationRelease){
 const host=el('constellation-scene'),orbits=constellationOrbits(release),start=Date.parse(release.study.startUtc),end=Date.parse(release.study.endUtc),plane=featuredPlane(orbits,start),members=new Set(plane.members),reduced=matchMedia('(prefers-reduced-motion: reduce)')
 let time=start,playing=!reduced.matches&&!document.hidden,revealing=!reduced.matches,autoCamera=true,following=false,selected=plane.lead,rate=20,last=performance.now(),failed=false,updating=false
 let states=orbits.map(o=>constellationState(o,time)),previousTarget:Vector3|null=null
 const lead=states[plane.lead]!,fixedNormal=(n:Vector3,gmst:number)=>{const p=eciToEcf({x:n.x,y:n.y,z:n.z},gmst);return new Vector3(p.x,p.z,-p.y)}
 const initialNormal=fixedNormal(lead.normal,gstime(new Date(start))),radial=lead.world.clone().normalize(),along=initialNormal.clone().cross(radial).normalize(),globalDirection=radial.clone().multiplyScalar(2.5).addScaledVector(initialNormal,1.6).addScaledVector(along,2.1)
 const revealOrder=states.map(s=>s?(1-s.normal.dot(plane.normal))/2:1)
 const scene=new Scene(),camera=new PerspectiveCamera(43,1,.015,40),renderer=new WebGLRenderer({antialias:true})
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#05090e');host.append(renderer.domElement)
 const canvas=renderer.domElement;canvas.style.visibility='hidden';canvas.tabIndex=0;canvas.setAttribute('aria-label','Dated constellation view. Drag or use arrow keys to orbit; plus and minus zoom; space pauses. Select a satellite to inspect.')
 const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=.05;controls.maxDistance=12
 const map=earthTexture({width:4096,coastlines:false,edgeSoftness:1.5});map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())
 const earth=new Mesh(earthGeometry(),new MeshPhongMaterial({map,shininess:8,specular:'#42677b'}));scene.add(earth,new HemisphereLight('#b2d6e5','#152738',1.05));const sun=new DirectionalLight('#d7e8ef',2.5);scene.add(sun)
 const geometry=new BufferGeometry(),positions=new Float32BufferAttribute(new Float32Array(orbits.length*3),3),tints=new Float32BufferAttribute(new Float32Array(orbits.length*3),3),strengths=new Float32BufferAttribute(new Float32Array(orbits.length),1),sizes=new Float32BufferAttribute(new Float32Array(orbits.length),1)
 geometry.setAttribute('position',positions);geometry.setAttribute('tint',tints);geometry.setAttribute('strength',strengths);geometry.setAttribute('size',sizes)
 const gold=new Color('#f2d6a3'),cyan=new Color('#79cbe2'),silver=new Color('#bed9e3')
 const material=new ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{ratio:{value:renderer.getPixelRatio()}},vertexShader:`attribute vec3 tint;attribute float strength;attribute float size;uniform float ratio;varying vec3 colour;varying float opacity;void main(){colour=tint;opacity=strength;gl_PointSize=size*ratio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);if(strength<.001)gl_Position=vec4(2.,2.,2.,1.);}`,fragmentShader:`varying vec3 colour;varying float opacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float core=1.-smoothstep(.18,.85,r);gl_FragColor=vec4(colour,opacity*mix(.12,1.,core));}`})
 const dots=new Points(geometry,material);dots.frustumCulled=false;scene.add(dots)
 // Separate orientation diagrams. Never connect catalogue identities with lines.
 const guideIndices=[plane.lead],normals=states.map(s=>s?.normal??null)
 for(const i of orbits.map((_,i)=>i).filter(i=>normals[i]).sort((a,b)=>Number(orbits[a].mover.id)-Number(orbits[b].mover.id))){if(guideIndices.every(j=>normals[i]!.dot(normals[j]!)<Math.cos(Math.PI/180*3)))guideIndices.push(i)}
 const guides=guideIndices.map((index,i)=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(new Float32Array(97*3),3));const line=new Line(g,new LineBasicMaterial({color:i===0?'#79cbe2':'#77929e',transparent:true,opacity:0,depthWrite:false}));line.frustumCulled=false;scene.add(line);return {index,line}})
 const object=el<HTMLSelectElement>('object'),timeInput=el<HTMLInputElement>('time'),speed=el<HTMLSelectElement>('speed'),guideToggle=el<HTMLInputElement>('guides')
 object.replaceChildren(...orbits.map((o,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${o.mover.name} · ${o.mover.id}`;return option}));object.value=String(selected)
 el('plane-description').textContent=`The featured group contains ${plane.members.length} initially eligible records whose orbital normals lie within 1° of ${orbits[plane.lead].mover.name}. Its featured record is chosen deterministically from the densest near-circular 108–111 minute neighbourhood, breaking ties by smallest NORAD identity.`
 el('source-counts').textContent=`${release.statistics.inputRows} source identities → ${orbits.length} retained; ${release.statistics.excludedIdentities} wholly stale exclusions. No visual cap. ${release.statistics.initialEligible} eligible at the opening, ${release.statistics.endEligible} at the end. Changes reflect the age limit, not reentries.`
 el('source-window').textContent='2 November 2026, 10:30–11:00 UTC. One immutable snapshot; no provider requests from visitors. Ground coverage is outside this proof.'
 function fit(){const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(1,height)
  if(innerWidth>800)camera.setViewOffset(width,height,-width*.15,0,width,height)
  else if(innerWidth>650&&innerHeight<=500)camera.setViewOffset(width,height,-width*.2,0,width,height)
  else camera.clearViewOffset()
  camera.updateProjectionMatrix()
 }
 function clearance(){const r=new Vector3(camera.position.x,camera.position.y/(1-1/298.257223563),camera.position.z).length();if(r<1.03)camera.position.multiplyScalar(1.03/Math.max(1e-10,r));const near=Math.min(.05,Math.max(.000001,(Math.max(r,1.03)-1)*.15));if(camera.near!==near){camera.near=near;camera.updateProjectionMatrix()}}
 function draw(){if(updating)return;clearance();renderer.render(scene,camera)}
 function pause(){playing=false;el('play').textContent='Play'}
 function update(){
  updating=true;const began=performance.now(),gmst=gstime(new Date(time)),cue=revealing?Math.min(REVEAL_DURATION,(time-start)/20000):REVEAL_DURATION,beat=constellationReveal(cue)
  states=orbits.map(o=>constellationState(o,time,gmst));let eligible=0,shown=0,planeCount=0
  states.forEach((s,i)=>{if(s)eligible++;if(s&&members.has(i))planeCount++;const alpha=!s?0:i===selected?1:members.has(i)?beat.plane:MathUtils.clamp((beat.whole-revealOrder[i]*.72)/.28,0,1)
   if(alpha>.001)shown++;positions.setXYZ(i,...(s?.world.toArray()??[0,0,0]));strengths.setX(i,alpha);sizes.setX(i,i===selected?12:members.has(i)?5.5:4.2);const c=i===selected?gold:members.has(i)?cyan:silver;tints.setXYZ(i,c.r,c.g,c.b)
  });for(const a of [positions,tints,strengths,sizes])a.needsUpdate=true
  const p=states[plane.lead]
  if(autoCamera&&p){const pose=constellationPose(cue,p.world,fixedNormal(p.normal,gmst),globalDirection,camera.aspect);camera.position.copy(pose.position);controls.target.copy(pose.target);camera.up.copy(pose.up);controls.update()}
  const chosen=states[selected]
  if(following){if(chosen){if(previousTarget)camera.position.add(chosen.world.clone().sub(previousTarget));controls.target.copy(chosen.world);previousTarget=chosen.world.clone();controls.update()}else{following=false;previousTarget=null;controls.target.set(0,0,0)}}
  guides.forEach(({index,line},i)=>{const s=states[index];line.visible=guideToggle.checked&&Boolean(s)&&(i===0?beat.plane:beat.whole)>.001;if(!line.visible||!s)return
   const points=orientationCircle(s.world,fixedNormal(s.normal,gmst),96),attr=line.geometry.getAttribute('position');points.forEach((p,j)=>attr.setXYZ(j,p.x,p.y,p.z));attr.needsUpdate=true
   line.geometry.setDrawRange(0,i===0?Math.max(2,Math.round(97*beat.plane)):97);line.material.opacity=i===0?.32*beat.plane:.065*beat.whole
  })
  sun.position.copy(earthFixedSun(time).normalize().multiplyScalar(5));const utc=new Date(time).toISOString().replace('T',' ').slice(0,19)+' UTC'
  el('utc').textContent=utc;timeInput.value=String((time-start)/1000);timeInput.setAttribute('aria-valuetext',utc);el('pace-label').textContent=`${rate}× MODEL TIME`
  const titles=['Stay with one light.','The neighbours share a plane.','A pattern around Earth.'],notes=['A single dated orbital record. We travel with it as Earth turns below.',`${planeCount} eligible records in the featured orientation group. Cyan lights reveal their shared geometry.`,`${eligible} age-eligible records from the retained OneWeb source group, all moving at the same UTC.`]
  el('stage-number').textContent=['01 / ONE SATELLITE','02 / ONE PLANE','03 / THE CONSTELLATION'][beat.stage];el('stage-title').textContent=titles[beat.stage];el('stage-note').textContent=notes[beat.stage]
  el('view-label').textContent=following?'FOLLOWING SELECTED RECORD':autoCamera?['FOLLOWING ONE SATELLITE','OPENING OUT ALONG THE PLANE','THE WIDER STRUCTURE'][beat.stage]:'FREE CAMERA'
  el('featured-name').textContent=orbits[selected].mover.name;el('population').textContent=`${shown} revealed / ${eligible} age-eligible / ${orbits.length} retained`
  el('playback-note').textContent=revealing?'An authored reveal of a dated snapshot; not a deployment history.':'Explore the retained population. Playback stops at the study bounds.'
  document.querySelectorAll<HTMLButtonElement>('.waypoints button[data-cue]').forEach((b,i)=>b.setAttribute('aria-pressed',String(beat.stage===i)))
  el('play').textContent=playing?'Pause':'Play';el('follow').textContent=following?'Stop following':'Follow selected satellite';el('follow').setAttribute('aria-pressed',String(following));el<HTMLButtonElement>('follow').disabled=!chosen
  if(!el('source-panel').hidden){const o=orbits[selected],height=chosen?eciToGeodetic(chosen.teme,gmst).height:null,entries=[['Identity',`NORAD ${o.mover.id}`],['Height',height===null?'Outside age window':`${height.toFixed(1)} km`],['Mean period',`${(1440/Number(o.mover.element.MEAN_MOTION)).toFixed(2)} min`],['Element offset',`${((time-o.epoch)/3600000).toFixed(2)} h`],['Epoch',o.mover.element.EPOCH]];el('readings').replaceChildren(...entries.flatMap(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;return[dt,dd]}))}
  canvas.dataset.time=String(time);canvas.dataset.cue=String(cue);canvas.dataset.stage=String(beat.stage);canvas.dataset.shown=String(shown);canvas.dataset.eligible=String(eligible);canvas.dataset.planeCount=String(planeCount);canvas.dataset.featured=orbits[plane.lead].mover.id;canvas.dataset.selected=orbits[selected].mover.id;canvas.dataset.following=following?orbits[selected].mover.id:'';canvas.dataset.playing=String(playing);canvas.dataset.camera=autoCamera?'guided':following?'following':'free';canvas.dataset.sampleMs=(performance.now()-began).toFixed(2);canvas.dataset.position=chosen?chosen.world.toArray().join(','):''
  updating=false;draw()
 }
 function explore(){revealing=false;autoCamera=false;following=false;previousTarget=null;pause()}
 function seek(seconds:number){pause();following=false;previousTarget=null;time=Math.max(start,Math.min(end,start+seconds*1000));update()}
 function toggle(){if(failed)return;if(playing)pause();else{if(time>=end)time=start;playing=true;last=performance.now()}update()}
 function replay(){time=start;rate=20;speed.value='20';revealing=!reduced.matches;autoCamera=true;following=false;selected=plane.lead;object.value=String(selected);previousTarget=null;playing=!reduced.matches&&!document.hidden&&!failed;last=performance.now();update()}
 timeInput.oninput=()=>{if(Number(timeInput.value)>=REVEAL_DURATION*20)revealing=false;seek(Number(timeInput.value))};el('play').onclick=toggle;el('replay').onclick=replay
 document.querySelectorAll<HTMLButtonElement>('.waypoints button[data-cue]').forEach(b=>b.onclick=()=>{revealing=Number(b.dataset.cue)<REVEAL_DURATION;autoCamera=true;selected=plane.lead;object.value=String(selected);seek(Number(b.dataset.cue)*20)})
 speed.onchange=()=>{rate=Number(speed.value);last=performance.now();update()}
 el('frame').onclick=()=>{explore();controls.target.set(0,0,0);camera.up.set(0,1,0);camera.position.copy(globalDirection).normalize().multiplyScalar(3.9*Math.max(1,1/camera.aspect));controls.update();update()}
 object.onchange=()=>{explore();selected=Number(object.value);update()}
 el('follow').onclick=()=>{const wasFollowing=following;explore();following=!wasFollowing;if(following&&states[selected]){const p=states[selected]!.world;controls.target.copy(p);camera.position.copy(p).addScaledVector(p.clone().normalize(),.8).add(new Vector3(.2,.2,.2));previousTarget=p.clone();controls.update()}update()}
 guideToggle.onchange=()=>update()
 const sources=el('sources'),panel=el('source-panel');function close(){panel.hidden=true;sources.setAttribute('aria-expanded','false');sources.focus({preventScroll:true})}
 sources.onclick=()=>{panel.hidden=!panel.hidden;sources.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){pause();update();el('close-sources').focus({preventScroll:true})}};el('close-sources').onclick=close
 controls.addEventListener('start',()=>{autoCamera=false;following=false;previousTarget=null;pause();update()});controls.addEventListener('change',draw)
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();autoCamera=false;following=false;previousTarget=null;pause();const offset=camera.position.clone().sub(controls.target);if(e.key==='+'||e.key==='-')offset.multiplyScalar(e.key==='+'?.9:1.1);else offset.applyAxisAngle(e.key==='ArrowUp'||e.key==='ArrowDown'?new Vector3(1,0,0):new Vector3(0,1,0),(e.key==='ArrowLeft'||e.key==='ArrowUp'?1:-1)*.06);camera.position.copy(controls.target).add(offset);controls.update();update()}
 let drag:{x:number;y:number;distance:number}|null=null
 canvas.addEventListener('pointerdown',e=>{drag=e.isPrimary?{x:e.clientX,y:e.clientY,distance:0}:null});canvas.addEventListener('pointermove',e=>{if(drag)drag.distance=Math.max(drag.distance,Math.hypot(e.clientX-drag.x,e.clientY-drag.y))});canvas.addEventListener('pointercancel',()=>drag=null)
 canvas.addEventListener('pointerup',e=>{if(!drag||drag.distance>8){drag=null;return}drag=null;const rect=canvas.getBoundingClientRect();let winner=-1,distance=196
  states.forEach((s,i)=>{if(!s||strengths.getX(i)<.1)return;const d=s.world.clone().sub(camera.position);if(blockedByEarth(camera.position,d.clone().normalize(),d.length()))return;const p=s.world.clone().project(camera);if(p.z< -1||p.z>1)return;const squared=(rect.left+(p.x+1)*rect.width/2-e.clientX)**2+(rect.top+(1-p.y)*rect.height/2-e.clientY)**2;if(squared<distance){winner=i;distance=squared}})
  if(winner>=0){explore();selected=winner;object.value=String(selected);panel.hidden=false;sources.setAttribute('aria-expanded','true');update();el('close-sources').focus({preventScroll:true})}
 })
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();return}if(e.code==='Space'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&(e.target===document.body||e.target===canvas)){e.preventDefault();if(!e.repeat)toggle()}})
 reduced.addEventListener('change',()=>{if(reduced.matches){pause();revealing=false;update()}});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();update()}})
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;pause();document.documentElement.dataset.constellation='error';status.hidden=false;status.textContent='Graphics interrupted. Reload to restore the retained snapshot.';retry.hidden=false})
 new ResizeObserver(()=>{fit();update()}).observe(host);fit();camera.position.copy(globalDirection);camera.lookAt(0,0,0);renderer.compile(scene,camera);renderer.render(scene,camera);update();canvas.style.visibility='';last=performance.now()
 function tick(now:number){if(playing&&now-last>=33){const dt=(now-last)/1000;last=now;const next=time+dt*rate*1000,limit=revealing?start+REVEAL_DURATION*20000:end;time=Math.min(limit,Math.max(start,next));if(time>=limit){pause();if(revealing)revealing=false}update()}requestAnimationFrame(tick)}requestAnimationFrame(tick)
}
let controller:AbortController|undefined
async function load(){controller?.abort();controller=new AbortController();status.hidden=false;retry.hidden=true;status.textContent='Opening the retained constellation…';try{const release=await loadConstellation(controller.signal);mount(release);document.documentElement.dataset.constellation='ready';status.hidden=true}catch(e){document.documentElement.dataset.constellation='error';status.textContent=e instanceof Error?e.message:'Constellation unavailable';retry.hidden=false}}
retry.onclick=()=>{if(document.querySelector('canvas'))location.reload();else void load()};void load()
