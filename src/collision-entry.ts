import {Scene,PerspectiveCamera,WebGLRenderer,Mesh,MeshPhongMaterial,HemisphereLight,AmbientLight,DirectionalLight,BufferGeometry,Vector3,Line,LineBasicMaterial,LineSegments,Float32BufferAttribute,Object3D,Group} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {earthGeometry,earthTexture} from './geography'
import {POLAR_RATIO} from './camera'
import {PARENTS,PERIOD,RADIUS,START,END,SECONDARY_TIME,RELATIVE_SPEED,SAMPLES_PER_FAMILY,SECONDARY_SAMPLES,experiment,guidedTime,guidedCue,guidedDuration,cloudHistory,alive,sampleAt} from './collision-model'
import {world,cloudFrame,composition} from './collision-composition'
import {bodyGlyph,fragmentGlyphs,FAMILY_COLOURS} from './collision-glyphs'
import {mountSpreadView} from './collision-spread-view'

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const status=element('simulation-state')
function mount(){
  const host=element('simulation-scene'),scene=new Scene(),camera=new PerspectiveCamera(43,1,.000001,8)
  const renderer=new WebGLRenderer({antialias:true});renderer.setClearColor('#05090e');renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement)
  const canvas=renderer.domElement;canvas.style.visibility='hidden';canvas.tabIndex=0;canvas.setAttribute('aria-label','Synthetic collision view. Drag or use arrow keys to orbit; plus and minus zoom; space pauses.')
  const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=.000004;controls.maxDistance=12
  const inertial=new Group(),origin=new Vector3();scene.add(inertial)
  const geography=earthTexture({width:4096,coastlines:false,edgeSoftness:1.5});geography.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())
  const earth=new Mesh(earthGeometry(),new MeshPhongMaterial({map:geography,shininess:8,specular:'#42677b'}));inertial.add(earth)
  scene.add(new HemisphereLight('#c3e4ef','#354355',1.45),new AmbientLight('#ffffff',.4));const sun=new DirectionalLight('#e7eef1',2.3);sun.position.set(4,3,4);scene.add(sun)
  const paths=PARENTS.map((orbit,family)=>{
    const geometry=new BufferGeometry().setFromPoints(Array.from({length:257},(_,i)=>world(orbit.at(i*PERIOD/256).position)))
    const line=new Line(geometry,new LineBasicMaterial({color:FAMILY_COLOURS[family],transparent:true,opacity:.13}));line.visible=false;inertial.add(line);return line
  })
  const count=SAMPLES_PER_FAMILY*2,shards=fragmentGlyphs(count+SECONDARY_SAMPLES,SAMPLES_PER_FAMILY),dummy=new Object3D(),bodies=[bodyGlyph(0),bodyGlyph(1)],target=bodyGlyph(2)
  scene.add(shards,...bodies,target)
  // Sparse histories share the physical clock and reveal velocity within the cloud.
  const trailGeometry=new BufferGeometry(),trailPositions=new Float32Array(24*4*2*3)
  trailGeometry.setAttribute('position',new Float32BufferAttribute(trailPositions,3))
  const trailMaterial=new LineBasicMaterial({color:'#83b8cb',transparent:true,opacity:.2,depthWrite:false}),trails=new LineSegments(trailGeometry,trailMaterial);trails.frustumCulled=false;scene.add(trails)
  const timeInput=element<HTMLInputElement>('time'),spread=element<HTMLInputElement>('spread'),pace=element<HTMLSelectElement>('pace'),play=element<HTMLButtonElement>('play'),reduced=matchMedia('(prefers-reduced-motion: reduce)')
  let run=experiment(Number(spread.value)),time=START,cue=0,playing=!reduced.matches&&!document.hidden,autoCamera=true,followCloud=false,last=performance.now(),failed=false,updating=false,reveal=0
  let currentPositions:Vector3[]=[],extent=0,outerScale=1,activeCount=count,focusFamily=0
  const spreadView=mountSpreadView(element('spread-plot'))
  const secondaryOn=()=>Boolean(run.secondary)
  timeInput.max=String(guidedDuration())
  element('relative-speed').textContent=`${RELATIVE_SPEED.toFixed(2)} km/s`;element('original-period').textContent=`${(PERIOD/60).toFixed(1)} minutes`
  function periods(){
    for(const family of [0,1])element(family===0?'period-a':'period-b').textContent=`${family===0?'A':'B'} · ${(run.periods[family][0]/60).toFixed(2)}–${(run.periods[family][1]/60).toFixed(2)} minutes`
    outerScale=Math.max(1,Math.max(...run.samples.map(s=>s.orbit.apogee+RADIUS))/RADIUS/1.45)
    element('secondary-readings').textContent=run.secondary?`Controlled encounter at orbit 100: ${run.secondary.projectileMass} kg fragment / ${run.secondary.targetMass.toLocaleString('en-GB')} kg target · ${run.secondary.relativeSpeed.toFixed(2)} km/s relative speed · ${run.secondary.specificEnergy.toFixed(1)} J/g of target. ${SECONDARY_SAMPLES} new representative samples, maximum release kick ${Math.round(run.secondary.kickMaximum)} m/s.`:'Secondary places a synthetic target in the path of a surviving fragment at orbit 100. It is a conditional demonstration of another breakup, with its incoming energy and new release calculated explicitly.'
    timeInput.max=String(guidedDuration(secondaryOn()));element('secondary').setAttribute('aria-pressed',String(secondaryOn()))
  }
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
    const distance=camera.position.distanceTo(controls.target),near=Math.max(1e-10,Math.min(.05,distance*.008,(Math.max(radius,1.03)-1)*.15)),far=Math.max(5,distance+Math.max(2.5,outerScale*2))
    if(camera.near!==near||camera.far!==far){camera.near=near;camera.far=far;camera.updateProjectionMatrix()}
  }
  function project(p:Vector3){const rect=canvas.getBoundingClientRect(),v=p.clone().sub(origin).project(camera);return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2,visible:Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z>=-1&&v.z<=1}}
  function overlays(){
    const event=run.secondary&&time>=SECONDARY_TIME-30?run.secondary:null,age=event?time-event.time:time
    for(const family of [0,1]){
      const label=element(family===0?'label-a':'label-b');label.hidden=age>=0;if(age>=0)continue
      label.textContent=event?(family===0?'fragment':'target'):(family===0?'A':'B')
      const position=event?(family===0?sampleAt(run.samples[event.sourceIndex],time).position:event.target.at(age).position):PARENTS[family].at(time).position
      const p=project(world(position));label.hidden=!p.visible;label.style.left=`${p.x+18}px`;label.style.top=`${p.y+(family===0?18:-40)}px`
    }
    const pulse=element('contact-cue'),p=project(world(event?event.position:PARENTS[0].initial.position));pulse.hidden=age<0||age>1||!p.visible
    pulse.style.left=`${p.x}px`;pulse.style.top=`${p.y}px`;pulse.style.opacity=String(1-Math.max(0,age));pulse.style.transform=`translate(-50%,-50%) scale(${1+Math.max(0,age)*2})`
    const pixelWorld=2*camera.position.distanceTo(controls.target)*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight,km=80*pixelWorld*RADIUS
    element('scale-value').textContent=km<1?`${Math.round(km*1000)} m`:km<100?`${km.toFixed(1)} km`:`${Math.round(km).toLocaleString('en-GB')} km`
  }
  function draw(){if(updating)return;clearance();overlays();renderer.render(scene,camera)}
  function pause(){playing=false;play.textContent='Play'}
  function stage(){
    const event=run.secondary&&time>=SECONDARY_TIME-30?run.secondary:null,age=event?time-event.time:time
    let title='',note='',chapter=''
    if(event&&age<0){chapter='SECONDARY / A CONDITIONAL ENCOUNTER';title='One fragment. Another body.';note='A surviving fragment meets a synthetic target. The encounter is prescribed at orbit 100.'}
    else if(event&&age<1){chapter='SECONDARY / CONTACT';title='The next cloud begins.';note=`${event.relativeSpeed.toFixed(1)} km/s relative speed. The target and projectile are replaced by a new debris family.`}
    else if(event&&age<2400){chapter='SECONDARY / CLOUD C';title='A different family of orbits.';note='The new pink fragments inherit the target’s motion and their own release kicks.'}
    else if(run.secondary&&time>=SECONDARY_TIME-5*PERIOD&&time<SECONDARY_TIME){chapter='SECONDARY / ANOTHER ENCOUNTER';title='Follow one fragment.';note='A second body now enters its path. Watch the controlled encounter at orbit 100.'}
    else if(time<-.2){chapter='01 / APPROACH';title='Two bodies. A closing gap.';note='800 km above Earth. Two paths are about to cross.'}
    else if(time<=0){chapter='02 / CONTACT';title='A fraction of a second.';note='One encounter sends fragments onto different paths. Their orbital periods and their heights change immediately.'}
    else if(time<600){chapter='03 / INSIDE THE CLOUD';title='Travel with the cloud.';note='We follow cloud A as its fragments separate. The other cloud continues on its own path.'}
    else if(time<10*PERIOD){chapter='04 / MANY DIFFERENT ORBITS';title='More than two chains.';note='Release velocities change perigee, apogee and inclination. Open Orbits & model to inspect the range.'}
    else if(time<100*PERIOD){chapter='05 / DIFFERENTIAL PRECESSION';title='The planes drift apart.';note=run.j2?'Earth’s oblateness turns each orbit at a different rate. Watch the bands widen over days.':'J₂ is off. Each orbital plane stays fixed while fragments spread around it.'}
    else{chapter=event?'06 / MORE POSSIBLE ENCOUNTERS':'06 / HUNDREDS OF ORBITS';title=event?'A new cloud joins the field.':'Weeks of divergence.';note=event?'More fragments, more possible encounters. The new pink family is now part of the field.':'Five hundred original orbits cover about 35 days. Try Secondary to model a fragment striking another body.'}
    element('stage-number').textContent=chapter;element('stage-title').textContent=title;element('stage-note').textContent=note
    const seconds=Math.round(Math.abs(time)),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60)
    element('elapsed').textContent=time<0?`${(-time).toFixed(time< -1?1:3)} s to contact`:time===0?'Contact · t = 0':time<10?`+${time.toFixed(2)} s`:days?`+${days}d ${hours}h ${minutes}m`:`+${hours?`${hours}h `:''}${minutes}m ${String(seconds%60).padStart(2,'0')}s`
    element('orbit-count').textContent=time<=0?'800 KM / SYNTHETIC':`${(time/PERIOD).toFixed(time/PERIOD<10?2:0)} ORIGINAL ORBITS`
    timeInput.value=String(cue);timeInput.setAttribute('aria-valuetext',element('elapsed').textContent!)
    element('population').textContent=time<0?'Two synthetic bodies':`${activeCount} active samples${event&&age>=0?' / A + B + C':' / A + B'}`
    element('view-title').textContent=autoCamera?(age<0?'CLOSING IN':reveal<.05?`TRAVELLING WITH CLOUD ${focusFamily===2?'C':'A'}`:reveal<1?'PULLING BACK':'THE ORBITAL AFTERMATH'):'FREE CAMERA'
    element('view-detail').textContent=age>0&&reveal<.05?`Cloud spans ${(extent*2*RADIUS).toFixed(extent*2*RADIUS<1?2:1)} km`:`${run.j2?'J₂ precession':'Fixed orbital planes'} / linear distance scale`
    const milestones:Record<string,number>={approach:START,cloud:60,orbit:10*PERIOD,end:END}
    document.querySelectorAll<HTMLButtonElement>('.waypoints button[data-time]').forEach(button=>button.setAttribute('aria-pressed',String(Math.abs(time-milestones[button.dataset.time!])<.01)))
  }
  function update(){
    updating=true
    const before=time<0,event=run.secondary,secondFocus=Boolean(event&&time>=event.time-30),age=secondFocus?time-event!.time:time
    focusFamily=secondFocus?2:0
    currentPositions=before?PARENTS.map(orbit=>world(orbit.at(time).position)):run.samples.map(sample=>world(sampleAt(sample,time).position))
    const focusIndices=run.samples.map((s,i)=>({s,i})).filter(({s})=>s.family===focusFamily&&alive(s,time)),mean=run.centres[focusFamily].at(Math.max(0,age))
    const cloud=cloudFrame(focusIndices.length?focusIndices.map(({i})=>currentPositions[i]):[world(mean.position)],Math.max(0,age),mean.velocity);extent=cloud.extent
    if(autoCamera){
      const incoming: [Vector3,Vector3]|undefined=secondFocus&&age<0?[currentPositions[event!.sourceIndex],world(event!.target.at(age).position)]:undefined
      const pose=composition(age,cloud,camera.aspect,followCloud,incoming,outerScale)
      if(event&&!secondFocus&&!followCloud&&time>=event.time-5*PERIOD){
        const raw=(time-(event.time-5*PERIOD))/(5*PERIOD-30),blend=raw*raw*(3-2*raw),approachTime=event.time-30
        const pair:[Vector3,Vector3]=[world(sampleAt(run.samples[event.sourceIndex],approachTime).position),world(event.target.at(-30).position)]
        const next=composition(-30,cloud,camera.aspect,false,pair,outerScale),length=pose.position.length()*(1-blend)+next.position.length()*blend
        pose.position.normalize().lerp(next.position.clone().normalize(),blend).normalize().multiplyScalar(length);pose.target.lerp(next.target,blend);pose.up.lerp(next.up,blend).normalize()
      }
      origin.copy(pose.target);camera.position.copy(pose.position).sub(origin);controls.target.set(0,0,0);camera.up.copy(pose.up);reveal=pose.reveal;controls.update()
    }
    inertial.position.copy(origin).negate();earth.rotation.y=time*7.292115e-5
    const pixelWorld=2*camera.position.distanceTo(controls.target)*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight
    shards.visible=!before;shards.count=run.samples.length;activeCount=0
    if(!before){
      run.samples.forEach((sample,i)=>{
        const active=alive(sample,time);if(active)activeCount++
        dummy.position.copy(currentPositions[i]).sub(origin);let size=active?pixelWorld*(i%47===0?6:1.3+(i*17%31)/18):0
        if(event&&i===event.sourceIndex&&secondFocus&&age<0)size*=3
        const turn=Math.log1p(Math.max(0,time-sample.born))*.7
        dummy.rotation.set(i*.83+turn,i*1.13-turn*.7,i*.47+turn*.4);dummy.scale.set(size*(.5+(i%5)*.25),size*.45,size*(.6+(i%7)*.13));dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix)
      });shards.instanceMatrix.needsUpdate=true
    }
    bodies.forEach((body,family)=>{body.visible=before;if(!before)return;body.position.copy(currentPositions[family]).sub(origin);body.scale.setScalar(pixelWorld*(10+12*(1-Math.min(1,Math.abs(time)/15))));body.rotation.set(.3+family*.8,.4-family*.9,family===0?.45:-.5)})
    target.visible=Boolean(event&&time>=0&&time<event.time)
    if(target.visible){target.position.copy(world(event!.target.at(time-event!.time).position)).sub(origin);target.scale.setScalar(pixelWorld*(secondFocus?18:6));target.rotation.set(.4,-.4,.7)}
    trails.visible=age>0&&age<2400&&autoCamera;trailMaterial.opacity=.18*(1-reveal)
    if(trails.visible){let cursor=0;const attr=trailGeometry.getAttribute('position'),history=Math.min(10,age*.32)
      for(let n=0;n<24;n++){const sample=focusIndices[Math.floor(n*focusIndices.length/24)]?.s
        for(let segment=0;segment<4;segment++)for(const side of [0,1]){const past=Math.max(0,age-history*(4-segment-side)/4),p=sample?world(cloudHistory(sample,run.centres[sample.family],age,past)).sub(origin):new Vector3();attr.setXYZ(cursor++,p.x,p.y,p.z)}}attr.needsUpdate=true
    }
    if(!element('model-panel').hidden)spreadView.render(run,time)
    stage();canvas.dataset.time=String(time);canvas.dataset.count=String(before?2:activeCount);canvas.dataset.spread=String(run.spread);canvas.dataset.camera=autoCamera?(followCloud?'cloud':'guided'):'free';canvas.dataset.playing=String(playing);canvas.dataset.reveal=String(reveal);canvas.dataset.cloudSpanKm=String(extent*2*RADIUS);canvas.dataset.secondary=String(secondaryOn());canvas.dataset.secondaryBorn=String(Boolean(event&&time>=event.time));canvas.dataset.j2=String(run.j2)
    play.textContent=playing?'Pause':'Play';updating=false;draw()
  }
  function seek(next:number){pause();time=Math.max(START,Math.min(END,next));cue=guidedCue(time,secondaryOn());update()}
  function toggle(){if(failed)return;if(playing)pause();else{if(time>=END){time=START;cue=0}playing=true;last=performance.now()}update()}
  play.onclick=toggle;timeInput.oninput=()=>{pause();cue=Number(timeInput.value);time=guidedTime(cue,secondaryOn());update()}
  const jumps:Record<string,number>={approach:START,cloud:60,orbit:10*PERIOD,end:END}
  document.querySelectorAll<HTMLButtonElement>('.waypoints button[data-time]').forEach(button=>button.onclick=()=>seek(jumps[button.dataset.time!]))
  spread.oninput=()=>{pause();run=experiment(Number(spread.value),run.j2,secondaryOn());element('spread-value').textContent=`≤ ${run.spread} m/s`;periods();cue=guidedCue(time,secondaryOn());update()}
  pace.onchange=()=>{cue=guidedCue(time,secondaryOn());last=performance.now()}
  element('replay').onclick=()=>{time=START;cue=0;pace.value='guided';autoCamera=true;followCloud=false;playing=!reduced.matches&&!document.hidden&&!failed;last=performance.now();update()}
  element('frame').onclick=()=>{autoCamera=false;origin.set(0,0,0);controls.target.set(0,0,0);camera.up.set(0,1,0);camera.position.copy(fullPosition).multiplyScalar(Math.max(1,1/camera.aspect)*outerScale);reveal=1;controls.update();update()}
  element('cloud').onclick=()=>{autoCamera=true;followCloud=true;update()}
  element('secondary').onclick=()=>{pause();run=experiment(Number(spread.value),run.j2,!secondaryOn());pace.value='guided';autoCamera=true;followCloud=false;periods();seek(run.secondary?SECONDARY_TIME-30:time)}
  element<HTMLInputElement>('j2').onchange=e=>{pause();run=experiment(Number(spread.value),(e.target as HTMLInputElement).checked,secondaryOn());periods();cue=guidedCue(time,secondaryOn());update()}
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
  fit();camera.position.copy(fullPosition);camera.lookAt(0,0,0)
  // Warm every material and its buffers while the canvas is hidden. Shards and
  // histories first become visible at impact; their first draw must not stall it.
  renderer.compile(scene,camera);renderer.render(scene,camera)
  last=performance.now();update();canvas.style.visibility='';status.hidden=true;document.documentElement.dataset.simulation='ready'
  function tick(now:number){const dt=Math.max(0,(now-last)/1000);last=now
    if(playing){if(pace.value==='guided'){cue=Math.min(guidedDuration(secondaryOn()),cue+dt);time=guidedTime(cue,secondaryOn())}else{time=Math.min(END,time+dt*(pace.value.startsWith('orbit-')?Number(pace.value.slice(6))*PERIOD:Number(pace.value)));cue=guidedCue(time,secondaryOn())}if(time>=END)pause();update()}
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
try{mount()}catch(error){document.documentElement.dataset.simulation='error';status.hidden=false;status.textContent=error instanceof Error?`The experiment could not open: ${error.message}`:'The experiment could not open.'}
