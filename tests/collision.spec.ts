import {test,expect,type Page} from '@playwright/test'
import {createRequire} from 'node:module'
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle')
import {END,PERIOD,guidedCue} from '../src/collision-model'
test.describe.configure({timeout:60000})
async function open(page:Page,reduced=false){
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'})
  await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});await page.clock.pauseAt('2026-11-01T12:00:01Z')
  await page.goto('/how-a-debris-cloud-forms/');await expect(page.locator('html')).toHaveAttribute('data-simulation','ready');return page.locator('canvas')
}
async function advance(page:Page,ms:number){await page.clock.fastForward(ms);await page.clock.runFor(100)}
test('the guided experiment meets, releases, spreads and stops at three orbits',async({page,baseURL},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith(baseURL+'/')&&!r.url().startsWith('data:'))external.push(r.url())})
  const canvas=await open(page);await expect(canvas).toHaveAttribute('data-count','2');await page.screenshot({path:info.outputPath('approach.png')})
  await advance(page,12100);await expect(page.locator('#stage-title')).toHaveText('A fraction of a second.');await expect(canvas).toHaveAttribute('data-time','0');await expect(canvas).toHaveAttribute('data-count','768');await page.screenshot({path:info.outputPath('contact.png')})
  await advance(page,10000);await expect.poll(async()=>Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(5);await expect(canvas).toHaveAttribute('data-count','768');await page.screenshot({path:info.outputPath('release.png')})
  await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await canvas.getAttribute('data-time');await advance(page,1000);await expect(canvas).toHaveAttribute('data-time',held!)
  await page.getByRole('button',{name:'Play',exact:true}).click();await advance(page,60000);await expect(canvas).toHaveAttribute('data-time',String(END));await expect(canvas).toHaveAttribute('data-playing','false');await page.screenshot({path:info.outputPath('three-orbits.png')});await advance(page,1000);await expect(canvas).toHaveAttribute('data-time',String(END));expect(errors).toEqual([]);expect(external).toEqual([])
})
test('spread, seeking and replay retain one deterministic experiment and explicit model assumptions',async({page})=>{
  const canvas=await open(page,true);await page.getByRole('button',{name:'+1 orbit',exact:true}).click();await expect(canvas).toHaveAttribute('data-time',String(PERIOD));await expect(canvas).toHaveAttribute('data-count','768')
  const time=await canvas.getAttribute('data-time');await page.getByRole('slider',{name:'Velocity spread'}).fill('100');await expect(canvas).toHaveAttribute('data-spread','100');await expect(canvas).toHaveAttribute('data-time',time!);await expect(canvas).toHaveAttribute('data-playing','false')
  await page.getByRole('button',{name:'The model',exact:true}).click();await expect(page.getByRole('complementary',{name:'Model and assumptions'})).toBeVisible();await expect(page.locator('#period-a')).toContainText('A ·');const wide=await page.locator('#period-a').textContent();await page.getByRole('checkbox',{name:'Show original orbital paths'}).check();await page.getByRole('button',{name:'Close model and assumptions'}).click();await expect(page.getByRole('button',{name:'The model',exact:true})).toBeFocused()
  await page.getByRole('slider',{name:'Velocity spread'}).fill('10');await page.getByRole('button',{name:'The model',exact:true}).click();expect(await page.locator('#period-a').textContent()).not.toEqual(wide);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Replay encounter'}).click();await expect(canvas).toHaveAttribute('data-time','-30');await expect(canvas).toHaveAttribute('data-spread','10');await expect(canvas).toHaveAttribute('data-playing','false');await expect(canvas).toHaveAttribute('data-count','2')
  await page.getByRole('button',{name:'Release',exact:true}).click();await page.getByRole('slider',{name:'Encounter timeline'}).fill(String(guidedCue(600)));await expect.poll(async()=>Math.round(Number(await canvas.getAttribute('data-time')))).toBe(600);await page.getByRole('slider',{name:'Encounter timeline'}).fill(guidedCue(-10).toFixed(2));await expect(canvas).toHaveAttribute('data-count','2')
})
test('gestures preserve physical time, and motion preference changes pause without automatic restart',async({page})=>{
  const canvas=await open(page);await expect(page.locator('#elapsed')).toHaveAttribute('aria-live','off');await advance(page,3000);await page.getByRole('button',{name:'Pause',exact:true}).click();const time=await canvas.getAttribute('data-time');await canvas.press('ArrowRight');await expect(canvas).toHaveAttribute('data-camera','free');await expect(canvas).toHaveAttribute('data-time',time!);await canvas.press('Control+Space');await expect(canvas).toHaveAttribute('data-playing','false');await page.getByRole('button',{name:'Frame Earth'}).click();await expect(canvas).toHaveAttribute('data-time',time!)
  await page.getByRole('button',{name:'Play',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await expect(canvas).toHaveAttribute('data-playing','false');await page.emulateMedia({reducedMotion:'no-preference'});await advance(page,1000);await expect(canvas).toHaveAttribute('data-playing','false');await canvas.press('Space');await expect(canvas).toHaveAttribute('data-playing','true');await canvas.press('Space');await expect(canvas).toHaveAttribute('data-playing','false')
})
test('the separate simulation is discoverable and its assets work under the zenit prefix',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?explore=discover');await page.getByRole('link',{name:/^How a debris cloud forms/}).click();await expect(page.locator('html')).toHaveAttribute('data-simulation','ready');await page.getByRole('link',{name:'The catalogued aftermath ↗'}).click();await expect(page.locator('html')).toHaveAttribute('data-chapter','ready')
  await page.route('**/zenit/**',async route=>{const url=new URL(route.request().url());url.pathname=url.pathname.replace(/^\/zenit/,'');const response=await route.fetch({url:url.toString()});await route.fulfill({response})});await page.goto('/zenit/how-a-debris-cloud-forms/');await expect(page.locator('html')).toHaveAttribute('data-simulation','ready');await expect(page.getByRole('link',{name:'Return to Explore'})).toHaveAttribute('href','../?explore=discover')
})
test('phone orientations keep the scene and controls usable and the model scrollable',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const canvas=await open(page,true)
  for(const viewport of [{width:390,height:844},{width:390,height:667},{width:667,height:320}]){
    await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    for(const name of ['Play','Replay encounter','The model','Frame Earth','Follow cloud']){const button=page.getByRole('button',{name,exact:true});await expect(button).toBeInViewport();expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)}
    const rect=await canvas.boundingBox();expect(rect!.height).toBeGreaterThan(100)
    await page.getByRole('button',{name:'Approach',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}-approach.png`)});await page.getByRole('button',{name:'Young cloud',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}-cloud.png`)});await page.getByRole('button',{name:'+3 orbits',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}.png`)})
    await page.getByRole('button',{name:'The model',exact:true}).click();await expect(page.getByRole('complementary',{name:'Model and assumptions'})).toBeInViewport();await page.getByRole('checkbox',{name:'Show original orbital paths'}).check();await page.getByRole('button',{name:'Close model and assumptions'}).click()
  }
})

test('the young cloud has a filled raster footprint and can be followed independently of the orbital reveal',async({page},info)=>{
  const canvas=await open(page,true)
  await page.getByRole('button',{name:'Young cloud',exact:true}).click()
  await expect(canvas).toHaveAttribute('data-time','60');await expect(canvas).toHaveAttribute('data-reveal','0')
  await expect(page.locator('#view-title')).toHaveText('TRAVELLING WITH CLOUD A')
  const png=PNG.sync.read(await canvas.screenshot()),box=await canvas.boundingBox(),centreX=png.width*(box!.width>800?.66:.5),centreY=png.height*.5,radius=Math.min(png.width,png.height)*.38
  let bright=0;const rows=new Set<number>(),cols=new Set<number>()
  for(let y=Math.max(0,Math.floor(centreY-radius));y<Math.min(png.height,centreY+radius);y++)for(let x=Math.max(0,Math.floor(centreX-radius));x<Math.min(png.width,centreX+radius);x++){
    const i=(y*png.width+x)*4,r=png.data[i],g=png.data[i+1],b=png.data[i+2]
    if(g>140&&b>g*1.02&&g>r*1.15){bright++;rows.add(Math.floor((y-centreY+radius)/(radius*2)*12));cols.add(Math.floor((x-centreX+radius)/(radius*2)*12))}
  }
  expect(bright).toBeGreaterThan(200);expect(rows.size).toBeGreaterThanOrEqual(6);expect(cols.size).toBeGreaterThanOrEqual(6)
  await page.screenshot({path:info.outputPath('young-cloud.png')})
  await page.getByRole('button',{name:'+3 orbits',exact:true}).click();await expect(canvas).toHaveAttribute('data-reveal','1')
  await page.getByRole('button',{name:'Follow cloud',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera','cloud');await expect(canvas).toHaveAttribute('data-reveal','0');await expect(canvas).toHaveAttribute('data-time',String(END))
  await page.getByRole('button',{name:'Frame Earth',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera','free');await expect(canvas).toHaveAttribute('data-time',String(END))
})
