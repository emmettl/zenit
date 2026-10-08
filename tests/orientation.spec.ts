import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {PerspectiveCamera,Quaternion,Vector3} from 'three'
import {readCatalogue,skyDirections,horizonReading} from '../src/stellar'
const catalogue=readCatalogue(JSON.parse(readFileSync(new URL('../public/data/stellar/hyg-v44-bright-d874dfa7da5f.json',import.meta.url),'utf8')))
async function checkLabels(page:Page){
  const canvas=page.locator('canvas'),time=Number(await canvas.getAttribute('data-study-time')),viewport=page.viewportSize()!,labels=page.locator('.sky-star-label:visible')
  const count=await labels.count();expect(count).toBeGreaterThan(0);expect(count).toBeLessThanOrEqual(viewport.width<=650?3:4)
  const camera=new PerspectiveCamera(100,viewport.width/viewport.height,.1,2)
  camera.quaternion.copy(new Quaternion(...(await canvas.getAttribute('data-camera-rotation'))!.split(',').map(Number) as [number,number,number,number]));camera.updateMatrixWorld()
  const boxes=[]
  for(const label of await labels.all()){
    const id=await label.getAttribute('data-star-id'),star=catalogue.stars.find(x=>x.id===id)!
    expect(star.name).toBe(await label.textContent());expect(star.mag).toBeLessThanOrEqual(2)
    const ray=skyDirections([star],new Date(time).toISOString())[0],ndc=ray.clone().project(camera)
    expect(horizonReading(ray).altitude).toBeGreaterThan(5)
    expect(Number(await label.getAttribute('data-anchor-x'))).toBeCloseTo((ndc.x+1)*viewport.width/2,2)
    expect(Number(await label.getAttribute('data-anchor-y'))).toBeCloseTo((1-ndc.y)*viewport.height/2,2)
    const box=(await label.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(20);expect(box.x+box.width).toBeLessThan(viewport.width-10);expect(box.y).toBeGreaterThanOrEqual(20);expect(box.y+box.height).toBeLessThan(viewport.height-10)
    for(const other of [...boxes,...await page.locator('.controls:visible,.composition:visible,.stellar-panel:visible,.horizon-compass:visible,.iss-marker:visible').all().then(nodes=>Promise.all(nodes.map(x=>x.boundingBox())))])if(other)expect(box.x+box.width<=other.x||box.x>=other.x+other.width||box.y+box.height<=other.y||box.y>=other.y+other.height).toBe(true)
    boxes.push(box)
  }
  await expect(page.getByRole('region',{name:'Surface sky orientation'})).toHaveAttribute('data-study-time',String(time))
  const heading=horizonReading(new Vector3(0,0,-1).applyQuaternion(camera.quaternion)).azimuth
  expect(Number(await page.locator('.horizon-compass').getAttribute('data-azimuth'))).toBeCloseTo(heading,5)
}

test('surface orientation follows real stars, leaves the ISS clear and respects stars/daylight controls',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/')
  const guides=page.getByRole('region',{name:'Surface sky orientation'}),canvas=page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-orbital-count','616');await expect(guides).toBeHidden()
  await page.getByRole('button',{name:'Watch Sydney pass'}).click();await expect(guides).toBeVisible()
  await expect(page.getByRole('img',{name:/Sydney horizon compass: NW, 312 degrees from true north/})).toBeVisible()
  await page.evaluate(()=>document.fonts.ready);await checkLabels(page)
  await page.screenshot({path:testInfo.outputPath('surface-orientation.png')})
  await page.getByRole('button',{name:'Show panels',exact:true}).click()
  await page.getByRole('checkbox',{name:'Show stars',exact:true}).uncheck();await expect(page.locator('.sky-star-label:visible')).toHaveCount(0)
  await expect(page.locator('.horizon-compass')).toBeVisible()
  await page.getByRole('checkbox',{name:'Show stars',exact:true}).check()
  await page.getByRole('button',{name:'Seek to pass peak'}).click();await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse('2026-10-07T17:58:49Z')))
  await page.getByRole('button',{name:'Hide panels',exact:true}).click();await checkLabels(page)
  await page.getByRole('button',{name:'Show panels',exact:true}).click()
  await page.getByRole('slider',{name:'Study time',exact:true}).press('End');await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse('2026-10-07T23:58:49Z')))
  await expect(page.locator('.sky-star-label:visible')).toHaveCount(0);await expect(page.locator('.horizon-compass')).toBeVisible()
  await page.getByRole('button',{name:'Return to orbit'}).click();await expect(guides).toBeHidden()
})

test('the journey fades orientation at landing and ascent, preserving names and bearings through pause',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/')
  await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible()
  const guides=page.getByRole('region',{name:'Surface sky orientation'})
  await expect(guides).toBeHidden()
  const advance=async(target:number)=>{const elapsed=Number(await page.locator('main').getAttribute('data-journey-elapsed'));await page.clock.fastForward(target-elapsed);await page.clock.runFor(100)}
  await advance(24500);await expect(guides).toBeVisible();const opacity=Number(await guides.evaluate(x=>(x as HTMLElement).style.opacity));expect(opacity).toBeGreaterThan(0);expect(opacity).toBeLessThan(1)
  await advance(37000);await expect(guides).toHaveCSS('opacity','1');await checkLabels(page)
  await page.getByRole('button',{name:'Pause study',exact:true}).click()
  const time=await guides.getAttribute('data-study-time'),names=await page.locator('.sky-star-label:visible').allTextContents()
  await page.clock.runFor(1000);await expect(guides).toHaveAttribute('data-study-time',time!);expect(await page.locator('.sky-star-label:visible').allTextContents()).toEqual(names)
  await page.getByRole('button',{name:'Play study',exact:true}).click();await advance(51700)
  expect(Number(await guides.evaluate(x=>(x as HTMLElement).style.opacity))).toBeLessThan(1)
  await advance(54000);await expect(guides).toBeHidden()
})
