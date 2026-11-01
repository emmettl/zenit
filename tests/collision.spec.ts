import {test,expect,type Page} from '@playwright/test'
import {END,PERIOD} from '../src/collision-model'
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
  await advance(page,8300);await expect(page.locator('#stage-title')).toHaveText('Contact. A shared beginning.');await expect(canvas).toHaveAttribute('data-time','0');await expect(canvas).toHaveAttribute('data-count','192');await page.screenshot({path:info.outputPath('contact.png')})
  await advance(page,10000);await expect.poll(async()=>Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(180);await expect(canvas).toHaveAttribute('data-count','192');await page.screenshot({path:info.outputPath('release.png')})
  await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await canvas.getAttribute('data-time');await advance(page,1000);await expect(canvas).toHaveAttribute('data-time',held!)
  await page.getByRole('button',{name:'Play',exact:true}).click();await advance(page,40000);await expect(canvas).toHaveAttribute('data-time',String(END));await expect(canvas).toHaveAttribute('data-playing','false');await page.screenshot({path:info.outputPath('three-orbits.png')});await advance(page,1000);await expect(canvas).toHaveAttribute('data-time',String(END));expect(errors).toEqual([]);expect(external).toEqual([])
})
test('spread, seeking and replay retain one deterministic experiment and explicit model assumptions',async({page})=>{
  const canvas=await open(page,true);await page.getByRole('button',{name:'+1 orbit',exact:true}).click();await expect(canvas).toHaveAttribute('data-time',String(PERIOD));await expect(canvas).toHaveAttribute('data-count','192')
  const time=await canvas.getAttribute('data-time');await page.getByRole('slider',{name:'Fragment release speed'}).fill('100');await expect(canvas).toHaveAttribute('data-spread','100');await expect(canvas).toHaveAttribute('data-time',time!);await expect(canvas).toHaveAttribute('data-playing','false')
  await page.getByRole('button',{name:'The model',exact:true}).click();await expect(page.getByRole('complementary',{name:'Model and assumptions'})).toBeVisible();await expect(page.locator('#period-a')).toContainText('A ·');const wide=await page.locator('#period-a').textContent();await page.getByRole('checkbox',{name:'Show original orbital paths'}).uncheck();await page.getByRole('button',{name:'Close model and assumptions'}).click();await expect(page.getByRole('button',{name:'The model',exact:true})).toBeFocused()
  await page.getByRole('slider',{name:'Fragment release speed'}).fill('10');await page.getByRole('button',{name:'The model',exact:true}).click();expect(await page.locator('#period-a').textContent()).not.toEqual(wide);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Replay encounter'}).click();await expect(canvas).toHaveAttribute('data-time','-30');await expect(canvas).toHaveAttribute('data-spread','10');await expect(canvas).toHaveAttribute('data-playing','false');await expect(canvas).toHaveAttribute('data-count','2')
  await page.getByRole('button',{name:'Release',exact:true}).click();await page.getByRole('slider',{name:'Time from collision'}).fill('600');await expect(canvas).toHaveAttribute('data-time','600');await page.getByRole('slider',{name:'Time from collision'}).fill('-10');await expect(canvas).toHaveAttribute('data-count','2')
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
    for(const name of ['Play','Replay encounter','The model','Frame Earth']){const button=page.getByRole('button',{name,exact:true});await expect(button).toBeInViewport();expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)}
    const rect=await canvas.boundingBox();expect(rect!.height).toBeGreaterThan(100)
    await page.getByRole('button',{name:'+3 orbits',exact:true}).click();await page.screenshot({path:info.outputPath(`phone-${viewport.width}-${viewport.height}.png`)})
    await page.getByRole('button',{name:'The model',exact:true}).click();await expect(page.getByRole('complementary',{name:'Model and assumptions'})).toBeInViewport();await page.getByRole('checkbox',{name:'Show original orbital paths'}).uncheck();await page.getByRole('button',{name:'Close model and assumptions'}).click()
  }
})
