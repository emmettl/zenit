import {test,expect,type Page} from '@playwright/test'
async function goTo(page:Page,target:number){const elapsed=Number(await page.locator('main').getAttribute('data-journey-elapsed'));await page.clock.fastForward(Math.max(1,target-elapsed));await page.clock.runFor(100)}
test('family reveals keep all identities, coherent caption dates and a continuous ISS handoff',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/')
  await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible()
  const canvas=page.locator('canvas'),caption=page.getByRole('region',{name:'Orbital introduction'})
  for(const [elapsed,focus,label] of [[2000,'stations','Stations'],[6000,'gnss','Navigation'],[10000,'geo','Geosynchronous']] as const){
    await goTo(page,elapsed);await expect(page.locator('main')).toHaveAttribute('data-introduction',focus)
    await expect(caption).toContainText(label);await expect(caption).toContainText('median model height');await expect(caption).toContainText('mean period')
    await expect.poll(async()=>Number(await canvas.getAttribute('data-orbital-count'))).toBeGreaterThan(600)
    await expect.poll(async()=>await canvas.getAttribute('data-orbital-count')===await canvas.getAttribute('data-filtered-count')).toBe(true)
    await expect.poll(async()=>await caption.getAttribute('data-caption-time')===await canvas.getAttribute('data-study-time')).toBe(true)
    const weights=JSON.parse((await canvas.getAttribute('data-family-emphasis'))!);expect(weights[focus]).toBe(1)
    const box=(await caption.boundingBox())!,controls=(await page.getByRole('region',{name:'Study and camera controls'}).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize()!.width);expect(box.y+box.height).toBeLessThan(controls.y)
    if(focus==='geo'){await page.evaluate(()=>document.fonts.ready);const path=testInfo.outputPath('geosynchronous-introduction.png');await page.screenshot({path});await testInfo.attach('geosynchronous-introduction',{path,contentType:'image/png'})}
  }
  await goTo(page,14000);await expect(caption).toContainText('NORAD 25544');await expect(page.getByTestId('study-time')).toHaveText('2026-10-07 17:57:19 UTC')
  await expect(page.getByRole('button',{name:'Inspect ISS',exact:true})).toBeVisible();await expect(canvas).toHaveAttribute('data-iss-emphasis','1.000')
  await expect(page.locator('.cinematic-object')).toContainText('NORAD 25544')
  const position=await canvas.getAttribute('data-iss-position')
  await page.getByRole('button',{name:'Pause study',exact:true}).click();await page.clock.fastForward(2000);await expect(canvas).toHaveAttribute('data-iss-position',position!)
  await page.getByRole('button',{name:'Play study',exact:true}).click();await goTo(page,24500)
  await expect(canvas).toHaveAttribute('data-camera-phase','Sydney horizon');await expect(canvas).toHaveAttribute('data-iss-position',position!)
  await expect(page.locator('.cinematic-object')).toContainText('NORAD 25544')
  await goTo(page,37000);await expect(canvas).toHaveAttribute('data-camera-phase','Looking up');await expect(canvas).toHaveAttribute('data-introduction','none')
  await expect(caption).toHaveCount(0);await expect(page.locator('.cinematic-object')).toContainText('NORAD 25544')
})

test('manual exploration clears authored emphasis and leaves the actual pose and dated population intact',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/')
  await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible();await goTo(page,10000)
  await page.getByRole('button',{name:'Pause study',exact:true}).click()
  const canvas=page.locator('canvas'),pose=await canvas.getAttribute('data-camera-position'),time=await canvas.getAttribute('data-study-time'),count=await canvas.getAttribute('data-orbital-count')
  await page.getByRole('button',{name:'Explore freely',exact:true}).click();await page.clock.runFor(100)
  await expect(canvas).toHaveAttribute('data-family-emphasis','none');await expect(canvas).toHaveAttribute('data-camera-position',pose!);await expect(canvas).toHaveAttribute('data-study-time',time!);await expect(canvas).toHaveAttribute('data-orbital-count',count!)
  await expect(page.getByRole('region',{name:'Orbital introduction'})).toHaveCount(0)
  await expect(page.getByRole('checkbox',{name:/Stations/})).toBeChecked();await expect(page.getByRole('checkbox',{name:/Navigation/})).toBeChecked();await expect(page.getByRole('checkbox',{name:/Geosynchronous/})).toBeChecked()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
