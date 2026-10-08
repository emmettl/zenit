import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {PerspectiveCamera,Quaternion,Vector3} from 'three'
import {readCatalogue,skyDirections,horizonReading} from '../src/stellar'
const catalogue=readCatalogue(JSON.parse(readFileSync(new URL('../public/data/stellar/hyg-v44-bright-d874dfa7da5f.json',import.meta.url),'utf8')))
const cameraRotation=async(page:Page)=>new Quaternion(...(await page.locator('canvas').getAttribute('data-camera-rotation'))!.split(',').map(Number) as [number,number,number,number])
async function surface(page:Page){await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('canvas')).toHaveAttribute('data-orbital-count','616');await page.getByRole('button',{name:'Descend to surface',exact:true}).click();await expect(page.locator('canvas')).toHaveAttribute('data-camera-phase','Looking up')}
async function checkAnchors(page:Page){
  const canvas=page.locator('canvas'),size=page.viewportSize()!,time=Number(await canvas.getAttribute('data-study-time')),camera=new PerspectiveCamera(100,size.width/size.height,.1,2)
  camera.quaternion.copy(await cameraRotation(page));camera.updateMatrixWorld()
  const heading=horizonReading(new Vector3(0,0,-1).applyQuaternion(camera.quaternion)).azimuth
  expect(Number(await page.locator('.horizon-compass').getAttribute('data-azimuth'))).toBeCloseTo(heading,5)
  for(const label of await page.locator('.sky-star-label:visible').all()){
    const id=await label.getAttribute('data-star-id'),star=catalogue.stars.find(x=>x.id===id)!,ray=skyDirections([star],new Date(time).toISOString())[0],ndc=ray.clone().project(camera)
    expect(horizonReading(ray).altitude).toBeGreaterThan(5)
    expect(Number(await label.getAttribute('data-anchor-x'))).toBeCloseTo((ndc.x+1)*size.width/2,2);expect(Number(await label.getAttribute('data-anchor-y'))).toBeCloseTo((1-ndc.y)*size.height/2,2)
  }
}

