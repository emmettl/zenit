import { useEffect, useRef } from 'react'
import { BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, HemisphereLight,
  LineBasicMaterial, LineSegments, Mesh, MeshPhongMaterial, PerspectiveCamera,
  Scene, SphereGeometry, WebGLRenderer } from 'three'
import { cameraPose, observerNormal } from './camera'

export function SceneView({ progress, onFailure }: { progress: number; onFailure: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const pose = useRef(progress)
  const redraw = useRef<(() => void) | null>(null)
  useEffect(() => { pose.current = progress; redraw.current?.() }, [progress])
  useEffect(() => {
    const element = host.current
    if (!element) return
    let renderer: WebGLRenderer
    try { renderer = new WebGLRenderer({ antialias: true, alpha: false }) }
    catch { onFailure(); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const scene = new Scene()
    scene.background = new Color('#05090e')
    const camera = new PerspectiveCamera(43, 1, 0.000005, 12)
    const geometry = new SphereGeometry(1, 96, 64)
    const material = new MeshPhongMaterial({ color: '#102633', shininess: 8, specular: '#42677b' })
    scene.add(new Mesh(geometry, material))
    scene.add(new HemisphereLight('#94b8ca', '#08131b', 1.4))
    const light = new DirectionalLight('#b6dae9', 2.4)
    light.position.set(3, 1.5, 2); scene.add(light)
    // Geographic graticule: authored reference geometry, not dataset points.
    const vertices: number[] = []
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 2) {
        vertices.push(...observerNormal(lat, lon).multiplyScalar(1.00001).toArray(),
          ...observerNormal(lat, lon + 2).multiplyScalar(1.00001).toArray())
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -90; lat < 90; lat += 2) {
        vertices.push(...observerNormal(lat, lon).multiplyScalar(1.00001).toArray(),
          ...observerNormal(lat + 2, lon).multiplyScalar(1.00001).toArray())
      }
    }
    const gridGeometry = new BufferGeometry()
    gridGeometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    const gridMaterial = new LineBasicMaterial({ color: '#375c70', transparent: true, opacity: 0.42 })
    scene.add(new LineSegments(gridGeometry, gridMaterial))
    element.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    const draw = () => {
      const p = cameraPose(pose.current)
      camera.position.copy(p.position); camera.quaternion.copy(p.rotation)
      camera.near = Math.min(0.05, Math.max(0.000002, (p.position.length() - 1) * 0.1))
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); draw()
    }
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    renderer.domElement.addEventListener('webglcontextlost', lost)
    const observer = new ResizeObserver(resize); observer.observe(element)
    redraw.current = draw; resize()
    return () => {
      observer.disconnect(); redraw.current = null
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      geometry.dispose(); material.dispose(); gridGeometry.dispose(); gridMaterial.dispose()
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [onFailure])
  return <div ref={host} className="scene" role="img" aria-label="A spherical Earth and coordinate grid for the camera rehearsal. Orbital and stellar datasets are pending." />
}
