import {test,expect,type Page} from '@playwright/test'
import {Vector3,Quaternion} from 'three'
test.describe.configure({timeout:60000})
async function start(page:Page){await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/');await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible({timeout:15000})}
async function advance(page:Page,target:number){const elapsed=Number(await page.locator('main').getAttribute('data-journey-elapsed'));await page.clock.fastForward(Math.max(1,target-elapsed));await page.clock.runFor(100)}
test('the opening frames each family, centres ISS and enters descent continuously at the held UTC',async({page},info)=>{
  await start(page);const canvas=page.locator('canvas'),size=page.viewportSize()!,fit=Math.max(1,size.height/size.width)
  for(const [elapsed,focus,radius] of [[2000,'stations',4.2],[6000,'gnss',14],[10000,'geo',24],[15500,'iss',3.5]] as const){
    await advance(page,elapsed);await expect(canvas).toHaveAttribute('data-opening-camera',focus);expect(Number(await canvas.getAttribute('data-camera-radius'))).toBeCloseTo(radius*fit,6)
    await expect.poll(async()=>Number(await canvas.getAttribute('data-orbital-count'))).toBeGreaterThan(600);await expect.poll(async()=>await canvas.getAttribute('data-orbital-count')===await canvas.getAttribute('data-filtered-count')).toBe(true)
    await page.screenshot({path:info.outputPath('opening-'+focus+'.png'),animations:'disabled'})
  }
  const position=new Vector3(...(await canvas.getAttribute('data-camera-position'))!.split(',').map(Number) as [number,number,number]),iss=new Vector3(...(await canvas.getAttribute('data-iss-position'))!.split(',').map(Number) as [number,number,number]),rotation=new Quaternion(...(await canvas.getAttribute('data-camera-rotation'))!.split(',').map(Number) as [number,number,number,number])
  expect(new Vector3(0,0,-1).applyQuaternion(rotation).dot(iss.sub(position).normalize())).toBeCloseTo(1,7);await expect(page.getByRole('button',{name:'Inspect ISS',exact:true})).toBeVisible();await expect(page.getByTestId('study-time')).toHaveText('2026-10-07 17:57:19 UTC')
  await advance(page,16200);await expect(canvas).toHaveAttribute('data-camera-phase','Approaching Sydney');const next=new Vector3(...(await canvas.getAttribute('data-camera-position'))!.split(',').map(Number) as [number,number,number]);expect(next.distanceTo(position)).toBeLessThan(.2);await expect(page.getByTestId('study-time')).toHaveText('2026-10-07 17:57:19 UTC')
})
test('manual handover during ISS approach preserves the camera and returns to it after surface exploration',async({page})=>{
  await start(page);await advance(page,13500);await page.keyboard.press('Space');const canvas=page.locator('canvas'),pose=await canvas.getAttribute('data-camera-position'),rotation=await canvas.getAttribute('data-camera-rotation'),time=await canvas.getAttribute('data-study-time')
  await page.getByRole('button',{name:'Explore freely',exact:true}).click();await expect(canvas).toHaveAttribute('data-opening-camera','none');await expect(canvas).toHaveAttribute('data-camera-position',pose!);await expect(canvas).toHaveAttribute('data-camera-rotation',rotation!);await expect(canvas).toHaveAttribute('data-study-time',time!)
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Descend to surface',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera-phase','Looking up');await page.getByRole('button',{name:'Return to orbit',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera-position',pose!);await expect(canvas).toHaveAttribute('data-camera-rotation',rotation!)
  await canvas.press('ArrowRight');await expect(canvas).not.toHaveAttribute('data-camera-position',pose!);await expect(canvas).toHaveAttribute('data-study-time',time!)
})

test('the first camera key during the opening turns the current near-Earth view without a distance reset',async({page})=>{
  await start(page);await advance(page,2000);const canvas=page.locator('canvas'),pose=await canvas.getAttribute('data-camera-position'),radius=await canvas.getAttribute('data-camera-radius')
  await canvas.press('ArrowRight');await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Exploring');await expect(canvas).toHaveAttribute('data-opening-camera','none');await expect(canvas).not.toHaveAttribute('data-camera-position',pose!);expect(Number(await canvas.getAttribute('data-camera-radius'))).toBeCloseTo(Number(radius),8)
})