test('surface drag and keyboard turn the sky, labels and compass; recenter and return preserve the clock and orbital pose',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/')
  const canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-orbital-count','616')
  await canvas.press('ArrowRight');await canvas.press('+');const orbit=await canvas.getAttribute('data-camera-position')
  await page.getByRole('button',{name:'Descend to surface',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera-phase','Looking up')
  const site=await canvas.getAttribute('data-camera-position'),rotation=await canvas.getAttribute('data-camera-rotation'),time=await canvas.getAttribute('data-study-time'),iss=await canvas.getAttribute('data-iss-position'),size=page.viewportSize()!
  await page.mouse.move(size.width*.7,size.height*.32);await page.mouse.down();await page.mouse.move(size.width*.4,size.height*.36,{steps:8});await page.mouse.up()
  await expect(canvas).toHaveAttribute('data-sky-view','free');await expect(canvas).not.toHaveAttribute('data-camera-rotation',rotation!);await expect(canvas).toHaveAttribute('data-camera-position',site!);await expect(canvas).toHaveAttribute('data-study-time',time!);await expect(canvas).toHaveAttribute('data-iss-position',iss!)
  await expect(page.getByRole('region',{name:'Object catalogue'})).toBeHidden()
  await checkAnchors(page);await page.screenshot({path:testInfo.outputPath('exploring-sky.png')})
  for(let i=0;i<40;i++)await canvas.press('ArrowUp')
  expect(horizonReading(new Vector3(0,0,-1).applyQuaternion(await cameraRotation(page))).altitude).toBeCloseTo(85,5)
  for(let i=0;i<40;i++)await canvas.press('ArrowDown')
  expect(horizonReading(new Vector3(0,0,-1).applyQuaternion(await cameraRotation(page))).altitude).toBeCloseTo(-10,5)
  await page.getByRole('button',{name:'Re-centre on ISS',exact:true}).click()
  const forward=new Vector3(0,0,-1).applyQuaternion(await cameraRotation(page)),toward=new Vector3(...iss!.split(',').map(Number) as [number,number,number]).sub(new Vector3(...site!.split(',').map(Number) as [number,number,number])).normalize()
  expect(forward.dot(toward)).toBeCloseTo(1,7);await expect(canvas).toHaveAttribute('data-study-time',time!)
  const centred=await canvas.getAttribute('data-camera-rotation');await canvas.press('ArrowRight');await canvas.press('Home');await expect(canvas).toHaveAttribute('data-camera-rotation',centred!)
  await expect(page.getByRole('button',{name:'Inspect ISS',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Return to orbit',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera-position',orbit!);await expect(canvas).toHaveAttribute('data-sky-view','composed');await expect(canvas).toHaveAttribute('data-study-time',time!)
})

test('pointer cancellation avoids selection, surface recenter respects family filters, and native touch taps still inspect stars',async({page,browserName,isMobile})=>{
  await surface(page);const canvas=page.locator('canvas'),time=await canvas.getAttribute('data-study-time'),rotation=await canvas.getAttribute('data-camera-rotation'),size=page.viewportSize()!
  if(browserName==='chromium'){
    const input=await page.context().newCDPSession(page);await input.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1})
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:size.width*.6,y:size.height*.3}]})
    await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:size.width*.4,y:size.height*.34}]})
    await input.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await input.detach()
  }else{
    // WebKit's public Playwright API supports native mouse drags and touch taps.
    await page.mouse.move(size.width*.7,size.height*.32);await page.mouse.down();await page.mouse.move(size.width*.4,size.height*.36,{steps:5});await canvas.dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});await page.mouse.up()
  }
  await expect(canvas).not.toHaveAttribute('data-camera-rotation',rotation!);await expect(canvas).toHaveAttribute('data-study-time',time!)
  await expect(page.locator('.cinematic-object')).toContainText('NORAD 25544')
  if(isMobile){
    const label=page.locator('.sky-star-label:visible').first();await expect(label).toBeVisible();const id=await label.getAttribute('data-star-id')
    await page.touchscreen.tap(Number(await label.getAttribute('data-anchor-x')),Number(await label.getAttribute('data-anchor-y')))
    await page.getByRole('button',{name:'Show panels',exact:true}).click();await expect(page.getByLabel('Named star',{exact:true})).toHaveValue(id!)
  }else await page.getByRole('button',{name:'Show panels',exact:true}).click()
  await page.getByRole('checkbox',{name:/Stations/}).uncheck();await expect(page.getByRole('button',{name:'Re-centre on ISS',exact:true})).toBeDisabled()
  const before=await canvas.getAttribute('data-camera-rotation');await canvas.press('Home');await expect(canvas).toHaveAttribute('data-camera-rotation',before!)
  await page.getByRole('checkbox',{name:/Stations/}).check();await page.getByRole('button',{name:'Re-centre on ISS',exact:true}).click()
  await expect(page.getByRole('article',{name:'Selected satellite'})).toContainText('NORAD 25544');await expect(canvas).toHaveAttribute('data-study-time',time!)
})

test('a surface gesture pauses the journey in the same pose and dated sky without opening panels; replay clears custom aim',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/')
  await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible();const elapsed=Number(await page.locator('main').getAttribute('data-journey-elapsed'));await page.clock.fastForward(37000-elapsed);await page.clock.runFor(100)
  const canvas=page.locator('canvas'),requested=Date.parse('2026-10-07T17:57:19Z')+(Number(await page.locator('main').getAttribute('data-journey-elapsed'))-28000)*10
  // A frozen fake clock may stop just before the 33 ms sampling timer.
  // Handover preserves the accepted scene, which can be one sample behind the request.
  await expect.poll(async()=>requested-Number(await canvas.getAttribute('data-study-time'))).toBeLessThanOrEqual(330)
  expect(Number(await canvas.getAttribute('data-study-time'))).toBeLessThanOrEqual(requested)
  const time=await canvas.getAttribute('data-study-time'),site=await canvas.getAttribute('data-camera-position'),size=page.viewportSize()!
  await page.mouse.move(size.width*.6,size.height*.32);await page.mouse.down();await page.mouse.move(size.width*.5,size.height*.36,{steps:5});await page.mouse.up()
  await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Exploring');await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Object catalogue'})).toBeHidden();await expect(canvas).toHaveAttribute('data-study-time',time!);await expect(canvas).toHaveAttribute('data-camera-position',site!)
  const rotation=await canvas.getAttribute('data-camera-rotation');await page.clock.runFor(1000);await expect(canvas).toHaveAttribute('data-camera-rotation',rotation!);await expect(canvas).toHaveAttribute('data-study-time',time!)
  await page.getByRole('button',{name:'Replay journey',exact:true}).click();await page.clock.runFor(100)
  await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Orbital shells');await expect(canvas).toHaveAttribute('data-sky-view','composed')
})
