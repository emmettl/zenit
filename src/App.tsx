import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {TimelineScrubber} from '@motionstudies/web/components/TimelineScrubber'
import '@motionstudies/web/study-timeline.css'
import {SceneView} from './Scene'
import {OBSERVER} from './camera'
import {type Catalogue,horizonReading,loadCatalogue,skyDirections,SKY_TIME,solarAltitude} from './stellar'
import {type Orbit,advanceStudy,loadOrbit,orbitalPosition,utcLabel} from './orbital'
const brief='https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md'
export function App() {
  const [progress,setProgress]=useState(0),[target,setTarget]=useState<number|null>(null),[failed,setFailed]=useState(false)
  const [catalogue,setCatalogue]=useState<Catalogue|null>(null),[orbit,setOrbit]=useState<Orbit|null>(null)
  const [starState,setStarState]=useState('loading'),[orbitState,setOrbitState]=useState('loading'),[starAttempt,setStarAttempt]=useState(0),[orbitAttempt,setOrbitAttempt]=useState(0)
  const [showStars,setShowStars]=useState(true),[showTrail,setShowTrail]=useState(true),[selectedId,setSelectedId]=useState<string|null>('iss:25544')
  const [time,setTime]=useState(Date.parse(SKY_TIME)),[playing,setPlaying]=useState(false),[rate,setRate]=useState(10),[cue,setCue]=useState(false)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const current=useRef(progress);current.current=progress
  const fail=useCallback(()=>setFailed(true),[]),select=useCallback((id:string)=>setSelectedId(id),[])
  useEffect(()=>{const controller=new AbortController();setStarState('loading');loadCatalogue(controller.signal).then(value=>{setCatalogue(value);setStarState('ready')}).catch(()=>{if(!controller.signal.aborted)setStarState('error')});return()=>controller.abort()},[starAttempt])
  useEffect(()=>{const controller=new AbortController();setOrbitState('loading');loadOrbit(controller.signal).then(value=>{setOrbit(value);setTime(Date.parse(value.release.study.initialUtc));setOrbitState('ready')}).catch(()=>{if(!controller.signal.aborted)setOrbitState('error')});return()=>controller.abort()},[orbitAttempt])
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{setReduced(query.matches);setTarget(null);setPlaying(false);setCue(false)};query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[])
  useEffect(()=>{const change=()=>{if(document.hidden)setPlaying(false)};document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[])
  useEffect(()=>{
    if(!playing||!orbit)return
    let frame=0,last=performance.now()
    const tick=(now:number)=>{const elapsed=now-last;last=now;setTime(value=>advanceStudy(value,elapsed,rate,orbit.start,orbit.end));frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[playing,rate,orbit])
  useEffect(()=>{if(orbit&&playing&&((rate>0&&time>=orbit.end)||(rate<0&&time<=orbit.start)))setPlaying(false)},[time,playing,rate,orbit])
  useEffect(()=>{
    if(target===null)return
    const arrived=()=>{setTarget(null);if(cue&&target===1){setCue(false);if(!reduced)setPlaying(true)}}
    if(reduced){setProgress(target);arrived();return}
    const from=current.current,duration=12000*Math.abs(target-from);let frame=0,start:number|undefined
    const tick=(now:number)=>{start??=now;const fraction=Math.min(1,(now-start)/Math.max(duration,1));setProgress(from+(target-from)*fraction);if(fraction<1)frame=requestAnimationFrame(tick);else arrived()}
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[target,reduced,cue])
  const named=useMemo(()=>(catalogue?.stars??[]).filter(x=>x.name).sort((a,b)=>a.name!.localeCompare(b.name!)||a.hyg-b.hyg),[catalogue])
  const selected=catalogue?.stars.find(x=>x.id===selectedId)??null
  const horizon=selected?horizonReading(skyDirections([selected],new Date(time).toISOString())[0]):null
  const position=orbit?orbitalPosition(orbit,time):null
  const sunAltitude=solarAltitude(time)
  const view=progress===0?'Earth-fixed orbital view':progress===1?'Looking up':'Descending / ascending'
  const seek=(value:number)=>{setPlaying(false);setCue(false);setTime(value)}
  const watchPass=()=>{if(!orbit)return;window.scrollTo({top:0,behavior:'instant'});setPlaying(false);setTime(Date.parse(orbit.release.study.initialUtc));setRate(10);setSelectedId('iss:25544');if(progress===1){if(!reduced)setPlaying(true)}else{setCue(true);setTarget(1)}}
  const fmtTime=(value:number)=>new Date(value).toISOString().slice(11,19)+' UTC'
  return <main>
    <SceneView progress={progress} time={time} catalogue={catalogue} orbit={orbit} showStars={showStars} showTrail={showTrail} selectedId={selectedId} onSelect={select} onFailure={fail}/>
    <header><a className="series" href="https://motionstudies.app/">MOTION STUDIES</a><h1>ZENIT</h1><p className="subtitle">Earth orbit / the sky above us</p></header>
    <aside className="edition-state"><span className="status-light"/> THE ISS PASS</aside>
    <section className="composition" aria-labelledby="composition-title"><p className="eyebrow" id="composition-title">{view}</p><h2>{progress===1?'The sky above a place.':'A world surrounded by motion.'}</h2><p>{progress===1?`${OBSERVER.name} · a moving light above a turning sky.`:'One object. One clock. From Earth orbit to a place beneath its path.'}</p></section>
    <section className="stellar-panel" aria-label="Object catalogue">
      <div className="iss-heading"><h2>International Space Station</h2><button onClick={()=>setSelectedId('iss:25544')}>Select ISS</button></div>
      <p className="catalogue-state" aria-live="polite">{orbitState==='ready'?'1 propagated object · NORAD 25544':orbitState==='error'?'Orbital snapshot unavailable':'Loading the orbital snapshot…'}</p>
      {orbitState==='error'&&<button onClick={()=>setOrbitAttempt(x=>x+1)}>Retry orbital snapshot</button>}
      <label className="star-toggle"><input type="checkbox" checked={showTrail} onChange={e=>setShowTrail(e.target.checked)}/> Show 60-second model trail</label>

      <div className="stellar-heading"><h2>The naked-eye field</h2><p className="catalogue-state" aria-live="polite">{starState==='ready'?`${catalogue!.stars.length.toLocaleString('en')} catalogue records · V ≤ 6.0`:starState==='loading'?'Loading the stellar catalogue…':'Stellar catalogue unavailable'}</p></div>
      {starState==='error'&&<button onClick={()=>setStarAttempt(x=>x+1)}>Retry stellar catalogue</button>}
      <label className="star-toggle"><input type="checkbox" checked={showStars} onChange={e=>setShowStars(e.target.checked)}/> Show stars</label>
      <label htmlFor="star-choice">Named star</label><select id="star-choice" value={named.some(x=>x.id===selectedId)?selectedId??'':''} onChange={e=>setSelectedId(e.target.value||null)} disabled={!catalogue}><option value="">Choose a star</option>{named.map(x=><option key={x.id} value={x.id}>{x.name} · V {x.mag.toFixed(2)}</option>)}</select>
      {selectedId==='iss:25544'&&orbit&&<article className="star-card" aria-label="Selected satellite"><h3>ISS / ZARYA</h3><p className="star-id">NORAD 25544 · 1998-067A</p><dl>
        <dt>{OBSERVER.name} altitude</dt><dd>{position?`${position.altitude.toFixed(1)}° · ${position.altitude>0?'Above':'Below'} horizon`:'Unavailable'}</dd><dt>Range</dt><dd>{position?`${position.rangeKm.toFixed(0)} km`:'Unavailable'}</dd><dt>Element offset</dt><dd>{position?`${position.ageHours>=0?'+':''}${position.ageHours.toFixed(2)} h`:'Unavailable'}</dd>
        </dl><p className="sky-note">Element epoch<br/>{utcLabel(orbit.epoch)}<br/>Captured<br/>{utcLabel(Date.parse(orbit.release.source.capturedAt))}</p><p className="sky-note">SGP4 from dated orbital elements. Geometric pass; the cyan light and trail express motion.</p><a className="credit" href="./data/orbital/NOTICE.txt">CelesTrak / USSPACECOM · source and terms ↗</a></article>}
      {selected&&<article className="star-card" aria-label="Selected star"><h3>{selected.name??selected.designation??`HYG ${selected.hyg}`}</h3><p className="star-id">HYG {selected.hyg}{selected.hip?` · HIP ${selected.hip}`:''}</p><dl><dt>Visual magnitude</dt><dd>{selected.mag.toFixed(2)}</dd><dt>B−V colour index</dt><dd>{selected.bv===null?'Unavailable':selected.bv.toFixed(3)}</dd><dt>Distance</dt><dd>{selected.distance===null?'Unavailable':`${selected.distance.toFixed(2)} pc`}</dd><dt>Catalogue RA</dt><dd>{(selected.ra*12/Math.PI).toFixed(5)} h</dd><dt>Catalogue declination</dt><dd>{(selected.dec*180/Math.PI).toFixed(5)}°</dd><dt>{OBSERVER.name} altitude</dt><dd>{horizon!.altitude.toFixed(1)}° · {horizon!.altitude>0?'Above':'Below'} horizon</dd><dt>Variability</dt><dd>{selected.variable??'No designation supplied'}</dd></dl><button onClick={()=>setSelectedId(null)}>Clear selection</button></article>}
      <p className="sky-note">Sky turns with the study clock.<br/>Sun {sunAltitude.toFixed(1)}°{sunAltitude>=-6?' · daylight/twilight, stars faded':''}.<br/>Catalogue positions: J2000. Idealised dark sky; observing conditions omitted.</p><a className="credit" href="./data/stellar/NOTICE.txt">HYG 4.4 · David Nash / Astronomy Nexus · CC BY-SA 4.0 ↗</a>
    </section>
    <section className="controls" aria-label="Study and camera controls">
      <div className="control-heading"><span>STUDY CLOCK</span><span>{playing?'Playing':'Paused'} · {rate>0?'+':''}{rate}×</span></div><p className="study-time" data-testid="study-time">{orbit?utcLabel(time):'Loading dated study…'}</p>
      <TimelineScrubber windowStart={orbit?.start??time} windowEnd={orbit?.end??time+1} time={time} onSeek={seek} ariaLabel="Study time" ariaValueText={utcLabel(time)} disabled={!orbit} step={1000}/>
      <div className="clock-window">{orbit&&<><span>{fmtTime(orbit.start)}</span><span>{fmtTime(orbit.end)}</span></>}</div>
      <div className="buttons clock-buttons"><button disabled={!orbit} onClick={()=>{setCue(false);setPlaying(x=>!x)}}>{playing?'Pause study':'Play study'}</button><button disabled={!orbit} onClick={()=>{setCue(false);setRate(x=>-x)}}>Reverse time</button><label className="speed-label">Speed<select aria-label="Study speed" value={Math.abs(rate)} onChange={e=>setRate(x=>Math.sign(x)*Number(e.target.value))}><option value="1">1×</option><option value="10">10×</option><option value="60">60×</option></select></label><button disabled={!orbit} onClick={watchPass}>Watch Sydney pass</button></div>
      {orbit&&<p className="pass-note"><button className="pass-link" aria-label="Seek to pass peak" onClick={()=>{seek(Date.parse(orbit.release.pass.peakUtc));window.scrollTo({top:0,behavior:'instant'})}}>Culmination {fmtTime(Date.parse(orbit.release.pass.peakUtc))}</button> · {orbit.release.pass.maximumElevationDegrees.toFixed(1)}° elevation · Sun {orbit.release.pass.solarAltitudeDegrees.toFixed(1)}°</p>}
      <div className="control-heading camera-heading"><span>CAMERA DESCENT</span><span>{Math.round(progress*100)}%</span></div><label className="sr-only" htmlFor="descent">Descent to surface</label><input id="descent" type="range" min="0" max="1" step="0.001" value={progress} onChange={e=>{setTarget(null);setCue(false);setProgress(Number(e.target.value))}}/>
      <div className="buttons"><button onClick={()=>{setCue(false);setTarget(1)}} disabled={progress===1||target===1}>Descend to surface</button><button onClick={()=>{setCue(false);setTarget(null)}} disabled={target===null}>Pause camera</button><button onClick={()=>{setCue(false);setTarget(0)}} disabled={progress===0||target===0}>Return to orbit</button></div><p className="camera-state" role="status">{target===null?'Camera paused':'Camera moving'}{reduced?' · reduced motion':''}</p>
    </section>
    <footer><p>{failed?'WebGL unavailable. Object records and clock remain accessible.':`${orbit?'1 propagated ISS object':'ISS snapshot '+orbitState} · ${catalogue?'5,070 HYG stars':'Stellar catalogue '+starState} · Earth-fixed view`}</p><nav aria-label="Study references"><a href={brief}>Study brief ↗</a><a href="https://github.com/emmettl/zenit">Source ↗</a><a href="./data/zenit-manifest.json">Evidence status ↗</a></nav></footer>
  </main>
}
