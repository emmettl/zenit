import {Scene,PerspectiveCamera,WebGLRenderer,Mesh,MeshPhongMaterial,HemisphereLight,DirectionalLight,BufferGeometry,Float32BufferAttribute,Points,ShaderMaterial,Vector3,Line,LineBasicMaterial,ArrowHelper} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {earthGeometry,earthTexture} from './geography'
import {POLAR_RATIO} from './camera'
import {PARENTS,PERIOD,RADIUS,START,END,RELATIVE_SPEED,GUIDED_DURATION,experiment,guidedTime,guidedCue,type Vec3} from './collision-model'

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const status=element('simulation-state')
function mount(){
  const host=element('simulation-scene'),scene=new Scene(),camera=new PerspectiveCamera(43,1,.01,50)
  const renderer=new WebGLRenderer({antialias:true});renderer.setClearColor('#05090e');renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement)
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Synthetic collision view. Drag or use arrow keys to orbit; plus and minus zoom; space pauses.')
  const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=.1;controls.maxDistance=12
  const earth=new Mesh(earthGeometry(),new MeshPhongMaterial({map:earthTexture(),shininess:8,specular:'#42677b'}));scene.add(earth,new HemisphereLight('#94b8ca','#08131b',.9));const sun=new DirectionalLight('#b6dae9',2.8);sun.position.set(4,3,4);scene.add(sun)
  const world=(r:Vec3)=>new Vector3(r[0]/RADIUS,r[2]/RADIUS,-r[1]/RADIUS)
  const colours=[[.475,.796,.886],[.894,.694,.490]],paths=PARENTS.map((orbit,family)=>{
    const geometry=new BufferGeometry().setFromPoints(Array.from({length:257},(_,i)=>world(orbit.at(i*PERIOD/256).position)))
    const line=new Line(geometry,new LineBasicMaterial({color:family===0?'#79cbe2':'#e4b17d',transparent:true,opacity:.2}));scene.add(line);return line
  })
  const geometry=new BufferGeometry(),positions=new Float32Array(192*3),tints=new Float32Array(192*3)
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('tint',new Float32BufferAttribute(tints,3))
  const material=new ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{ratio:{value:renderer.getPixelRatio()},parent:{value:1}},vertexShader:`attribute vec3 tint;uniform float ratio;uniform float parent;varying vec3 colour;void main(){colour=tint;gl_PointSize=mix(3.8,9.,parent)*ratio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float parent;varying vec3 colour;void main(){vec2 p=abs(gl_PointCoord-.5);if(parent>.5?(p.x+p.y>.48):(length(p)>.47))discard;gl_FragColor=vec4(colour,.95);}`})
  const dots=new Points(geometry,material);dots.frustumCulled=false;scene.add(dots)
  const arrows=PARENTS.map((parent,family)=>{const arrow=new ArrowHelper(world(parent.initial.velocity).normalize(),world(parent.initial.position),.06,family===0?'#79cbe2':'#e4b17d',.012,.006);scene.add(arrow);return arrow})
  const timeInput=element<HTMLInputElement>('time'),spread=element<HTMLInputElement>('spread'),pace=element<HTMLSelectElement>('pace'),play=element<HTMLButtonElement>('play'),reduced=matchMedia('(prefers-reduced-motion: reduce)')
  let run=experiment(Number(spread.value)),time=START,cue=0,playing=!reduced.matches&&!document.hidden,autoCamera=true,last=performance.now(),failed=false
  timeInput.max=String(END)
  element('relative-speed').textContent=`${RELATIVE_SPEED.toFixed(2)} km/s`
  element('original-period').textContent=`${(PERIOD/60).toFixed(1)} minutes`
  function periods(){for(const family of [0,1])element(family===0?'period-a':'period-b').textContent=`${family===0?'A':'B'} · ${(run.periods[family][0]/60).toFixed(2)}–${(run.periods[family][1]/60).toFixed(2)} minutes`}
  periods()
  const fullPosition=new Vector3(3,1.6,2.5),closePosition=new Vector3(1.43,.18,.27),contact=world(PARENTS[0].initial.position)
  function fit(){
    const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height
    if(innerWidth>800){camera.setViewOffset(width,height,-width*.18,0,width,height)}
    else if(innerWidth>650&&innerHeight<=500){camera.setViewOffset(width,height,-width*.23,0,width,height)}
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  function frame(){
    // Blend pose and target continuously from the encounter to the whole Earth.
    const s=Math.max(0,Math.min(1,time/900)),blend=s*s*(3-2*s),aspect=Math.max(1,1/camera.aspect)
    camera.position.copy(closePosition).lerp(fullPosition.clone().multiplyScalar(aspect),blend)
    controls.target.copy(contact).multiplyScalar(1-blend);controls.update()
  }
  function clearance(){
    const radius=new Vector3(camera.position.x,camera.position.y/POLAR_RATIO,camera.position.z).length()
    if(radius<1.03)camera.position.multiplyScalar(1.03/Math.max(radius,1e-12))
    const near=Math.min(.05,Math.max(.000001,(Math.max(radius,1.03)-1)*.15))
    if(camera.near!==near){camera.near=near;camera.updateProjectionMatrix()}
  }
  function labels(){
    for(const family of [0,1]){const label=element(family===0?'label-a':'label-b');label.hidden=time>=0;if(time>=0)continue
      const p=world(PARENTS[family].at(time).position),toward=camera.position.clone().sub(p)
      // Parents lie close to the surface; hide labels when their body is Earth-occluded.
      if(p.dot(toward)<0){label.hidden=true;continue}
      const projected=p.project(camera),rect=canvas.getBoundingClientRect();label.hidden=projected.z>1||projected.z< -1||Math.abs(projected.x)>1||Math.abs(projected.y)>1
      label.style.left=`${rect.left+(projected.x+1)*rect.width/2+8}px`;label.style.top=`${rect.top+(1-projected.y)*rect.height/2+(family===0?6:-28)}px`
    }
  }
  function draw(){clearance();labels();renderer.render(scene,camera)}
  function pause(){playing=false;play.textContent='Play'}
  function stage(){
    const step=time<0?0:time===0?1:time<600?2:time<PERIOD?3:4
    const titles=['Two paths. One point.','Contact. A shared beginning.','A compact cloud.','Different speeds. Different periods.','A cloud stretched along its orbit.']
    const notes=['Two synthetic bodies approach on paths crossing at 90°, 800 km above Earth.','Both bodies release their representative fragments at exactly the same point.','Small release velocities send the samples onto slightly different orbital paths.','Some fragments take less time to circle Earth. Others take longer, falling behind.','After several revolutions, tiny period differences have opened the cloud into long arcs.']
    element('stage-number').textContent=`0${step+1} / ${['APPROACH','CONTACT','RELEASE','SEPARATION','EVOLUTION'][step]}`
    element('stage-title').textContent=titles[step];element('stage-note').textContent=notes[step]
    const seconds=Math.round(Math.abs(time)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60)
    element('elapsed').textContent=time<0?`${Math.ceil(-time)} seconds before contact`:time===0?'Contact · t = 0':`+${hours?`${hours}h `:''}${minutes}m ${String(seconds%60).padStart(2,'0')}s`
    element('orbit-count').textContent=time<=0?'800 KM / 90° ENCOUNTER':`${(time/PERIOD).toFixed(2)} ORIGINAL ORBITS`
    timeInput.value=String(time);timeInput.setAttribute('aria-valuetext',element('elapsed').textContent!)
    element('population').textContent=time<0?'Two synthetic bodies':'192 representative fragments'
    const milestones=[START,0,600,PERIOD,END]
    document.querySelectorAll<HTMLButtonElement>('.waypoints button').forEach((button,i)=>button.setAttribute('aria-pressed',String(Math.abs(time-milestones[i])<.01)))
  }
  function update(){
    const before=time<0,states=before?PARENTS.map((orbit,family)=>({family,position:orbit.at(time).position})):run.samples.map(s=>({family:s.family,position:s.orbit.at(time).position}))
    const position=geometry.getAttribute('position'),tint=geometry.getAttribute('tint')
    states.forEach((state,i)=>{const p=world(state.position);position.setXYZ(i,p.x,p.y,p.z);tint.setXYZ(i,...colours[state.family] as [number,number,number])})
    position.needsUpdate=true;tint.needsUpdate=true;geometry.setDrawRange(0,states.length);material.uniforms.parent.value=before?1:0
    arrows.forEach((arrow,family)=>{arrow.visible=before;const state=PARENTS[family].at(time);arrow.position.copy(world(state.position));arrow.setDirection(world(state.velocity).normalize())})
    earth.rotation.y=time*7.292115e-5
    if(autoCamera)frame()
    stage();canvas.dataset.time=String(time);canvas.dataset.count=String(states.length);canvas.dataset.spread=String(run.spread);canvas.dataset.camera=autoCamera?'guided':'free';canvas.dataset.playing=String(playing)
    play.textContent=playing?'Pause':'Play';draw()
  }
  function seek(next:number){pause();time=Math.max(START,Math.min(END,next));cue=guidedCue(time);update()}
  function toggle(){if(failed)return;if(playing)pause();else{if(time>=END){time=START;cue=0}playing=true;last=performance.now()}update()}
  play.onclick=toggle
  timeInput.oninput=()=>seek(Number(timeInput.value))
  const jumps:Record<string,number>={approach:START,release:0,minutes:600,orbit:PERIOD,end:END}
  document.querySelectorAll<HTMLButtonElement>('.waypoints button').forEach(button=>button.onclick=()=>seek(jumps[button.dataset.time!]))
  spread.oninput=()=>{pause();run=experiment(Number(spread.value));element('spread-value').textContent=`${run.spread} m/s`;periods();update()}
  pace.onchange=()=>{cue=guidedCue(time);last=performance.now()}
  element('replay').onclick=()=>{time=START;cue=0;pace.value='guided';autoCamera=true;playing=!reduced.matches&&!document.hidden&&!failed;last=performance.now();update()}
  element('frame').onclick=()=>{autoCamera=false;controls.target.set(0,0,0);camera.position.copy(fullPosition).multiplyScalar(Math.max(1,1/camera.aspect));controls.update();update()}
  element<HTMLInputElement>('paths').onchange=e=>{paths.forEach(line=>line.visible=(e.target as HTMLInputElement).checked);draw()}
  const panel=element('model-panel'),model=element('model')
  function closeModel(){panel.hidden=true;model.setAttribute('aria-expanded','false');model.focus({preventScroll:true})}
  model.onclick=()=>{panel.hidden=!panel.hidden;model.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){pause();update();element('close-model').focus({preventScroll:true})}}
  element('close-model').onclick=closeModel
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closeModel()})
  controls.addEventListener('start',()=>{autoCamera=false;update()});controls.addEventListener('change',draw)
  canvas.onkeydown=e=>{
    if(e.code==='Space'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();if(!e.repeat)toggle();return}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return
    e.preventDefault();autoCamera=false;const offset=camera.position.clone().sub(controls.target)
    if(e.key==='+'||e.key==='-')offset.multiplyScalar(e.key==='+'?.9:1.1)
    else offset.applyAxisAngle(e.key==='ArrowUp'||e.key==='ArrowDown'?new Vector3(1,0,0):new Vector3(0,1,0),(e.key==='ArrowLeft'||e.key==='ArrowUp'?1:-1)*.06)
    camera.position.copy(controls.target).add(offset);controls.update();update()
  }
  reduced.addEventListener('change',()=>{if(reduced.matches){pause();update()}})
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();update()}})
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;pause();status.hidden=false;status.textContent='The graphics context was interrupted. Reload to reopen the experiment.'})
  new ResizeObserver(()=>{fit();if(autoCamera)frame();draw()}).observe(host)
  fit();update();status.hidden=true;document.documentElement.dataset.simulation='ready'
  function tick(now:number){const dt=Math.max(0,(now-last)/1000);last=now
    if(playing){if(pace.value==='guided'){cue=Math.min(GUIDED_DURATION,cue+dt);time=guidedTime(cue)}else{time=Math.min(END,time+dt*Number(pace.value));cue=guidedCue(time)}if(time>=END)pause();update()}
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
try{mount()}catch(error){document.documentElement.dataset.simulation='error';status.hidden=false;status.textContent=error instanceof Error?`The experiment could not open: ${error.message}`:'The experiment could not open.'}
