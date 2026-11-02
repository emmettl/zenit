import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {CONSTELLATIONS,readConstellation,constellationOrbits,constellationState,type ConstellationId} from '../src/constellation'
const releases=Object.fromEntries(Object.entries(CONSTELLATIONS).map(([id,index])=>[id,readConstellation(JSON.parse(readFileSync('public/'+index.file.slice(2),'utf8')),id as ConstellationId)])),start=Date.parse(CONSTELLATIONS.starlink.study.startUtc)
async function open(page:Page,reduced=true){await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await page.clock.install({time:new Date('2026-11-02T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-02T12:00:01Z'));await page.goto('/how-a-constellation-takes-shape/?constellation=starlink');await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');return page.locator('canvas')}
async function advance(page:Page,ms:number){await page.clock.fastForward(ms);await page.clock.runFor(100)}
test('all eligible Starlink identities render from a worker with no population sample or other group fetch',async({page,baseURL},info)=>{
 const external:string[]=[],payloads:string[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(baseURL+'/')&&!r.url().startsWith('data:'))external.push(r.url());if(/\/data\/orbital\/constellation-/.test(r.url()))payloads.push(new URL(r.url()).pathname)})
 const canvas=await open(page);await expect(canvas).toHaveAttribute('data-constellation','starlink');await expect(canvas).toHaveAttribute('data-worker','true');await expect(canvas).toHaveAttribute('data-shown','10642');await expect(canvas).toHaveAttribute('data-eligible','10642');await expect(canvas).toHaveAttribute('data-playing','false');await page.screenshot({path:info.outputPath('full-starlink.png')})
 expect(payloads).toEqual([CONSTELLATIONS.starlink.file.slice(1)]);expect(external).toEqual([]);expect(errors).toEqual([])
 await page.getByRole('button',{name:'Snapshot & sources'}).click();await expect(page.locator('#source-heading')).toContainText('STARLINK');await expect(page.locator('#source-counts')).toContainText('11156 source identities');await expect(page.locator('#source-counts')).toContainText('514 wholly stale');await expect(page.locator('#audit-link')).toHaveAttribute('href',/large-constellations/)
})
test('rapid seeks commit a complete shared UTC packet and preserve exact selected-record coordinates',async({page})=>{
 const canvas=await open(page),id=(await canvas.getAttribute('data-selected'))!,orbit=constellationOrbits(releases.starlink).find(o=>o.mover.id===id)!
 await page.getByRole('slider',{name:'Study timeline'}).evaluate(input=>{for(const t of [600,1200,300,1800,900]){(input as HTMLInputElement).value=String(t);input.dispatchEvent(new Event('input',{bubbles:true}))}})
 await expect(canvas).toHaveAttribute('data-time',String(start+900000));const actual=(await canvas.getAttribute('data-position'))!.split(',').map(Number),expected=constellationState(orbit,start+900000)!.world.toArray();expect(Math.hypot(...actual.map((x,i)=>x-expected[i]))).toBeLessThan(1e-8)
 await page.getByRole('slider',{name:'Study timeline'}).fill('1800');await expect(canvas).toHaveAttribute('data-time',String(start+1800000));await expect(canvas).toHaveAttribute('data-eligible','10590');await expect(canvas).toHaveAttribute('data-shown','10590')
 await page.getByRole('slider',{name:'Study timeline'}).fill('0');await expect(canvas).toHaveAttribute('data-eligible','10642');await expect(canvas).toHaveAttribute('data-time',String(start))
})
test('large-population reveal keeps the same three beats and stops at the complete dated field',async({page},info)=>{
 const canvas=await open(page,false);await expect(canvas).toHaveAttribute('data-shown','1');await advance(page,19000);await expect(canvas).toHaveAttribute('data-stage','1');await expect(canvas).toHaveAttribute('data-shown','100');await page.screenshot({path:info.outputPath('starlink-plane.png')})
 await advance(page,24000);await expect(canvas).toHaveAttribute('data-stage','2');await expect(canvas).toHaveAttribute('data-playing','false');expect(await canvas.getAttribute('data-shown')).toBe(await canvas.getAttribute('data-eligible'));expect(Number(await canvas.getAttribute('data-shown'))).toBeGreaterThan(10000);await expect(canvas).toHaveAttribute('data-time',String(start+840000));await page.screenshot({path:info.outputPath('starlink-reveal.png')})
})
test('switching between Starlink, Kuiper and OneWeb preserves the displayed UTC and pauses',async({page})=>{
 let canvas=await open(page);await page.getByRole('slider',{name:'Study timeline'}).fill('600');await expect(canvas).toHaveAttribute('data-time',String(start+600000))
 for(const id of ['kuiper','oneweb','starlink'] as const){await page.getByRole('combobox',{name:'Constellation',exact:true}).selectOption(id);await expect(page).toHaveURL(new RegExp('constellation='+id+'&t=600'));await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-constellation',id);await expect(canvas).toHaveAttribute('data-worker',String(id!=='oneweb'));await expect(canvas).toHaveAttribute('data-playing','false');await expect(canvas).toHaveAttribute('data-time',String(start+600000));const expected=releases[id].movers.filter(m=>Date.parse(m.eligibleStartUtc)<=start+600000&&Date.parse(m.eligibleEndUtc)>=start+600000).length;await expect(canvas).toHaveAttribute('data-shown',String(expected))}
})
test('large snapshots work on phone orientations, under zenit, and recover from worker startup failure',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});let canvas=await open(page)
 for(const size of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);await expect(page.getByRole('combobox',{name:'Constellation',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);await expect(canvas).toHaveAttribute('data-shown','10642');await page.screenshot({path:info.outputPath('starlink-'+size.width+'.png')})}
 await page.route('**/zenit/**',async route=>{const url=new URL(route.request().url());url.pathname=url.pathname.replace(/^\/zenit/,'');const response=await route.fetch({url:url.toString()});await route.fulfill({response})});await page.goto('/zenit/how-a-constellation-takes-shape/?constellation=starlink');await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-shown','10642')
 await page.route(/constellation\.worker.*\.js/,route=>route.abort());await page.goto('/how-a-constellation-takes-shape/?constellation=starlink');await expect(page.locator('html')).toHaveAttribute('data-constellation','error');await expect(page.locator('#chapter-state')).toContainText('worker');await expect(page.locator('canvas')).toHaveCount(0);await page.unroute(/constellation\.worker.*\.js/);await page.getByRole('button',{name:'Retry snapshot'}).click();await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');await expect(page.locator('canvas')).toHaveAttribute('data-shown','10642')
})
test('pause holds the displayed UTC when a worker frame is already in flight',async({page})=>{
 await page.addInitScript(()=>{
  const state=window as unknown as {holdFrames:boolean;releaseFrame:(()=>void)|null};state.holdFrames=false;state.releaseFrame=null
  const descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!
  Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get:descriptor.get,set(handler:(e:MessageEvent)=>void){descriptor.set!.call(this,(event:MessageEvent)=>{if(state.holdFrames&&event.data.type==='frame'){state.releaseFrame=()=>handler(event);return}handler(event)})}})
 })
 const canvas=await open(page),time=await canvas.getAttribute('data-time');await page.evaluate(()=>(window as unknown as {holdFrames:boolean}).holdFrames=true)
 await page.getByRole('button',{name:'Play',exact:true}).click();await page.clock.runFor(50);await expect.poll(()=>page.evaluate(()=>Boolean((window as unknown as {releaseFrame:(()=>void)|null}).releaseFrame))).toBe(true)
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(canvas).toHaveAttribute('data-playing','false');await expect(canvas).toHaveAttribute('data-time',time!)
 await page.evaluate(()=>{const state=window as unknown as {holdFrames:boolean;releaseFrame:()=>void};state.holdFrames=false;state.releaseFrame()});await expect(canvas).toHaveAttribute('data-time',time!);await expect(canvas).toHaveAttribute('data-playing','false')
})
