import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SceneView } from './Scene'
import { OBSERVER } from './camera'
import { type Catalogue, horizonReading, loadCatalogue, skyDirections } from './stellar'

const brief='https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md'
export function App() {
  const [progress,setProgress]=useState(0), [target,setTarget]=useState<number|null>(null)
  const [failed,setFailed]=useState(false), [catalogue,setCatalogue]=useState<Catalogue|null>(null)
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading'), [attempt,setAttempt]=useState(0)
  const [showStars,setShowStars]=useState(true), [selectedId,setSelectedId]=useState<string|null>(null)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const current=useRef(progress);current.current=progress
  const fail=useCallback(()=>setFailed(true),[])
  const select=useCallback((id:string)=>setSelectedId(id),[])
  useEffect(()=>{
    const controller=new AbortController();setLoadState('loading')
    loadCatalogue(controller.signal).then(value=>{setCatalogue(value);setLoadState('ready')}).catch(()=>{if(!controller.signal.aborted)setLoadState('error')})
    return()=>controller.abort()
  },[attempt])
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>{setReduced(query.matches);setTarget(null)}
    query.addEventListener('change',change);return()=>query.removeEventListener('change',change)
  },[])
  useEffect(()=>{
    if(target===null)return
    if(reduced){setProgress(target);setTarget(null);return}
    const from=current.current,duration=12000*Math.abs(target-from)
    let frame=0,start:number|undefined
    const tick=(now:number)=>{
      start??=now;const fraction=Math.min(1,(now-start)/Math.max(duration,1))
      setProgress(from+(target-from)*fraction)
      if(fraction<1)frame=requestAnimationFrame(tick);else setTarget(null)
    }
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[target,reduced])
  const directions=useMemo(()=>skyDirections(catalogue?.stars??[]),[catalogue])
  const named=useMemo(()=>(catalogue?.stars??[]).filter(x=>x.name).sort((a,b)=>a.name!.localeCompare(b.name!)||a.hyg-b.hyg),[catalogue])
  const selectedIndex=catalogue?.stars.findIndex(x=>x.id===selectedId)??-1
  const selected=selectedIndex>=0 ? catalogue!.stars[selectedIndex]:null
  const horizon=selected ? horizonReading(directions[selectedIndex]):null
  const view=progress===0?'Earth orbit':progress===1?'Looking up':'Descending / ascending'
  return <main>
    <SceneView progress={progress} catalogue={catalogue} showStars={showStars} selectedId={selectedId} onSelect={select} onFailure={fail} />
    <header><a className="series" href="https://motionstudies.app/">MOTION STUDIES</a><h1>ZENIT</h1><p className="subtitle">Earth orbit / the sky above us</p></header>
    <aside className="edition-state"><span className="status-light" /> STELLAR REFERENCE</aside>
    <section className="composition" aria-labelledby="composition-title">
      <p className="eyebrow" id="composition-title">{view}</p>
      <h2>{progress===1?'The sky above a place.':'A world surrounded by motion.'}</h2>
      <p>{progress===1?`Surface viewpoint · ${OBSERVER.name}. A catalogue sky; satellite passes will follow.`:'From the orbital whole to a horizon, then upward into the stars.'}</p>
    </section>
    <section className="stellar-panel" aria-labelledby="stellar-title">
      <h2 id="stellar-title">The naked-eye field</h2>
      <p className="catalogue-state" aria-live="polite">{loadState==='ready'?`${catalogue!.stars.length.toLocaleString('en')} catalogue records · V ≤ 6.0`:loadState==='loading'?'Loading the stellar catalogue…':'Stellar catalogue unavailable'}</p>
      {loadState==='error'&&<button onClick={()=>setAttempt(x=>x+1)}>Retry stellar catalogue</button>}
      <label className="star-toggle"><input type="checkbox" checked={showStars} onChange={event=>setShowStars(event.target.checked)} /> Show stars</label>
      <label htmlFor="star-choice">Named star</label>
      <select id="star-choice" value={named.some(x=>x.id===selectedId)?selectedId??'':''} onChange={event=>setSelectedId(event.target.value||null)} disabled={!catalogue}>
        <option value="">Choose a star</option>{named.map(x=><option key={x.id} value={x.id}>{x.name} · V {x.mag.toFixed(2)}</option>)}
      </select>
      {selected&&<article className="star-card" aria-label="Selected star">
        <h3>{selected.name??selected.designation??`HYG ${selected.hyg}`}</h3>
        <p className="star-id">HYG {selected.hyg}{selected.hip?` · HIP ${selected.hip}`:''}</p>
        <dl><dt>Visual magnitude</dt><dd>{selected.mag.toFixed(2)}</dd>
          <dt>B−V colour index</dt><dd>{selected.bv===null?'Unavailable':selected.bv.toFixed(3)}</dd>
          <dt>Distance</dt><dd>{selected.distance===null?'Unavailable':`${selected.distance.toFixed(2)} pc`}</dd>
          <dt>Catalogue RA</dt><dd>{(selected.ra*12/Math.PI).toFixed(5)} h</dd>
          <dt>Catalogue declination</dt><dd>{(selected.dec*180/Math.PI).toFixed(5)}°</dd>
          <dt>Zurich altitude</dt><dd>{horizon!.altitude.toFixed(1)}° · {horizon!.altitude>0?'Above':'Below'} horizon</dd>
          <dt>Variability</dt><dd>{selected.variable??'No designation supplied'}</dd>
        </dl>
        <button onClick={()=>setSelectedId(null)}>Clear selection</button>
      </article>}
      <p className="sky-note">Sky orientation: 7 Oct 2026, 21:00 UTC.<br/>Catalogue positions: J2000. Idealised dark sky.</p>
      <a className="credit" href="./data/stellar/NOTICE.txt">HYG 4.4 · David Nash / Astronomy Nexus · CC BY-SA 4.0 ↗</a>
    </section>
    <section className="controls" aria-label="Camera rehearsal">
      <div className="control-heading"><span>CAMERA REHEARSAL</span><span>{Math.round(progress*100)}%</span></div>
      <label className="sr-only" htmlFor="descent">Descent to surface</label>
      <input id="descent" type="range" min="0" max="1" step="0.001" value={progress} onChange={event=>{setTarget(null);setProgress(Number(event.target.value))}} />
      <div className="buttons"><button onClick={()=>setTarget(1)} disabled={progress===1||target===1}>Descend to surface</button><button onClick={()=>setTarget(null)} disabled={target===null}>Pause camera</button><button onClick={()=>setTarget(0)} disabled={progress===0||target===0}>Return to orbit</button></div>
      <p className="camera-state" role="status">{target===null?'Camera paused':'Camera moving'}{reduced?' · reduced motion':''}</p>
    </section>
    <footer><p>{failed?'WebGL unavailable. Catalogue selection and the brief remain accessible.':'HYG stellar reference · orbital dataset pending'}</p>
      <nav aria-label="Study references"><a href={brief}>Study brief ↗</a><a href="https://github.com/emmettl/zenit">Source ↗</a><a href="./data/zenit-manifest.json">Evidence status ↗</a></nav></footer>
  </main>
}
