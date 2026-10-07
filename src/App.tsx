import { useCallback, useEffect, useRef, useState } from 'react'
import { SceneView } from './Scene'
import { OBSERVER } from './camera'

const brief = 'https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md'
export function App() {
  const [progress, setProgress] = useState(0)
  const [target, setTarget] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const current = useRef(progress)
  current.current = progress
  const fail = useCallback(() => setFailed(true), [])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { setReduced(query.matches); setTarget(null) }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (target === null) return
    if (reduced) { setProgress(target); setTarget(null); return }
    const from = current.current, duration = 12000 * Math.abs(target - from)
    let frame = 0, start: number | undefined
    const tick = (now: number) => {
      start ??= now
      const fraction = Math.min(1, (now - start) / Math.max(duration, 1))
      setProgress(from + (target - from) * fraction)
      if (fraction < 1) frame = requestAnimationFrame(tick)
      else setTarget(null)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reduced])
  const view = progress === 0 ? 'Earth orbit' : progress === 1 ? 'Looking up' : 'Descending / ascending'
  return <main>
    <SceneView progress={progress} onFailure={fail} />
    <header>
      <a className="series" href="https://motionstudies.app/">MOTION STUDIES</a>
      <h1>ZENIT</h1>
      <p className="subtitle">Earth orbit / the sky above us</p>
    </header>
    <aside className="edition-state"><span className="status-light" /> RESEARCH SCAFFOLD</aside>
    <section className="composition" aria-labelledby="composition-title">
      <p className="eyebrow" id="composition-title">{view}</p>
      <h2>{progress === 1 ? 'The sky above a place.' : 'A world surrounded by motion.'}</h2>
      <p>{progress === 1 ? `Surface viewpoint · ${OBSERVER.name}. The stellar field and satellite passes will follow.` : 'From the orbital whole to a horizon, then upward into the stars.'}</p>
    </section>
    <section className="controls" aria-label="Camera rehearsal">
      <div className="control-heading"><span>CAMERA REHEARSAL</span><span>{Math.round(progress * 100)}%</span></div>
      <label className="sr-only" htmlFor="descent">Descent to surface</label>
      <input id="descent" type="range" min="0" max="1" step="0.001" value={progress}
        onChange={event => { setTarget(null); setProgress(Number(event.target.value)) }} />
      <div className="buttons">
        <button onClick={() => setTarget(1)} disabled={progress === 1 || target === 1}>Descend to surface</button>
        <button onClick={() => setTarget(null)} disabled={target === null}>Pause camera</button>
        <button onClick={() => setTarget(0)} disabled={progress === 0 || target === 0}>Return to orbit</button>
      </div>
      <p className="camera-state" role="status">{target === null ? 'Camera paused' : 'Camera moving'}{reduced ? ' · reduced motion' : ''}</p>
    </section>
    <footer>
      <p>{failed ? 'WebGL unavailable. Camera controls and the study brief remain accessible.' : 'Spherical camera scaffold · orbital and stellar datasets pending'}</p>
      <nav aria-label="Study references"><a href={brief}>Study brief ↗</a><a href="https://github.com/emmettl/zenit">Source ↗</a><a href="./data/zenit-manifest.json">Evidence status ↗</a></nav>
    </footer>
  </main>
}
