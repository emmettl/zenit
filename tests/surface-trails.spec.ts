import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {Vector3} from 'three'
import {createPopulation,readCohorts} from '../src/cohorts'
import {orbitalState} from '../src/orbital'
const snapshot=readCohorts(JSON.parse(readFileSync(new URL('../public/data/orbital/cohorts-8ceb46133139.json',import.meta.url),'utf8'))),population=createPopulation(snapshot)
async function tails(page:Page){return JSON.parse((await page.locator('canvas').getAttribute('data-surface-trails'))!) as {id:string;head:number[];segments:number}[]}
async function surface(page:Page){await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('canvas')).toHaveAttribute('data-orbital-count','616');await page.getByRole('button',{name:'Descend to surface',exact:true}).click();await expect(page.locator('canvas')).toHaveAttribute('data-camera-phase','Looking up');await expect.poll(()=>tails(page)).not.toEqual([])}
async function checkHeads(page:Page){const canvas=page.locator('canvas'),time=Number(await canvas.getAttribute('data-study-time'));await expect(canvas).toHaveAttribute('data-surface-trail-time',String(time));const shown=await tails(page);expect(new Set(shown.map(x=>x.id)).size).toBe(shown.length);expect(shown.length).toBeLessThanOrEqual(Math.min(page.viewportSize()!.width,page.viewportSize()!.height)<=650?2:3);for(const item of shown){expect(item.id).not.toBe('25544');const index=snapshot.movers.findIndex(x=>x.id===item.id),direct=orbitalState(population.propagators[index],time)!;expect(new Vector3(...item.head as [number,number,number]).distanceTo(direct.world)).toBeLessThan(1e-12);expect(item.segments).toBeGreaterThan(0);expect(item.segments).toBeLessThanOrEqual(15)}}
test('surface tails meet real movers, stay sparse and follow clock seeks; orbit has no auxiliary tails',async({page},info)=>{
  await surface(page);const canvas=page.locator('canvas');await checkHeads(page);await page.screenshot({path:info.outputPath('surface-trails.png')})
  await page.getByRole('button',{name:'Show panels',exact:true}).click()
  await page.getByRole('slider',{name:'Study time',exact:true}).fill(String(Date.parse('2026-10-07T17:58:49Z')));await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse('2026-10-07T17:58:49Z')))
  await page.getByRole('button',{name:'Hide panels',exact:true}).click();await expect.poll(()=>tails(page)).not.toEqual([]);await checkHeads(page);await page.screenshot({path:info.outputPath('surface-trails-peak.png')})
  await page.getByRole('button',{name:'Return to orbit',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera-phase','Orbit');await expect(canvas).toHaveAttribute('data-surface-trails','[]')
})
test('trail control, family filters and selected movers never leave duplicate or hidden tails',async({page})=>{
  await surface(page);const id=(await tails(page))[0].id;await page.getByRole('button',{name:'Show panels',exact:true}).click()
  await page.getByRole('checkbox',{name:'Show model trails',exact:true}).uncheck();await expect(page.locator('canvas')).toHaveAttribute('data-surface-trails','[]')
  await page.getByRole('checkbox',{name:'Show model trails',exact:true}).check();await page.getByLabel('Satellite or attachment',{exact:true}).selectOption(id)
  await page.getByRole('button',{name:'Hide panels',exact:true}).click();expect((await tails(page)).some(x=>x.id===id)).toBe(false)
  await page.getByRole('button',{name:'Show panels',exact:true}).click();for(const family of ['Stations','Navigation','Geosynchronous'])await page.getByRole('checkbox',{name:new RegExp(family)}).uncheck()
  await expect(page.locator('canvas')).toHaveAttribute('data-surface-trails','[]');await expect(page.locator('canvas')).toHaveAttribute('data-filtered-count','0')
})
test('panning reprojects paused tails without changing their physical time or the visible star catalogue',async({page})=>{
  await surface(page);await page.getByRole('button',{name:'Re-centre on ISS',exact:true}).click();const canvas=page.locator('canvas'),time=await canvas.getAttribute('data-study-time'),before=await tails(page)
  for(let i=0;i<8;i++)await canvas.press('ArrowRight');await expect(canvas).toHaveAttribute('data-study-time',time!);await checkHeads(page)
  await page.getByRole('button',{name:'Re-centre on ISS',exact:true}).click();await checkHeads(page);expect(await tails(page)).toEqual(before)
  await expect(canvas).toHaveAttribute('data-star-count','5070');await expect(canvas).toHaveAttribute('data-surface-star-opacity',/0\.9[0-9]{2}|1\.000/)
})

test('delayed surface packets retain coherent tails and reject superseded seek history',async({page})=>{
  await page.addInitScript(()=>{
    const gate={held:false,queued:[] as (()=>void)[],release(){this.queued.shift()?.()}};Object.assign(window,{trailGate:gate});const OriginalWorker=window.Worker
    window.Worker=class extends OriginalWorker {private receiver:((event:MessageEvent)=>void)|null=null;constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',event=>{const deliver=()=>this.receiver?.(event);if(event.data.type==='frame'&&gate.held)gate.queued.push(deliver);else deliver()})}override get onmessage(){return this.receiver}override set onmessage(handler:((event:MessageEvent)=>void)|null){this.receiver=handler}}
  })
  await surface(page);await page.getByRole('button',{name:'Show panels',exact:true}).click();const canvas=page.locator('canvas'),clock=page.getByRole('slider',{name:'Study time',exact:true}),initial=await canvas.getAttribute('data-study-time'),before=await canvas.getAttribute('data-surface-trails'),latest=Number(initial)+90000
  await page.evaluate(()=>(window as unknown as {trailGate:{held:boolean}}).trailGate.held=true)
  const queued=()=>page.evaluate(()=>(window as unknown as {trailGate:{queued:unknown[]}}).trailGate.queued.length)
  await clock.fill(String(Number(initial)+60000));await expect.poll(queued).toBe(1);await clock.fill(String(latest))
  await expect(canvas).toHaveAttribute('data-study-time',initial!);await expect(canvas).toHaveAttribute('data-surface-trails',before!);await expect(canvas).toHaveAttribute('data-surface-trail-time',initial!)
  await page.evaluate(()=>(window as unknown as {trailGate:{release:()=>void}}).trailGate.release());await expect.poll(queued).toBe(1)
  await expect(canvas).toHaveAttribute('data-study-time',initial!);await expect(canvas).toHaveAttribute('data-surface-trails',before!)
  await page.evaluate(()=>{const gate=(window as unknown as {trailGate:{held:boolean;release:()=>void}}).trailGate;gate.held=false;gate.release()})
  await expect(canvas).toHaveAttribute('data-study-time',String(latest));await checkHeads(page)
})
