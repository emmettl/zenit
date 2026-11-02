/** Local desktop/emulation measurement, never a physical-phone FPS claim. */
import {chromium,webkit,devices} from '@playwright/test'
import {writeFile,mkdir,readFile} from 'node:fs/promises'
const base=process.env.ZENIT_MEASURE_URL??'http://127.0.0.1:4197',group=process.argv[2]??'oneweb',results=[]
if(!['oneweb','starlink','kuiper'].includes(group))throw Error('Unknown constellation')
const large=JSON.parse(await readFile('src/large-constellation-releases.json')),releaseIndex=group==='oneweb'?JSON.parse(await readFile('src/constellation-release.json')):large[group]
const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))]
for(const [engine,options,label] of [[chromium,{viewport:{width:1280,height:720}},'Headless Chromium desktop'],[webkit,{...devices['iPhone 13']},'Headless WebKit iPhone 13 emulation (not a physical phone)']]){
 const browser=await engine.launch(),page=await browser.newPage({...options,reducedMotion:'reduce'}),begin=performance.now()
 await page.goto(base+'/how-a-constellation-takes-shape/?constellation='+group);await page.waitForFunction(()=>document.documentElement.dataset.constellation==='ready');const readyMs=performance.now()-begin
 await page.selectOption('#speed','300');await page.click('#play')
 const measurement=await page.evaluate(async(start)=>{
  const canvas=document.querySelector('canvas'),gaps=[],costs=[],workerCosts=[],modelGaps=[];let previous=performance.now(),lastFrame=previous,lastTime=canvas.dataset.time
  for(let i=0;i<120;i++)await new Promise(resolve=>requestAnimationFrame(now=>{if(i>10)gaps.push(now-previous);if(canvas.dataset.time!==lastTime){if(i>10){modelGaps.push(now-lastFrame);costs.push(Number(canvas.dataset.sampleMs));workerCosts.push(Number(canvas.dataset.workerMs??0))}lastFrame=now;lastTime=canvas.dataset.time}previous=now;resolve()}))
  document.getElementById('play').click()
  const input=document.getElementById('time'),seeks=[]
  for(const t of [0,600,1800,300,1200,900,60,1740,600,0]){const began=performance.now();input.value=String(t);input.dispatchEvent(new Event('input',{bubbles:true}));while(Number(canvas.dataset.time)!==start+t*1000){if(performance.now()-began>5000)throw Error('Seek failed to commit');await new Promise(resolve=>requestAnimationFrame(resolve))}seeks.push(performance.now()-began)}
  return {gaps,costs,workerCosts,seeks,modelGaps,devicePixelRatio,shown:Number(canvas.dataset.shown),time:canvas.dataset.time}
 },Date.parse(releaseIndex.study.startUtc))
 const summary={label,browserVersion:browser.version(),viewport:page.viewportSize(),devicePixelRatio:measurement.devicePixelRatio,rate:300,readyMs,retainedRecords:releaseIndex.records,finalShown:measurement.shown,rafIntervals:{samples:measurement.gaps.length,medianMs:quantile(measurement.gaps,.5),p95Ms:quantile(measurement.gaps,.95)},modelFrameIntervals:{samples:measurement.modelGaps.length,medianMs:quantile(measurement.modelGaps,.5),p95Ms:quantile(measurement.modelGaps,.95)},mainThreadSampleAndUI:{medianMs:quantile(measurement.costs,.5),p95Ms:quantile(measurement.costs,.95)},workerPropagation:{medianMs:quantile(measurement.workerCosts,.5),p95Ms:quantile(measurement.workerCosts,.95)},seekToCommittedFrame:{samples:measurement.seeks.length,medianMs:quantile(measurement.seeks,.5),p95Ms:quantile(measurement.seeks,.95)}}
 results.push(summary);await browser.close()
}
const report={payloadSha256:releaseIndex.sha256,measuredAt:new Date().toISOString(),host:{platform:process.platform,architecture:process.arch},method:'Production preview, complete population, 300x direct propagation, 120 real rAF samples after load with first 11 omitted, ten direct seeks. Main-thread sampling/UI excludes subsequent GPU draw. Worker propagation is reported separately. rAF gaps measure scheduler cadence; model-frame gaps measure changed UTC on rendered updates (the app targets about 30 Hz). Seeks wait for the requested UTC packet to commit, measured at rAF observation resolution. Engines run sequentially. No virtual clock.',limitation:'Local headless desktop and phone emulation only; hardware model and physical phone not measured. Bounded local check, not a sustained physical-device frame-rate claim.',results}
const root=group==='oneweb'?'work/constellation-proof':'work/large-constellations';await mkdir(root,{recursive:true});await writeFile(root+'/'+group+'-browser-measurement.json',JSON.stringify(report,null,2)+'\n')
const path='docs/evidence/'+(group==='oneweb'?'constellation-proof-2026-11-02.json':'large-constellations-2026-11-02.json'),audit=JSON.parse(await readFile(path));(group==='oneweb'?audit:audit.groups[group]).validation.browserMeasurement=report;await writeFile(path,JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(report,null,2))
