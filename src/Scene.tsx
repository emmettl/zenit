import { useEffect, useRef } from 'react'
import { BufferGeometry, DirectionalLight, Float32BufferAttribute, HemisphereLight,
  LineBasicMaterial, LineSegments, Mesh, MeshPhongMaterial, PerspectiveCamera, Points,
  Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLRenderer } from 'three'
import { cameraPose, OBSERVER, observerNormal } from './camera'
import { blockedByEarth, type Catalogue, skyDirections, starColour } from './stellar'

interface Props { progress: number; catalogue: Catalogue | null; showStars: boolean; selectedId: string | null; onSelect: (id: string) => void; onFailure: () => void }
export function SceneView({ progress, catalogue, showStars, selectedId, onSelect, onFailure }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const values = useRef({ progress, showStars, selectedId })
  const redraw = useRef<(() => void) | null>(null)
  useEffect(() => { values.current = { progress, showStars, selectedId }; redraw.current?.() }, [progress, showStars, selectedId])
  useEffect(() => {
    const element = host.current
    if (!element) return
    let renderer: WebGLRenderer
    try { renderer = new WebGLRenderer({ antialias: true, alpha: false }) }
    catch { onFailure(); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor('#05090e'); renderer.autoClear = false
    const scene = new Scene(), sky = new Scene()
    const camera = new PerspectiveCamera(43, 1, 0.000005, 12)
    const skyCamera = new PerspectiveCamera(43, 1, 0.1, 2)
    const geometry = new SphereGeometry(1, 96, 64)
    const material = new MeshPhongMaterial({ color: '#102633', shininess: 8, specular: '#42677b' })
    scene.add(new Mesh(geometry, material))
    scene.add(new HemisphereLight('#94b8ca', '#08131b', 1.4))
    const light = new DirectionalLight('#b6dae9', 2.4)
    light.position.set(3, 1.5, 2); scene.add(light)
    const vertices: number[] = []
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 2) {
      vertices.push(...observerNormal(lat, lon).multiplyScalar(1.00001).toArray(), ...observerNormal(lat, lon + 2).multiplyScalar(1.00001).toArray())
    }
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -90; lat < 90; lat += 2) {
      vertices.push(...observerNormal(lat, lon).multiplyScalar(1.00001).toArray(), ...observerNormal(lat + 2, lon).multiplyScalar(1.00001).toArray())
    }
    const gridGeometry = new BufferGeometry()
    gridGeometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    const gridMaterial = new LineBasicMaterial({ color: '#375c70', transparent: true, opacity: 0.42 })
    scene.add(new LineSegments(gridGeometry, gridMaterial))
    const directions = skyDirections(catalogue?.stars ?? [])
    const starGeometry = new BufferGeometry()
    starGeometry.setAttribute('position', new Float32BufferAttribute(directions.flatMap(x=>x.toArray()), 3))
    starGeometry.setAttribute('tint', new Float32BufferAttribute((catalogue?.stars ?? []).flatMap(x=>starColour(x.bv)), 3))
    starGeometry.setAttribute('magnitude', new Float32BufferAttribute((catalogue?.stars ?? []).map(x=>x.mag), 1))
    starGeometry.setAttribute('starIndex', new Float32BufferAttribute(directions.map((_,i)=>i), 1))
    const starMaterial = new ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { pixelRatio: { value: renderer.getPixelRatio() }, selected: { value: -1 }, ground: { value: 0 }, up: { value: observerNormal(OBSERVER.latitude,OBSERVER.longitude) } },
      vertexShader: `attribute vec3 tint; attribute float magnitude; attribute float starIndex;
        uniform float pixelRatio; uniform float selected; uniform float ground; uniform vec3 up;
        varying vec3 colour; varying float opacity;
        void main() {
          float chosen = 1.0-step(0.1,abs(starIndex-selected));
          colour = mix(tint,vec3(1.0,0.77,0.42),chosen);
          opacity = clamp(0.4+(6.0-magnitude)*0.1,0.4,1.0);
          gl_PointSize = (clamp(1.15+(6.0-magnitude)*0.42,1.15,4.5)+chosen*5.0)*pixelRatio;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
          if (ground>0.5 && dot(position,up)<=0.0) gl_Position=vec4(2.0,2.0,2.0,1.0);
        }`,
      fragmentShader: `varying vec3 colour; varying float opacity;
        void main() { vec2 p=gl_PointCoord-0.5; float r=length(p);
          if (r>0.5) discard; float light=exp(-10.0*dot(p,p))*(1.0-smoothstep(0.3,0.5,r));
          gl_FragColor=vec4(colour,opacity*light); }
      `,
    })
    const points = new Points(starGeometry,starMaterial); points.frustumCulled=false; sky.add(points)
    element.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.dataset.starCount = String(directions.length)
    const draw = () => {
      const p = cameraPose(values.current.progress)
      camera.position.copy(p.position); camera.quaternion.copy(p.rotation)
      camera.near = Math.min(0.05, Math.max(0.000002, (p.position.length() - 1) * 0.1)); camera.updateProjectionMatrix()
      // Sky camera rotates with the world camera but never inherits its translation.
      skyCamera.quaternion.copy(p.rotation); skyCamera.updateMatrixWorld()
      points.visible=values.current.showStars
      starMaterial.uniforms.ground.value=values.current.progress>=0.98 ? 1 : 0
      starMaterial.uniforms.selected.value=catalogue?.stars.findIndex(x=>x.id===values.current.selectedId) ?? -1
      renderer.clear(); renderer.render(sky,skyCamera); renderer.clearDepth(); renderer.render(scene,camera)
    }
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      renderer.setSize(width,height,false)
      camera.aspect=skyCamera.aspect=width/Math.max(1,height);skyCamera.updateProjectionMatrix();draw()
    }
    const pick = (event: PointerEvent) => {
      if (!catalogue || !values.current.showStars) return
      const bounds=element.getBoundingClientRect(), px=event.clientX-bounds.left, py=event.clientY-bounds.top
      const forward=new Vector3(0,0,-1).applyQuaternion(skyCamera.quaternion)
      const up=observerNormal(OBSERVER.latitude,OBSERVER.longitude)
      let best=-1, distance=100
      for(let i=0;i<directions.length;i++) {
        const direction=directions[i]
        if (direction.dot(forward)<=0 || blockedByEarth(camera.position,direction) || (values.current.progress>=0.98 && direction.dot(up)<=0)) continue
        const ndc=direction.clone().project(skyCamera)
        const dx=(ndc.x+1)*bounds.width/2-px, dy=(1-ndc.y)*bounds.height/2-py
        const squared=dx*dx+dy*dy
        if(squared<distance) { best=i;distance=squared }
      }
      if(best>=0)onSelect(catalogue.stars[best].id)
    }
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    renderer.domElement.addEventListener('webglcontextlost',lost);renderer.domElement.addEventListener('pointerup',pick)
    const observer=new ResizeObserver(resize);observer.observe(element)
    redraw.current=draw;resize()
    return () => {
      observer.disconnect();redraw.current=null
      renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('pointerup',pick)
      geometry.dispose();material.dispose();gridGeometry.dispose();gridMaterial.dispose();starGeometry.dispose();starMaterial.dispose()
      renderer.dispose();renderer.domElement.remove()
    }
  }, [onFailure, onSelect, catalogue])
  return <div ref={host} className="scene" role="img" aria-label={`Spherical Earth and ${catalogue?.stars.length ?? 0} HYG catalogue stars. Fixed sky orientation; satellite data pending.`} />
}
