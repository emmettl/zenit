import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import index from '../src/constellation-release.json' with {type:'json'}
import {constellationOrbits,constellationState,readConstellation} from '../src/constellation'
const release=readConstellation(JSON.parse(readFileSync('public/'+index.file.slice(2),'utf8'))),orbits=constellationOrbits(release),start=Date.parse(index.study.startUtc)
async function open(page:Page,reduced=false){await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await page.clock.install({time:new Date('2026-11-02T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-02T12:00:01Z'));await page.goto('/how-a-constellation-takes-shape/');await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');return page.locator('canvas')}
async function advance(page:Page,ms:number){await page.clock.fastForward(ms);await page.clock.runFor(100)}
test('one satellite opens into a measured plane and the wider dated constellation',async({page,baseURL},info)=>{
 const errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(baseURL+'/')&&!r.url().startsWith('data:'))external.push(r.url())})
 const canvas=await open(page);await expect(canvas).toHaveAttribute('data-stage','0');await expect(page.getByRole('button',{name:'One satellite',exact:true})).toHaveAttribute('aria-pressed','true');await expect(canvas).toHaveAttribute('data-shown','1');await page.screenshot({path:info.outputPath('one-satellite.png')})
 await advance(page,19000);await expect(canvas).toHaveAttribute('data-stage','1');await expect(page.getByRole('button',{name:'One plane',exact:true})).toHaveAttribute('aria-pressed','true');expect(Number(await canvas.getAttribute('data-shown'))).toBe(Number(await canvas.getAttribute('data-plane-count')));await page.screenshot({path:info.outputPath('one-plane.png')})
 await advance(page,24000);await expect(canvas).toHaveAttribute('data-stage','2');await expect(page.getByRole('button',{name:'The constellation',exact:true})).toHaveAttribute('aria-pressed','true');await expect(canvas).toHaveAttribute('data-playing','false');expect(Number(await canvas.getAttribute('data-shown'))).toBe(Number(await canvas.getAttribute('data-eligible')));await page.screenshot({path:info.outputPath('constellation.png')})
 expect(Number(await canvas.getAttribute('data-time'))).toBe(start+840000);expect(errors).toEqual([]);expect(external).toEqual([])
})
test('direct seeks share UTC, changing eligibility and record identity without a history dependency',async({page})=>{
 const canvas=await open(page,true);await expect(canvas).toHaveAttribute('data-playing','false');await expect(canvas).toHaveAttribute('data-shown','647')
 const id=await canvas.getAttribute('data-selected'),orbit=orbits.find(o=>o.mover.id===id)!
 for(const seconds of [600,1200,300,1800,600]){await page.getByRole('slider',{name:'Study timeline'}).fill(String(seconds));await expect(canvas).toHaveAttribute('data-time',String(start+seconds*1000));const actual=(await canvas.getAttribute('data-position'))!.split(',').map(Number),expected=constellationState(orbit,start+seconds*1000)!.world.toArray();expect(Math.hypot(...actual.map((x,i)=>x-expected[i]))).toBeLessThan(.00000001);if(seconds===1800)await expect(canvas).toHaveAttribute('data-eligible','643')}
 await page.getByRole('button',{name:'Snapshot & sources'}).click();await expect(page.getByRole('complementary')).toContainText('651 source identities');await expect(page.getByRole('complementary')).toContainText('not an operator-assigned plane');await expect(page.locator('#readings')).toContainText(id!)
 await page.getByRole('button',{name:'Follow selected satellite',exact:true}).click();await expect(canvas).toHaveAttribute('data-following',id!);const time=await canvas.getAttribute('data-time');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Frame Earth',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera','free');await expect(canvas).toHaveAttribute('data-time',time!)
})
test('pause, native controls, replay and reduced motion preserve the bounded study',async({page})=>{
 const canvas=await open(page);await advance(page,4000);await page.getByRole('button',{name:'Pause',exact:true}).click();const time=await canvas.getAttribute('data-time');await advance(page,2000);await expect(canvas).toHaveAttribute('data-time',time!)
 await canvas.focus();await page.keyboard.press('ArrowLeft');await expect(canvas).toHaveAttribute('data-camera','free');await expect(canvas).toHaveAttribute('data-time',time!)
 await page.getByRole('button',{name:'Replay reveal'}).click();await expect(canvas).toHaveAttribute('data-camera','guided');await expect(canvas).toHaveAttribute('data-shown','1')
 await page.emulateMedia({reducedMotion:'reduce'});await expect(canvas).toHaveAttribute('data-playing','false');expect(await canvas.getAttribute('data-shown')).toBe(await canvas.getAttribute('data-eligible'));await page.emulateMedia({reducedMotion:'no-preference'});await expect(canvas).toHaveAttribute('data-playing','false')
 await page.getByRole('button',{name:'The constellation',exact:true}).click();await page.getByRole('combobox',{name:'Playback speed'}).selectOption('300');await page.getByRole('button',{name:'Play',exact:true}).click();await advance(page,5000);await expect(canvas).toHaveAttribute('data-time',String(start+1800000));await expect(canvas).toHaveAttribute('data-playing','false')
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Replay reveal'}).click();await expect(canvas).toHaveAttribute('data-shown','647');await expect(canvas).toHaveAttribute('data-playing','false')
})
test('portrait and landscape keep the scene, transport and source inspection usable',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});const canvas=await open(page,true)
 for(const size of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);await expect.poll(async()=>{const box=await canvas.boundingBox();return Boolean(box&&box.height>100&&box.width>300)}).toBe(true)
  for(const name of ['One satellite','One plane','The constellation','Play','Frame Earth']){const button=page.getByRole('button',{name,exact:true});await expect(button).toBeVisible();const box=(await button.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width)}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);await page.screenshot({path:info.outputPath(`constellation-${size.width}.png`)})
  await page.getByRole('button',{name:'Snapshot & sources'}).click();await page.locator('#source-panel').evaluate(p=>p.scrollTop=p.scrollHeight);await expect(page.getByRole('link',{name:'Retained source and numerical audit ↗'})).toBeInViewport();await page.keyboard.press('Escape')
 }
})
test('corrupt releases fail closed and can retry the retained source',async({page})=>{
 await page.route('**/constellation-*.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await page.goto('/how-a-constellation-takes-shape/');await expect(page.locator('html')).toHaveAttribute('data-constellation','error');await expect(page.locator('#chapter-state')).toContainText('integrity');await expect(page.locator('canvas')).toHaveCount(0)
 await page.unroute('**/constellation-*.json');await page.getByRole('button',{name:'Retry snapshot'}).click();await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');await expect(page.locator('canvas')).toHaveCount(1)
})
test('Discover and prefixed assets reach the independent constellation proof',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?explore=discover');await page.getByRole('link',{name:/^How a constellation takes shape/}).click();await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');await expect(page.locator('canvas')).toHaveAttribute('data-shown','647')
 await page.route('**/zenit/**',async route=>{const url=new URL(route.request().url());url.pathname=url.pathname.replace(/^\/zenit/,'');const response=await route.fetch({url:url.toString()});await route.fulfill({response})});await page.goto('/zenit/how-a-constellation-takes-shape/');await expect(page.locator('html')).toHaveAttribute('data-constellation','ready');await expect(page.getByRole('link',{name:'Return to Explore'})).toHaveAttribute('href','../?explore=discover')
})
