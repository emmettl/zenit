import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {TimelineScrubber} from '@motionstudies/web/components/TimelineScrubber'
import '@motionstudies/web/study-timeline.css'
import {SceneView} from './Scene'
import {OBSERVER,cameraPhase,ARRIVAL} from './camera'
import {journeySample,JOURNEY_DURATION} from './journey'
import {openingReveal,REVEAL_BEATS,familyReading} from './introduction'
import {type Catalogue,horizonReading,loadCatalogue,skyDirections,SKY_TIME,solarAltitude} from './stellar'
import {type Orbit,type Propagator,advanceStudy,loadOrbit,orbitalPosition,utcLabel} from './orbital'
import {json2satrec} from 'satellite.js'
import {type Cohorts,type GroupId,GROUP_IDS,loadCohorts,enabledMover} from './cohorts'
import {usePopulation} from './use-population'
const brief='https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md'
export function App() {
  const [panelsOpen,setPanelsOpen]=useState(false)
  const [following,setFollowing]=useState(false),[cameraReset,setCameraReset]=useState(0),[cameraZoom,setCameraZoom]=useState(0)
  const [progress,setProgress]=useState(0),[target,setTarget]=useState<number|null>(null),[failed,setFailed]=useState(false)
  const [catalogue,setCatalogue]=useState<Catalogue|null>(null),[orbit,setOrbit]=useState<Orbit|null>(null)
  const [starState,setStarState]=useState('loading'),[orbitState,setOrbitState]=useState('loading'),[starAttempt,setStarAttempt]=useState(0),[orbitAttempt,setOrbitAttempt]=useState(0)
  const [cohorts,setCohorts]=useState<Cohorts|null>(null),[cohortState,setCohortState]=useState('loading'),[cohortAttempt,setCohortAttempt]=useState(0)
  const [groups,setGroups]=useState<GroupId[]>([...GROUP_IDS]),[scale,setScale]=useState<'whole'|'near'>('whole'),[revision,setRevision]=useState(0),[workerAttempt,setWorkerAttempt]=useState(0)
  const [showStars,setShowStars]=useState(true),[showTrail,setShowTrail]=useState(true),[selectedId,setSelectedId]=useState<string|null>('iss:25544')
  const [time,setTime]=useState(Date.parse(SKY_TIME)),[playing,setPlaying]=useState(false),[rate,setRate]=useState(600),[cue,setCue]=useState(false)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible,setVisible]=useState(()=>!document.hidden)
  const [journey,setJourney]=useState<number|null>(null)
  const journeyCurrent=useRef(journey);journeyCurrent.current=journey
  const journeyFrame=journey!==null&&orbit?journeySample(journey,Date.parse(orbit.release.study.initialUtc),orbit.start,orbit.end):null
  const cameraProgress=journeyFrame?.progress??progress
  const interaction=useRef(()=>{})
  const autoplayPending=useRef(!reduced)
  const current=useRef(cameraProgress);current.current=cameraProgress
  const reducedCurrent=useRef(reduced);reducedCurrent.current=reduced
  const fail=useCallback(()=>setFailed(true),[]),select=useCallback((id:string)=>{interaction.current();setSelectedId(id);setFollowing(current.current===0&&(id.startsWith('sat:')||id.startsWith('iss:')))},[])
  useEffect(()=>{const controller=new AbortController();setStarState('loading');loadCatalogue(controller.signal).then(value=>{setCatalogue(value);setStarState('ready')}).catch(()=>{if(!controller.signal.aborted)setStarState('error')});return()=>controller.abort()},[starAttempt])
  useEffect(()=>{const controller=new AbortController();setOrbitState('loading');loadOrbit(controller.signal).then(value=>{setOrbit(value);setTime(Date.parse(value.release.study.initialUtc));setRevision(x=>x+1);setOrbitState('ready')}).catch(()=>{if(!controller.signal.aborted)setOrbitState('error')});return()=>controller.abort()},[orbitAttempt])
  useEffect(()=>{const controller=new AbortController();setCohortState('loading');loadCohorts(controller.signal).then(value=>{setCohorts(value);setCohortState('ready')}).catch(()=>{if(!controller.signal.aborted)setCohortState('error')});return()=>controller.abort()},[cohortAttempt])
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{if(query.matches===reducedCurrent.current)return;interaction.current();autoplayPending.current=false;setReduced(query.matches);setTarget(null);setPlaying(false);setCue(false)};query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[])
  useEffect(()=>{const change=()=>{setVisible(!document.hidden);if(document.hidden){setPlaying(false);setTarget(null);setCue(false)}};document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[])
  useEffect(()=>{
    if(!playing||!orbit)return
    let frame=0,last=performance.now()
    const tick=(now:number)=>{const elapsed=now-last;if(elapsed>=25){last=now;if(journeyCurrent.current!==null){const previous=journeyCurrent.current,next=(previous+elapsed)%JOURNEY_DURATION;journeyCurrent.current=next;setJourney(next);setTime(journeySample(next,Date.parse(orbit.release.study.initialUtc),orbit.start,orbit.end).time);if(next<previous)setRevision(x=>x+1)}else setTime(value=>advanceStudy(value,elapsed,rate,orbit.start,orbit.end))}frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[playing,rate,orbit,journey!==null])
  useEffect(()=>{
    if(target===null)return
    const arrived=()=>{setTarget(null);if(cue&&target===1){setCue(false);if(!reduced)setPlaying(true)}}
    if(reduced){setProgress(target);arrived();return}
    const from=current.current,duration=12000*Math.abs(target-from);let frame=0,start:number|undefined
    const tick=(now:number)=>{start??=now;const fraction=Math.min(1,(now-start)/Math.max(duration,1));setProgress(from+(target-from)*fraction);if(fraction<1)frame=requestAnimationFrame(tick);else arrived()}
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[target,reduced,cue])
  const population=usePopulation(cohorts,time,revision,workerAttempt)
  const displayTime=population.frame?.time??time
  const reveal=journeyFrame?openingReveal(journeyFrame.elapsed):null
  const reading=useMemo(()=>reveal?familyReading(cohorts,population.frame,reveal.focus):null,[cohorts,population.frame,reveal?.focus])
  const beat=reveal?REVEAL_BEATS[reveal.index]:null
  useEffect(()=>{
    if(!autoplayPending.current||!orbit||starState==='loading'||cohortState==='loading'||(cohorts&&!population.frame&&!population.failed)||!visible)return
    autoplayPending.current=false;if(!reduced)startJourney()
  },[orbit,starState,cohortState,cohorts,population.frame,population.failed,visible,reduced])
  const named=useMemo(()=>(catalogue?.stars??[]).filter(x=>x.name).sort((a,b)=>a.name!.localeCompare(b.name!)||a.hyg-b.hyg),[catalogue])
  const selected=catalogue?.stars.find(x=>x.id===selectedId)??null
  const horizon=selected?horizonReading(skyDirections([selected],new Date(displayTime).toISOString())[0]):null
  const position=orbit?orbitalPosition(orbit,displayTime):null
  const sunAltitude=solarAltitude(displayTime)
  const immersive=(journey!==null||cameraProgress>0||target!==null)&&!panelsOpen
  const explore=()=>{autoplayPending.current=false;if(journeyCurrent.current!==null){journeyCurrent.current=null;setJourney(null);setProgress(cameraProgress);setTime(displayTime);setRevision(x=>x+1);setRate(journeyFrame?.rate||10);setPlaying(false);setTarget(null);setCue(false);setPanelsOpen(true)}}
  interaction.current=explore
  function startJourney(){if(!orbit)return;autoplayPending.current=false;setTarget(null);setCue(false);setFollowing(false);setCameraReset(x=>x+1);setScale('whole');setGroups([...GROUP_IDS]);setShowStars(true);setShowTrail(true);setSelectedId('iss:25544');setPanelsOpen(false);setProgress(0);setRevision(x=>x+1);window.scrollTo({top:0,behavior:'instant'});if(reduced){setJourney(null);journeyCurrent.current=null;setTime(Date.parse(orbit.release.study.initialUtc));setPlaying(false)}else{setJourney(0);journeyCurrent.current=0;setTime(journeySample(0,Date.parse(orbit.release.study.initialUtc),orbit.start,orbit.end).time);setPlaying(true)}}
  const view=journeyFrame?.stage??(target===0?'Returning to orbit':cameraProgress===0?'Earth-fixed orbital view':cameraPhase(cameraProgress))
  const seek=(value:number)=>{explore();autoplayPending.current=false;setPlaying(false);setCue(false);setRevision(x=>x+1);setTime(value)}
  const watchPass=()=>{if(!orbit)return;explore();autoplayPending.current=false;setPanelsOpen(false);setFollowing(false);setCameraReset(x=>x+1);window.scrollTo({top:0,behavior:'instant'});setPlaying(false);setRevision(x=>x+1);setGroups(x=>x.includes('stations')?x:[...x,'stations']);setTime(Date.parse(orbit.release.study.initialUtc));setRate(10);setSelectedId('iss:25544');if(cameraProgress===1){if(!reduced)setPlaying(true)}else{setCue(true);setTarget(1)}}
  const satelliteId=selectedId?.startsWith('sat:')||selectedId==='iss:25544'?selectedId.split(':')[1]:null
  const attached=cohorts?.attachments.find(x=>x.id===satelliteId)??null
  const mover=cohorts?.movers.find(x=>x.id===(attached?.parentId??satelliteId))??null
  const traced=useMemo<Propagator|null>(()=>mover?{baseline:json2satrec(mover.element,'a'),epoch:Date.parse(mover.element.EPOCH),start:Date.parse(mover.eligibleStartUtc),end:Date.parse(mover.eligibleEndUtc)}:satelliteId==='25544'?orbit:null,[mover,orbit,satelliteId])
  const selectedPosition=traced?orbitalPosition(traced,displayTime):null
  const canFollow=Boolean(satelliteId&&selectedPosition&&(!mover||enabledMover(mover,groups))&&((satelliteId==='25544'&&orbit)||!population.failed))
  useEffect(()=>{if(following&&!canFollow)setFollowing(false)},[following,canFollow])
  const resetCamera=()=>{explore();setFollowing(false);setCameraReset(x=>x+1)}
  const eligible=population.frame?Array.from(population.frame.availability).filter(x=>x===1).length:cohorts?null:position?1:0
  const filtered=population.frame&&cohorts?cohorts.movers.filter((x,i)=>population.frame!.availability[i]===1&&enabledMover(x,groups)).length:null
  const selectedChildren=cohorts?.attachments.filter(x=>x.parentId===mover?.id)??[]
  const satelliteChoices=useMemo(()=>[...(cohorts?.movers??[]).map(x=>({id:x.id,name:x.name,attached:false})),...(cohorts?.attachments??[]).map(x=>({id:x.id,name:x.name,attached:true}))].sort((a,b)=>a.name.localeCompare(b.name)||Number(a.id)-Number(b.id)),[cohorts])
  const fmtTime=(value:number)=>new Date(value).toISOString().slice(11,19)+' UTC'
  return <main className={`${immersive?'cinematic':''}${journey!==null?' journey':''}`.trim()} data-journey-phase={journeyFrame?.stage??'Exploring'} data-journey-elapsed={journey??''} data-introduction={reveal?.focus??'none'}>
    <SceneView panelsOpen={panelsOpen} reveal={reveal} onInteraction={explore} opacity={journeyFrame?.opacity??1} progress={cameraProgress} time={displayTime} catalogue={catalogue} orbit={orbit} showStars={showStars} showTrail={showTrail} cohorts={cohorts} frame={population.frame} groups={groups} scale={scale} traced={traced} selectedId={selectedId} onSelect={select} onFailure={fail} following={following} cameraZoom={cameraZoom} cameraReset={cameraReset} onReset={resetCamera}/>
    <header><a className="series" href="https://motionstudies.app/">MOTION STUDIES</a><h1>ZENIT</h1><p className="subtitle">Earth orbit / the sky above us</p></header>
    <aside className="edition-state"><span className="status-light"/> ORBITAL FAMILIES</aside>
    <section className="composition" aria-labelledby="composition-title"><p className="eyebrow" id="composition-title">{view}</p><h2>{beat?beat.title:cameraProgress===1?'The sky above a place.':cameraProgress>=ARRIVAL?'At the edge of the sky.':'A world surrounded by motion.'}</h2><p>{cameraProgress>=ARRIVAL?`${OBSERVER.name} · a moving light above a turning sky.`:'Three families. One clock. Shells and planes around the world.'}</p></section>
    {reveal&&beat&&immersive&&<section className={`introduction introduction-${reveal.focus}`} aria-label="Orbital introduction" data-caption-time={reading?.time??''}>
      <p className="introduction-step"><span className="introduction-light"/>{String(reveal.index+1).padStart(2,'0')} / 04 · {beat.label}</p>
      <p className="introduction-reading">{reading?<><span><strong>{Math.round(reading.heightKm/10)*10===0?'< 10':(Math.round(reading.heightKm/10)*10).toLocaleString('en')} km</strong> median model height</span><span><strong>{(reading.meanPeriodMinutes/60).toFixed(1)} h</strong> mean period{reveal.focus==='iss'?'':' · median'}</span></>:<span>Dated model · {reveal.focus==='iss'?'Sydney is next':'group reading unavailable'}</span>}</p>
      <p className="introduction-note">{reveal.focus==='iss'?'NORAD 25544 · following this station down to Sydney.':`${reading?.count??'…'} eligible independent objects · memberships can overlap.`}</p>
    </section>}
    <section className="stellar-panel" aria-label="Object catalogue" hidden={immersive}>
      <div className="iss-heading"><h2>Earth's orbital families</h2><button onClick={()=>{explore();setSelectedId('iss:25544');setGroups(x=>x.includes('stations')?x:[...x,'stations'])}}>Select ISS</button></div>
      <p className="catalogue-state" aria-live="polite">{cohortState==='ready'?`${eligible??'…'} eligible movers · ${cohorts!.movers.length} retained · ${cohorts!.attachments.length} attached`:cohortState==='error'?'Orbital families unavailable':'Loading orbital families…'}</p>
      {cohortState==='error'&&<button onClick={()=>setCohortAttempt(x=>x+1)}>Retry orbital families</button>}
      {population.failed&&<><p className="catalogue-state">Population calculations unavailable</p><button onClick={()=>setWorkerAttempt(x=>x+1)}>Retry population calculations</button></>}
      {cohorts&&<fieldset className="family-filters"><legend>Orbital families</legend>{cohorts.groups.map(group=><label key={group.id}><input type="checkbox" checked={groups.includes(group.id)} onChange={e=>{explore();setGroups(x=>e.target.checked?[...x,group.id]:x.filter(id=>id!==group.id))}}/><span className={`family-dot family-${group.id}`}/><span>{group.label}</span><span>{population.frame?cohorts.movers.filter((m,i)=>m.groups.includes(group.id)&&population.frame!.availability[i]===1).length:'…'}</span></label>)}</fieldset>}
      {cohorts&&<p className="sky-note">{filtered??'…'} after family filters. Overlapping memberships draw one light; mint marks shared navigation / geosynchronous membership. Eligibility changes with the 24-hour element-age rule.</p>}
      <label htmlFor="orbit-scale">Orbital framing</label><select id="orbit-scale" value={scale} onChange={e=>{explore();setScale(e.target.value as 'whole'|'near')}}><option value="whole">Whole orbit · linear scale</option><option value="near">Near Earth · linear scale</option></select>
      <label htmlFor="satellite-choice">Satellite or attachment</label><select id="satellite-choice" value={satelliteId??''} onChange={e=>{explore();setSelectedId(e.target.value==='25544'?'iss:25544':e.target.value?'sat:'+e.target.value:null)}} disabled={!cohorts}><option value="">Choose an object</option>{satelliteChoices.map(x=><option key={x.id} value={x.id}>{x.name} · {x.id}{x.attached?' · attached':''}</option>)}</select>
      <label className="star-toggle"><input type="checkbox" checked={showTrail} onChange={e=>{explore();setShowTrail(e.target.checked)}}/> Show 60-second model trail</label>
      {orbitState==='error'&&<><p className="catalogue-state">Orbital snapshot unavailable</p><button onClick={()=>setOrbitAttempt(x=>x+1)}>Retry orbital snapshot</button></>}

      <div className="stellar-heading"><h2>The naked-eye field</h2><p className="catalogue-state" aria-live="polite">{starState==='ready'?`${catalogue!.stars.length.toLocaleString('en')} catalogue records · V ≤ 6.0`:starState==='loading'?'Loading the stellar catalogue…':'Stellar catalogue unavailable'}</p></div>
      {starState==='error'&&<button onClick={()=>setStarAttempt(x=>x+1)}>Retry stellar catalogue</button>}
      <label className="star-toggle"><input type="checkbox" checked={showStars} onChange={e=>{explore();setShowStars(e.target.checked)}}/> Show stars</label>
      <label htmlFor="star-choice">Named star</label><select id="star-choice" value={named.some(x=>x.id===selectedId)?selectedId??'':''} onChange={e=>{explore();setSelectedId(e.target.value||null)}} disabled={!catalogue}><option value="">Choose a star</option>{named.map(x=><option key={x.id} value={x.id}>{x.name} · V {x.mag.toFixed(2)}</option>)}</select>
      {satelliteId&&(mover||orbit)&&<article className="star-card" aria-label="Selected satellite"><h3>{attached?.name??(satelliteId==='25544'?'ISS / ZARYA':mover?.name)}</h3><p className="star-id">NORAD {satelliteId}{mover&&!attached?` · ${mover.element.OBJECT_ID}`:''}</p>
        {attached&&<p className="attachment-note">Attached to {mover?.name} · NORAD {attached.parentId}. Position and trail follow the parent; this is not an independent mover.</p>}
        <dl><dt>{OBSERVER.name} altitude</dt><dd>{selectedPosition?`${selectedPosition.altitude.toFixed(1)}° · ${selectedPosition.altitude>0?'Above':'Below'} horizon`:'Unavailable'}</dd><dt>Range</dt><dd>{selectedPosition?`${selectedPosition.rangeKm.toFixed(0)} km`:'Unavailable'}</dd><dt>Element offset</dt><dd>{selectedPosition?`${selectedPosition.ageHours>=0?'+':''}${selectedPosition.ageHours.toFixed(2)} h`:traced&&displayTime>=traced.start&&displayTime<=traced.end?'Propagation unavailable':'Outside eligible window'}</dd>{mover&&<><dt>Inclination</dt><dd>{Number(mover.element.INCLINATION).toFixed(2)}°</dd><dt>Mean period</dt><dd>{(1440/Number(mover.element.MEAN_MOTION)).toFixed(1)} min</dd><dt>Membership</dt><dd>{mover.groups.map(x=>cohorts!.groups.find(g=>g.id===x)!.label).join(' / ')}</dd></>}</dl>
        {mover&&!enabledMover(mover,groups)&&<p className="sky-note">Hidden by the family filters.</p>}
        <p className="sky-note">{attached?'Parent element epoch':'Element epoch'}<br/>{utcLabel(traced!.epoch)}<br/>{attached?'Attachment relationship: frozen SATCAT snapshot.':`Geometric position at ${utcLabel(displayTime)}.`}</p>
        {selectedChildren.length>0&&<details className="attachments"><summary>{selectedChildren.length} attached records</summary>{selectedChildren.map(x=><button key={x.id} onClick={()=>{explore();setSelectedId('sat:'+x.id)}}>{x.name} · {x.id}</button>)}</details>}
        {(attached?.metadata??mover?.metadata)&&<p className="sky-note">SATCAT type {(attached?.metadata??mover?.metadata)?.objectType??'unknown'} · catalogue launch date {(attached?.metadata??mover?.metadata)?.launchDate??'unknown'}</p>}
        <p className="sky-note">SGP4 from dated orbital elements. Geometric positions; light and trail sizes express motion.</p><a className="credit" href="./data/orbital/NOTICE.txt">CelesTrak / USSPACECOM · source and terms ↗</a></article>}

      {selected&&<article className="star-card" aria-label="Selected star"><h3>{selected.name??selected.designation??`HYG ${selected.hyg}`}</h3><p className="star-id">HYG {selected.hyg}{selected.hip?` · HIP ${selected.hip}`:''}</p><dl><dt>Visual magnitude</dt><dd>{selected.mag.toFixed(2)}</dd><dt>B−V colour index</dt><dd>{selected.bv===null?'Unavailable':selected.bv.toFixed(3)}</dd><dt>Distance</dt><dd>{selected.distance===null?'Unavailable':`${selected.distance.toFixed(2)} pc`}</dd><dt>Catalogue RA</dt><dd>{(selected.ra*12/Math.PI).toFixed(5)} h</dd><dt>Catalogue declination</dt><dd>{(selected.dec*180/Math.PI).toFixed(5)}°</dd><dt>{OBSERVER.name} altitude</dt><dd>{horizon!.altitude.toFixed(1)}° · {horizon!.altitude>0?'Above':'Below'} horizon</dd><dt>Variability</dt><dd>{selected.variable??'No designation supplied'}</dd></dl><button onClick={()=>{explore();setSelectedId(null)}}>Clear selection</button></article>}
      <p className="sky-note">Sky turns with the study clock.<br/>Sun {sunAltitude.toFixed(1)}°{sunAltitude>=-6?' · daylight/twilight, stars faded':''}.<br/>Catalogue positions: J2000. Idealised dark sky; observing conditions omitted.</p><a className="credit" href="./data/stellar/NOTICE.txt">HYG 4.4 · David Nash / Astronomy Nexus · CC BY-SA 4.0 ↗</a><p className="sky-note">Global geography: Natural Earth 1:110m. The landing uses an idealised WGS84 horizon at 58 m; no local terrain or weather.</p><a className="credit" href="./licences/natural-earth.txt">Made with Natural Earth · public-domain geography ↗</a>
    </section>
    <section className="controls" aria-label="Study and camera controls">
      <p className="cinematic-object">{reveal&&reveal.focus!=='iss'?'Earth’s orbital families':satelliteId?`${attached?.name??(satelliteId==='25544'?'ISS / ZARYA':mover?.name??'Satellite')} · NORAD ${satelliteId}`:selected?.name??'Stellar sky'}<span>{journeyFrame?.stage??cameraPhase(cameraProgress)} · {Math.round(cameraProgress*100)}%</span></p>
      <div className="control-heading"><span>{journeyFrame?'JOURNEY':'STUDY CLOCK'}</span><span>{playing?'Playing':'Paused'} · {journeyFrame?(journeyFrame.rate===0?'Clock held':`+${journeyFrame.rate}×`):`${rate>0?'+':''}${rate}×`} · Loop</span></div><p className="study-time" data-testid="study-time">{orbit||cohorts?utcLabel(displayTime):'Loading dated study…'}</p>
      <TimelineScrubber windowStart={orbit?.start??time} windowEnd={orbit?.end??time+1} time={time} onSeek={seek} ariaLabel="Study time" ariaValueText={utcLabel(time)} disabled={!orbit} step={1000}/>
      {population.pending&&<p className="position-state" aria-live="polite">Updating orbital positions…</p>}
      <div className="clock-window">{orbit&&<><span>{fmtTime(orbit.start)}</span><span>{fmtTime(orbit.end)}</span></>}</div>
      <div className="buttons clock-buttons"><button disabled={!orbit} onClick={()=>{autoplayPending.current=false;setCue(false);setPlaying(x=>!x)}}>{playing?'Pause study':'Play study'}</button><button disabled={!orbit} onClick={()=>{explore();autoplayPending.current=false;setCue(false);setTime(displayTime);setRevision(x=>x+1);setRate(x=>-x)}}>Reverse time</button><label className="speed-label">Speed<select aria-label="Study speed" value={Math.abs(rate)} onChange={e=>{explore();setRate(x=>(Math.sign(x)||1)*Number(e.target.value))}}><option value="1">1×</option><option value="10">10×</option><option value="60">60×</option><option value="600">600×</option></select></label><button disabled={!orbit} onClick={watchPass}>Watch Sydney pass</button></div>
      {orbit&&<p className="pass-note"><button className="pass-link" aria-label="Seek to pass peak" onClick={()=>{seek(Date.parse(orbit.release.pass.peakUtc));window.scrollTo({top:0,behavior:'instant'})}}>Culmination {fmtTime(Date.parse(orbit.release.pass.peakUtc))}</button> · {orbit.release.pass.maximumElevationDegrees.toFixed(1)}° elevation · Sun {orbit.release.pass.solarAltitudeDegrees.toFixed(1)}°</p>}
      <div className="camera-navigation"><button onClick={()=>{explore();setFollowing(x=>!x)}} aria-pressed={following} disabled={!canFollow||cameraProgress!==0}>{following?'Stop following':'Focus and follow'}</button><button onClick={resetCamera} disabled={cameraProgress!==0}>Reset orbital view</button><button onClick={()=>{explore();setCameraZoom(x=>x+1)}} disabled={cameraProgress!==0}>Zoom in</button><button onClick={()=>{explore();setCameraZoom(x=>x-1)}} disabled={cameraProgress!==0}>Zoom out</button></div><p className="navigation-hint">{cameraProgress===0?(following?'Following the selected satellite. Drag to orbit it; scroll to zoom.':'Drag to orbit Earth · scroll to zoom · click a satellite to follow.'):'Orbital navigation resumes on return.'}<br/>Keyboard: arrow keys, + / −, Home to reset.</p>
      <div className="control-heading camera-heading"><span>CAMERA DESCENT</span><span>{Math.round(cameraProgress*100)}%</span></div><label className="sr-only" htmlFor="descent">Descent to surface</label><input id="descent" type="range" min="0" max="1" step="0.001" value={cameraProgress} onChange={e=>{explore();setPanelsOpen(true);setTarget(null);setCue(false);setProgress(Number(e.target.value))}}/>
      <div className="buttons camera-buttons">{journeyFrame?<button onClick={explore}>Explore freely</button>:<><button disabled={!orbit} onClick={startJourney}>Replay journey</button><button onClick={()=>{explore();window.scrollTo({top:0,behavior:'instant'});setPanelsOpen(false);setCue(false);setTarget(1)}} disabled={cameraProgress===1||target===1}>Descend to surface</button><button onClick={()=>{setCue(false);setTarget(null)}} disabled={target===null}>Pause camera</button><button onClick={()=>{setCue(false);setTarget(0)}} disabled={cameraProgress===0||target===0}>Return to orbit</button></>}{(journeyFrame||cameraProgress>0||target!==null)&&<button className="panel-toggle" aria-expanded={panelsOpen} onClick={()=>setPanelsOpen(x=>!x)}>{panelsOpen?'Hide panels':'Show panels'}</button>}</div><p className="camera-state" role="status">{journeyFrame?`${journeyFrame.stage} · ${playing?'Journey playing':'Journey paused'}`:target===null?'Camera paused':'Camera moving'}{reduced?' · reduced motion':''}</p>
    </section>
    <footer><p>{failed?'WebGL unavailable. Object records and clock remain accessible.':`${cohorts?`${eligible??'Calculating'} eligible movers / ${filtered??'…'} filtered`:orbit?'1 propagated ISS object':'ISS snapshot '+orbitState} · ${catalogue?'5,070 HYG stars':'Stellar catalogue '+starState} · Earth-fixed view`}</p><nav aria-label="Study references"><a href={brief}>Study brief ↗</a><a href="https://github.com/emmettl/zenit">Source ↗</a><a href="./data/zenit-manifest.json">Evidence status ↗</a></nav></footer>
  </main>
}
