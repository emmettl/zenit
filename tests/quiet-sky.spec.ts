import {test,expect,type Page} from '@playwright/test'
async function advance(page:Page,target:number){const elapsed=Number(await page.locator('main').getAttribute('data-journey-elapsed'));await page.clock.fastForward(Math.max(1,target-elapsed));await page.clock.runFor(100)}
async function journey(page:Page){await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/');await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible({timeout:15000})}
async function quiet(page:Page){await journey(page);await advance(page,37000);await expect(page.locator('main')).toHaveAttribute('data-interface','quiet');await expect(page.locator('canvas')).toHaveAttribute('data-camera-phase','Looking up')}

test('surface autoplay fades the interface after landing; one native tap reveals it without selecting or moving the camera',async({page,isMobile},info)=>{
  await journey(page);await advance(page,28500);await expect(page.locator('main')).toHaveAttribute('data-interface','visible')
  await advance(page,37000);const main=page.locator('main'),canvas=page.locator('canvas');await expect(main).toHaveAttribute('data-interface','quiet')
  await expect(page.locator('header')).toHaveAttribute('inert','');await expect(page.locator('.controls')).toHaveAttribute('aria-hidden','true');await expect(page.locator('.scene')).toHaveAttribute('inert','')
  await expect(page.getByRole('button',{name:'Pause study',exact:true})).toHaveCount(1);await expect(page.locator('.quiet-pause')).toBeVisible();const pause=await page.locator('.quiet-pause').boundingBox();expect(pause!.height).toBeGreaterThanOrEqual(44)
  await expect(canvas).toHaveAttribute('data-star-count','5070');await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-surface-trails'))!).length).toBeGreaterThan(0)
  await page.screenshot({path:info.outputPath('quiet-sky.png'),animations:'disabled'})
  const rotation=await canvas.getAttribute('data-camera-rotation'),pose=await canvas.getAttribute('data-camera-position'),time=await canvas.getAttribute('data-study-time'),elapsed=await main.getAttribute('data-journey-elapsed'),size=page.viewportSize()!
  if(isMobile)await page.touchscreen.tap(size.width*.5,size.height*.35);else await page.mouse.click(size.width*.5,size.height*.35)
  await expect(main).toHaveAttribute('data-interface','visible');await expect(main).toHaveAttribute('data-journey-phase','The sky above Sydney');await expect(main).toHaveAttribute('data-journey-elapsed',elapsed!);await expect(canvas).toHaveAttribute('data-camera-position',pose!);await expect(canvas).toHaveAttribute('data-camera-rotation',rotation!);await expect(canvas).toHaveAttribute('data-study-time',time!)
  await expect(page.locator('.cinematic-object')).toContainText('NORAD 25544');await expect(page.getByRole('region',{name:'Object catalogue'})).toBeHidden();await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible()
  await page.clock.runFor(4500);await expect(main).toHaveAttribute('data-interface','quiet')
  await page.getByRole('button',{name:'Pause study',exact:true}).click();await expect(main).toHaveAttribute('data-interface','visible');await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeFocused()
  const held=await main.getAttribute('data-journey-elapsed');await page.clock.runFor(100);await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse('2026-10-07T17:57:19Z')+(Number(held)-28000)*10));const paused=await canvas.getAttribute('data-study-time');await page.clock.runFor(2000);await expect(main).toHaveAttribute('data-journey-elapsed',held!);await expect(canvas).toHaveAttribute('data-study-time',paused!)
})

test('keyboard reveal retains controls while focused and loop/ascent restore the authored interface',async({page})=>{
  await quiet(page);await page.getByRole('button',{name:'Show controls',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(page.locator('main')).toHaveAttribute('data-interface','visible');await expect(page.getByRole('button',{name:'Pause study',exact:true})).toBeFocused()
  await page.clock.runFor(4500);await expect(page.locator('main')).toHaveAttribute('data-interface','visible')
  await page.locator('canvas').focus();await page.clock.runFor(100);await expect(page.locator('main')).toHaveAttribute('data-interface','quiet')
  await page.keyboard.press('Escape');await expect(page.locator('main')).toHaveAttribute('data-interface','visible');await expect(page.getByRole('button',{name:'Pause study',exact:true})).toBeFocused()
  await page.locator('canvas').focus();await page.clock.runFor(4500);await expect(page.locator('main')).toHaveAttribute('data-interface','quiet')
  await advance(page,49500);await expect(page.locator('main')).toHaveAttribute('data-interface','visible');await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Returning to orbit')
  await advance(page,61500);await expect(page.locator('main')).toHaveAttribute('data-interface','visible');await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Orbital shells')
})

test('quiet pointer drags and cancellations do not select objects; manual exploration keeps the interface visible',async({page})=>{
  await quiet(page);const size=page.viewportSize()!,canvas=page.locator('canvas'),rotation=await canvas.getAttribute('data-camera-rotation')
  await page.mouse.move(size.width*.7,size.height*.3);await page.mouse.down();await page.mouse.move(size.width*.4,size.height*.35,{steps:5});await page.mouse.up();await expect(page.locator('main')).toHaveAttribute('data-interface','quiet');await expect(canvas).toHaveAttribute('data-camera-rotation',rotation!)
  await page.mouse.move(size.width*.5,size.height*.3);await page.mouse.down();await page.locator('.quiet-reveal').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});await page.mouse.up();await expect(page.locator('main')).toHaveAttribute('data-interface','quiet');await page.getByRole('button',{name:'Show controls',exact:true}).press('Enter');await page.getByRole('button',{name:'Explore freely',exact:true}).click()
  await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Exploring');await expect(page.getByRole('region',{name:'Object catalogue'})).toBeVisible();await page.clock.runFor(6000);await expect(page.locator('main')).toHaveAttribute('data-interface','visible')
})

test('reduced motion and hidden-tab pause restore accessible controls instead of leaving a quiet scene',async({page})=>{
  await quiet(page);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('main')).toHaveAttribute('data-interface','visible');await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeVisible();await page.clock.runFor(5000);await expect(page.locator('main')).toHaveAttribute('data-interface','visible')
  await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Replay journey',exact:true}).click();await page.locator('canvas').focus();await advance(page,37000);await expect(page.locator('main')).toHaveAttribute('data-interface','quiet')
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await expect(page.locator('main')).toHaveAttribute('data-interface','visible');await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeVisible()
})
