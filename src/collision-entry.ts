import {Scene,PerspectiveCamera,WebGLRenderer,Mesh,MeshPhongMaterial,HemisphereLight,DirectionalLight,BufferGeometry,Vector3,Line,LineBasicMaterial,LineSegments,Float32BufferAttribute,Object3D,Group} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {earthGeometry,earthTexture} from './geography'
import {POLAR_RATIO} from './camera'
import {PARENTS,PERIOD,RADIUS,START,END,RELATIVE_SPEED,GUIDED_DURATION,SAMPLES_PER_FAMILY,experiment,guidedTime,guidedCue,cloudHistory} from './collision-model'
import {world,cloudFrame,composition} from './collision-composition'
import {bodyGlyph,fragmentGlyphs,FAMILY_COLOURS} from './collision-glyphs'

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const status=element('simulation-state')
function mount(){
  const host=element('simulation-scene'),scene=new Scene(),camera=new PerspectiveCamera(43,1,.000001,8)
  const renderer=new WebGLRenderer({antialias:true});renderer.setClearColor('#05090e');renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement)
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Synthetic collision view. Drag or use arrow keys to orbit; plus and minus zoom; space pauses.')
  const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=.000004;controls.maxDistance=12
  const inertial=new Group(),origin=new Vector3();scene.add(inertial)
  const earth=new Mesh(earthGeometry(),new MeshPhongMaterial({map:earthTexture(),shininess:8,specular:'#42677b'}));inertial.add(earth)
  scene.add(new HemisphereLight('#c3e4ef','#354355',1.45));const sun=new DirectionalLight('#e7eef1',2.3);sun.position.set(4,3,4);scene.add(sun)
  const paths=PARENTS.map((orbit,family)=>{
    const geometry=new BufferGeometry().setFromPoints(Array.from({length:257},(_,i)=>world(orbit.at(i*PERIOD/256).position)))
    const line=new Line(geometry,new LineBasicMaterial({color:FAMILY_COLOURS[family],transparent:true,opacity:.13}));line.visible=false;inertial.add(line);return line
  })
  const count=SAMPLES_PER_FAMILY*2,shards=fragmentGlyphs(count),dummy=new Object3D(),bodies=[bodyGlyph(0),bodyGlyph(1)]
  scene.add(shards,...bodies)
  // Sparse histories share the physical clock and reveal velocity within the cloud.
  const trailGeometry=new BufferGeometry(),trailPositions=new Float32Array(24*4*2*3)
  trailGeometry.setAttribute('position',new Float32BufferAttribute(trailPositions,3))
  const trailMaterial=new LineBasicMaterial({color:'#83b8cb',transparent:true,opacity:.2,depthWrite:false}),trails=new LineSegments(trailGeometry,trailMaterial);trails.frustumCulled=false;scene.add(trails)
  const timeInput=element<HTMLInputElement>('time'),spread=element<HTMLInputElement>('spread'),pace=element<HTMLSelectElement>('pace'),play=element<HTMLButtonElement>('play'),reduced=matchMedia('(prefers-reduced-motion: reduce)')
  let run=experiment(Number(spread.value)),time=START,cue=0,playing=!reduced.matches&&!document.hidden,autoCamera=true,followCloud=false,last=performance.now(),failed=false,updating=false,reveal=0
  let currentPositions:Vector3[]=[],extent=0
  timeInput.max=String(GUIDED_DURATION)
  element('relative-speed').textContent=`${RELATIVE_SPEED.toFixed(2)} km/s`;element('original-period').textContent=`${(PERIOD/60).toFixed(1)} minutes`
  function periods(){for(const family of [0,1])element(family===0?'period-a':'period-b').textContent=`${family===0?'A':'B'} · ${(run.periods[family][0]/60).toFixed(2)}–${(run.periods[family][1]/60).toFixed(2)} minutes`}
  periods()
  const fullPosition=new Vector3(3,1.6,2.5)
  function fit(){
    const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height
    if(innerWidth>800)camera.setViewOffset(width,height,-width*.16,0,width,height)
    else if(innerWidth>650&&innerHeight<=500)camera.setViewOffset(width,height,-width*.23,0,width,height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  function clearance(){
    const absolute=camera.position.clone().add(origin),radius=new Vector3(absolute.x,absolute.y/POLAR_RATIO,absolute.z).length()
    if(radius<1.03){absolute.multiplyScalar(1.03/Math.max(radius,1e-12));camera.position.copy(absolute).sub(origin)}
    const distance=camera.position.distanceTo(controls.target),near=Math.max(1e-10,Math.min(.05,distance*.008,(Math.max(radius,1.03)-1)*.15)),far=Math.max(5,distance+2.5)
    if(camera.near!==near||camera.far!==far){camera.near=near;camera.far=far;camera.updateProjectionMatrix()}
  }
  function project(p:Vector3){const rect=canvas.getBoundingClientRect(),v=p.clone().sub(origin).project(camera);return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2,visible:Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z>=-1&&v.z<=1}}
  function overlays(){
    for(const family of [0,1]){
      const label=element(family===0?'label-a':'label-b');label.hidden=time>=0;if(time>=0)continue
      const p=project(world(PARENTS[family].at(time).position));label.hidden=!p.visible;label.style.left=`${p.x+18}px`;label.style.top=`${p.y+(family===0?18:-40)}px`
    }
    const pulse=element('contact-cue'),p=project(world(PARENTS[0].initial.position));pulse.hidden=time<0||time>1||!p.visible
    pulse.style.left=`${p.x}px`;pulse.style.top=`${p.y}px`;pulse.style.opacity=String(1-Math.max(0,time));pulse.style.transform=`translate(-50%,-50%) scale(${1+Math.max(0,time)*2})`
    const pixelWorld=2*camera.position.distanceTo(controls.target)*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight,km=80*pixelWorld*RADIUS
    element('scale-value').textContent=km<1?`${Math.round(km*1000)} m`:km<100?`${km.toFixed(1)} km`:`${Math.round(km).toLocaleString('en-GB')} km`
  }
  function draw(){if(updating)return;clearance();overlays();renderer.render(scene,camera)}
  function pause(){playing=false;play.textContent='Play'}
  function stage(){
    const step=time<-.2?0:time<=0?1:time<600?2:time<PERIOD?3:4
    const titles=['Two bodies. A closing gap.','A fraction of a second.','Travel with the cloud.','Now let Earth back in.','One moment. Hours of consequence.']
    const notes=['Slow into a synthetic encounter, 800 km above Earth. The body shapes are illustrative.','At contact, two bodies become hundreds of fragments. Slow time makes the instant readable.','We follow cloud A. Its fragments separate in every direction; the other cloud has already moved away.','Pull back from the fragments to see their different orbital paths. Faster and slower loops stretch the cloud.','The cloud keeps its depth, but spreads much farther along the orbit. Change the velocity spread and replay.']
    element('stage-number').textContent=`0${step+1} / ${['APPROACH','CONTACT','INSIDE THE CLOUD','RETURN TO EARTH','EVOLUTION'][step]}`
    element('stage-title').textContent=titles[step];element('stage-note').textContent=notes[step]
    const seconds=Math.round(Math.abs(time)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60)
    element('elapsed').textContent=time<0?`${(-time).toFixed(time< -1?1:3)} s to contact`:time===0?'Contact · t = 0':time<10?`+${time.toFixed(2)} s`:`+${hours?`${hours}h `:''}${minutes}m ${String(seconds%60).padStart(2,'0')}s`
    element('orbit-count').textContent=time<=0?'800 KM / SYNTHETIC':`${(time/PERIOD).toFixed(2)} ORIGINAL ORBITS`
    timeInput.value=String(cue);timeInput.setAttribute('aria-valuetext',element('elapsed').textContent!)
    element('population').textContent=time<0?'Two synthetic bodies':`${count} samples / two clouds`
    element('view-title').textContent=autoCamera?(time<0?'CLOSING IN':reveal<.05?'TRAVELLING WITH CLOUD A':reveal<1?'PULLING BACK':'THE ORBITAL AFTERMATH'):'FREE CAMERA'
    element('view-detail').textContent=time>0&&reveal<.05?`Cloud A spans ${(extent*2*RADIUS).toFixed(extent*2*RADIUS<1?2:1)} km`:'One linear distance scale'
    const milestones=[START,0,60,PERIOD,END]
    document.querySelectorAll<HTMLButtonElement>('.waypoints button').forEach((button,i)=>button.setAttribute('aria-pressed',String(Math.abs(time-milestones[i])<.01)))
  }
  function update(){
    updating=true
    const before=time<0
    currentPositions=before?PARENTS.map(orbit=>world(orbit.at(time).position)):run.samples.map(s=>world(s.orbit.at(time).position))
    const cloud=cloudFrame(before?[world(PARENTS[0].at(0).position)]:currentPositions.slice(0,SAMPLES_PER_FAMILY),time);extent=cloud.extent
    if(autoCamera){const pose=composition(time,cloud,camera.aspect,followCloud);origin.copy(pose.target);camera.position.copy(pose.position).sub(origin);controls.target.set(0,0,0);camera.up.copy(pose.up);reveal=pose.reveal;controls.update()}
    inertial.position.copy(origin).negate();earth.rotation.y=time*7.292115e-5
    const pixelWorld=2*camera.position.distanceTo(controls.target)*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight
    shards.visible=!before
    if(!before){
      currentPositions.forEach((p,i)=>{
        dummy.position.copy(p).sub(origin);const size=pixelWorld*(i%47===0?6:1.3+(i*17%31)/18),turn=Math.log1p(Math.max(0,time))*.7
        dummy.rotation.set(i*.83+turn,i*1.13-turn*.7,i*.47+turn*.4);dummy.scale.set(size*(.5+(i%5)*.25),size*.45,size*(.6+(i%7)*.13));dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix)
      });shards.instanceMatrix.needsUpdate=true
    }
    bodies.forEach((body,family)=>{body.visible=before;if(!before)return;body.position.copy(currentPositions[family]).sub(origin);body.scale.setScalar(pixelWorld*(10+12*(1-Math.min(1,Math.abs(time)/15))));body.rotation.set(.3+family*.8,.4-family*.9,family===0?.45:-.5)})
    trails.visible=time>0&&time<2400&&autoCamera;trailMaterial.opacity=.18*(1-reveal)
    if(trails.visible){let cursor=0;const attr=trailGeometry.getAttribute('position'),history=Math.min(10,time*.32)
      for(let n=0;n<24;n++){const sample=run.samples[n*13];for(let segment=0;segment<4;segment++)for(const side of [0,1]){const past=Math.max(0,time-history*(4-segment-side)/4),p=world(cloudHistory(sample,run.centres[sample.family],time,past)).sub(origin);attr.setXYZ(cursor++,p.x,p.y,p.z)}}attr.needsUpdate=true
    }
    stage();canvas.dataset.time=String(time);canvas.dataset.count=String(before?2:count);canvas.dataset.spread=String(run.spread);canvas.dataset.camera=autoCamera?(followCloud?'cloud':'guided'):'free';canvas.dataset.playing=String(playing);canvas.dataset.reveal=String(reveal);canvas.dataset.cloudSpanKm=String(extent*2*RADIUS)
    play.textContent=playing?'Pause':'Play';updating=false;draw()
  }
  function seek(next:number){pause();time=Math.max(START,Math.min(END,next));cue=guidedCue(time);update()}
  function toggle(){if(failed)return;if(playing)pause();else{if(time>=END){time=START;cue=0}playing=true;last=performance.now()}update()}
  play.onclick=toggle;timeInput.oninput=()=>{pause();cue=Number(timeInput.value);time=guidedTime(cue);update()}
  const jumps:Record<string,number>={approach:START,release:0,cloud:60,orbit:PERIOD,end:END}
  document.querySelectorAll<HTMLButtonElement>('.waypoints button').forEach(button=>button.onclick=()=>seek(jumps[button.dataset.time!]))
  spread.oninput=()=>{pause();run=experiment(Number(spread.value));element('spread-value').textContent=`≤ ${run.spread} m/s`;periods();update()}
  pace.onchange=()=>{cue=guidedCue(time);last=performance.now()}
  element('replay').onclick=()=>{time=START;cue=0;pace.value='guided';autoCamera=true;followCloud=false;playing=!reduced.matches&&!document.hidden&&!failed;last=performance.now();update()}
  element('frame').onclick=()=>{autoCamera=false;origin.set(0,0,0);controls.target.set(0,0,0);camera.up.set(0,1,0);camera.position.copy(fullPosition).multiplyScalar(Math.max(1,1/camera.aspect));reveal=1;controls.update();update()}
  element('cloud').onclick=()=>{autoCamera=true;followCloud=true;update()}
  element<HTMLInputElement>('paths').onchange=e=>{paths.forEach(line=>line.visible=(e.target as HTMLInputElement).checked);draw()}
  const panel=element('model-panel'),model=element('model')
  function closeModel(){panel.hidden=true;model.setAttribute('aria-expanded','false');model.focus({preventScroll:true})}
  model.onclick=()=>{panel.hidden=!panel.hidden;model.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){pause();update();element('close-model').focus({preventScroll:true})}}
  element('close-model').onclick=closeModel;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closeModel()})
  controls.addEventListener('start',()=>{autoCamera=false;update()});controls.addEventListener('change',draw)
  canvas.onkeydown=e=>{
    if(e.code==='Space'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();if(!e.repeat)toggle();return}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return
    e.preventDefault();autoCamera=false;const offset=camera.position.clone().sub(controls.target)
    if(e.key==='+'||e.key==='-')offset.multiplyScalar(e.key==='+'?.9:1.1)
    else offset.applyAxisAngle(e.key==='ArrowUp'||e.key==='ArrowDown'?new Vector3(1,0,0):camera.up,(e.key==='ArrowLeft'||e.key==='ArrowUp'?1:-1)*.06)
    camera.position.copy(controls.target).add(offset);controls.update();update()
  }
  reduced.addEventListener('change',()=>{if(reduced.matches){pause();update()}});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();update()}})
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;pause();status.hidden=false;status.textContent='The graphics context was interrupted. Reload to reopen the experiment.'})
  new ResizeObserver(()=>{fit();update()}).observe(host)
  fit();update();status.hidden=true;document.documentElement.dataset.simulation='ready'
  function tick(now:number){const dt=Math.max(0,(now-last)/1000);last=now
    if(playing){if(pace.value==='guided'){cue=Math.min(GUIDED_DURATION,cue+dt);time=guidedTime(cue)}else{time=Math.min(END,time+dt*Number(pace.value));cue=guidedCue(time)}if(time>=END)pause();update()}
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
try{mount()}catch(error){document.documentElement.dataset.simulation='error';status.hidden=false;status.textContent=error instanceof Error?`The experiment could not open: ${error.message}`:'The experiment could not open.'}
