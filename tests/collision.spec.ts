import {test,expect,type Page,type Locator} from '@playwright/test'
import {createRequire} from 'node:module'
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle')
import {END,PERIOD,guidedCue,SECONDARY_TIME,experiment,alive} from '../src/collision-model'
test.describe.configure({timeout:60000})
async function open(page:Page,reduced=false){
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'})
  await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});await page.clock.pauseAt('2026-11-01T12:00:01Z')
  await page.goto('/how-a-debris-cloud-forms/');await expect(page.locator('html')).toHaveAttribute('data-simulation','ready');return page.locator('canvas')
}
async function atTime(canvas:Locator,time:number){await expect.poll(async()=>Math.abs(Number(await canvas.getAttribute('data-time'))-time)).toBeLessThan(.00001)}
async function advance(page:Page,ms:number){await page.clock.fastForward(ms);await page.clock.runFor(100)}
test('the guided experiment meets, releases, spreads and stops at five hundred orbits',async({page,baseURL},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith(baseURL+'/')&&!r.url().startsWith('data:'))external.push(r.url())})
  const canvas=await open(page);await expect(canvas).toHaveAttribute('data-count','2');await page.screenshot({path:info.outputPath('approach.png')})
  await advance(page,12100);expect(Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(0);expect(Number(await canvas.getAttribute('data-time'))).toBeLessThan(.1);await expect(canvas).toHaveAttribute('data-count','768');await page.screenshot({path:info.outputPath('contact.png')})
  await advance(page,10000);await expect.poll(async()=>Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(5);await expect(canvas).toHaveAttribute('data-count','768');await page.screenshot({path:info.outputPath('release.png')})
  await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await canvas.getAttribute('data-time');await advance(page,1000);await expect(canvas).toHaveAttribute('data-time',held!)
  await page.getByRole('button',{name:'Play',exact:true}).click();await advance(page,200000);await atTime(canvas,END);await expect(canvas).toHaveAttribute('data-playing','false');await page.screenshot({path:info.outputPath('five-hundred-orbits.png')});await advance(page,1000);await atTime(canvas,END);expect(errors).toEqual([]);expect(external).toEqual([])
})
test('spread, seeking and replay retain one deterministic experiment and explicit model assumptions',async({page})=>{
  const canvas=await open(page,true);await page.getByRole('button',{name:'+10 orbits',exact:true}).click();await atTime(canvas,10*PERIOD);await expect(canvas).toHaveAttribute('data-count',String(experiment(600).samples.filter(s=>alive(s,10*PERIOD)).length))
  const time=await canvas.getAttribute('data-time');await page.getByRole('slider',{name:'Velocity spread'}).fill('100');await expect(canvas).toHaveAttribute('data-spread','100');await expect(canvas).toHaveAttribute('data-time',time!);await expect(canvas).toHaveAttribute('data-playing','false')
  await page.getByRole('button',{name:'Orbits & model',exact:true}).click();await expect(page.getByRole('complementary',{name:'Model and assumptions'})).toBeVisible();await expect(page.locator('#period-a')).toContainText('A ·');const wide=await page.locator('#period-a').textContent();await page.getByRole('checkbox',{name:'Show original orbital paths'}).check();await page.getByRole('button',{name:'Close model and assumptions'}).click();await expect(page.getByRole('button',{name:'Orbits & model',exact:true})).toBeFocused()
  await page.getByRole('slider',{name:'Velocity spread'}).fill('50');await page.getByRole('button',{name:'Orbits & model',exact:true}).click();expect(await page.locator('#period-a').textContent()).not.toEqual(wide);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Replay encounter'}).click();await expect(canvas).toHaveAttribute('data-time','-30');await expect(canvas).toHaveAttribute('data-spread','50');await expect(canvas).toHaveAttribute('data-playing','false');await expect(canvas).toHaveAttribute('data-count','2')
  await page.getByRole('slider',{name:'Encounter timeline'}).fill('12');await page.getByRole('slider',{name:'Encounter timeline'}).fill(String(guidedCue(600)));await expect.poll(async()=>Math.round(Number(await canvas.getAttribute('data-time')))).toBe(600);await page.getByRole('slider',{name:'Encounter timeline'}).fill(guidedCue(-10).toFixed(2));await expect(canvas).toHaveAttribute('data-count','2')
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
    for(const name of ['Play','Replay encounter','Orbits & model','Frame Earth','Follow cloud']){const button=page.getByRole('button',{name,exact:true});await expect(button).toBeInViewport();expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)}
    const rect=await canvas.boundingBox();expect(rect!.height).toBeGreaterThan(100)
    await page.getByRole('button',{name:'Approach',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}-approach.png`)});await page.getByRole('button',{name:'Young cloud',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}-cloud.png`)});await page.getByRole('button',{name:'+500 orbits',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}.png`)})
    await page.getByRole('button',{name:'Orbits & model',exact:true}).click();await expect(page.getByRole('complementary',{name:'Model and assumptions'})).toBeInViewport();await page.getByRole('checkbox',{name:'Show original orbital paths'}).check();await page.getByRole('button',{name:'Close model and assumptions'}).click()
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
  await page.getByRole('button',{name:'+500 orbits',exact:true}).click();await expect(canvas).toHaveAttribute('data-reveal','1')
  await page.getByRole('button',{name:'Follow cloud',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera','cloud');await expect(canvas).toHaveAttribute('data-reveal','0');await atTime(canvas,END)
  await page.getByRole('button',{name:'Frame Earth',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera','free');await atTime(canvas,END)
})

test('the long clock exposes J2 divergence, orbit-speed playback and a linked perigee/apogee diagram',async({page},info)=>{
  const canvas=await open(page,true)
  await page.getByRole('button',{name:'+500 orbits',exact:true}).click();await atTime(canvas,END);await expect(page.locator('#elapsed')).toContainText('35d')
  await expect(page.locator('#orbit-count')).toHaveText('500 ORIGINAL ORBITS');await expect(canvas).toHaveAttribute('data-j2','true')
  await page.getByRole('button',{name:'Orbits & model',exact:true}).click();await expect(page.getByRole('img',{name:'Synthetic perigee and apogee against orbital period'})).toBeVisible();await expect(page.locator('.spread-summary')).toContainText('120 km')
  await page.screenshot({path:info.outputPath('gabbard.png')});await page.getByRole('checkbox',{name:'Include Earth’s J₂ precession'}).uncheck();await expect(canvas).toHaveAttribute('data-j2','false');await atTime(canvas,END);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'+10 orbits',exact:true}).click();await page.getByRole('combobox',{name:'Playback pace',exact:true}).selectOption('orbit-1');await page.getByRole('button',{name:'Play',exact:true}).click();await advance(page,1000)
  const time=Number(await canvas.getAttribute('data-time'));expect(time).toBeGreaterThan(10.9*PERIOD);expect(time).toBeLessThan(11.3*PERIOD)
})
test('a controlled secondary collision consumes both participants and propagates a new family over the remaining orbits',async({page},info)=>{
  const canvas=await open(page,true);await page.getByRole('button',{name:'Secondary',exact:true}).click();await expect(canvas).toHaveAttribute('data-secondary','true');await atTime(canvas,SECONDARY_TIME-30);await expect(page.locator('#stage-title')).toHaveText('One fragment. Another body.')
  await page.getByRole('button',{name:'Play',exact:true}).click();await advance(page,9200);await expect(canvas).toHaveAttribute('data-secondary-born','true');expect(Math.abs(Number(await canvas.getAttribute('data-time'))-SECONDARY_TIME)).toBeLessThan(1)
  await page.screenshot({path:info.outputPath('secondary-contact.png')});await advance(page,17000);await expect(page.locator('#view-title')).toHaveText('TRAVELLING WITH CLOUD C');await page.screenshot({path:info.outputPath('secondary-cloud.png')})
  await page.getByRole('button',{name:'+500 orbits',exact:true}).click();const on=Number(await canvas.getAttribute('data-count'));await atTime(canvas,END);await page.screenshot({path:info.outputPath('secondary-500.png')})
  await page.getByRole('button',{name:'Orbits & model',exact:true}).click();await expect(page.locator('#secondary-readings')).toContainText('J/g');await expect(page.locator('.spread-summary')).toContainText('new C family');await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Secondary',exact:true}).click();await expect(canvas).toHaveAttribute('data-secondary','false');expect(Number(await canvas.getAttribute('data-count'))).toBeLessThan(on);await atTime(canvas,END)
})

test('both impacts keep advancing on rendered frames without compiling shaders at first release',async({page})=>{
  await page.addInitScript(()=>{
    const state=window as unknown as {collisionShaderCompiles:number};state.collisionShaderCompiles=0
    const original=WebGL2RenderingContext.prototype.compileShader
    WebGL2RenderingContext.prototype.compileShader=function(this:WebGL2RenderingContext,shader:WebGLShader){state.collisionShaderCompiles++;original.call(this,shader)}
  })
  const canvas=await open(page,true)
  const count=()=>page.evaluate(()=>(window as unknown as {collisionShaderCompiles:number}).collisionShaderCompiles)
  const warmed=await count();expect(warmed).toBeGreaterThan(0)
  for(const secondary of [false,true]){
    if(secondary)await page.getByRole('button',{name:'Secondary',exact:true}).click()
    const cue=secondary?87:12,impact=secondary?SECONDARY_TIME:0
    await page.getByRole('slider',{name:'Encounter timeline'}).fill((cue-.15).toFixed(2))
    await page.getByRole('button',{name:'Play',exact:true}).click()
    let previous=Number(await canvas.getAttribute('data-time'));expect(previous).toBeLessThan(impact)
    for(let frame=0;frame<24;frame++){
      await page.clock.runFor(32)
      const next=Number(await canvas.getAttribute('data-time'));expect(next).toBeGreaterThan(previous);previous=next
      await expect(canvas).toHaveAttribute('data-playing','true')
    }
    expect(previous).toBeGreaterThan(impact);expect(await count()).toBe(warmed)
    await page.getByRole('button',{name:'Pause',exact:true}).click()
  }
})
