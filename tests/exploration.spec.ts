import {test,expect} from '@playwright/test'

test('exploration opens from the journey and family views preserve UTC and independent identities',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install({time:new Date('2026-10-08T12:00:00Z')});await page.clock.pauseAt('2026-10-08T12:00:01Z');await page.goto('/')
  await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible({timeout:15000})
  const canvas=page.locator('canvas'),time=await canvas.getAttribute('data-study-time')
  await page.getByRole('button',{name:'Explore',exact:true}).click();await expect(page.getByRole('region',{name:'Explore ZENIT'})).toBeVisible();await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeVisible()
  for(const [name,radius] of [['Close to Earth',4.2],['Navigation shells',14],['The distant ring',24]] as const){
    await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:new RegExp('^'+name)}).click();await expect(canvas).toHaveAttribute('data-camera-phase','Orbit');await expect(canvas).toHaveAttribute('data-study-time',time!);await expect.poll(async()=>Number(await canvas.getAttribute('data-filtered-count'))).toBeGreaterThan(0)
    const fit=name==='Close to Earth'?1:Math.max(1,page.viewportSize()!.height/page.viewportSize()!.width);expect(Number(await canvas.getAttribute('data-camera-radius'))).toBeCloseTo(radius*fit,6)
  }
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'See all families together'}).click();await expect.poll(async()=>await canvas.getAttribute('data-filtered-count')===await canvas.getAttribute('data-orbital-count')).toBe(true)
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Inspect records',exact:true}).click();await expect(page.getByRole('region',{name:'Object catalogue'})).toBeVisible();await page.getByRole('button',{name:'Explore',exact:true}).click();await expect(page.getByRole('region',{name:'Object catalogue'})).toBeHidden()
  await page.getByRole('button',{name:'Journey',exact:true}).click();await expect(page.getByRole('region',{name:'Explore ZENIT'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Explore freely',exact:true})).toBeVisible()
})

test('sky exploration changes place at fixed UTC and meets a retained pass without starting a journey',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.getByRole('button',{name:'Watch Sydney pass'})).toBeEnabled();await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Your sky',exact:true}).click()
  const canvas=page.locator('canvas'),time=await canvas.getAttribute('data-study-time');await page.getByRole('region',{name:'Explore ZENIT'}).getByLabel('Observing place',{exact:true}).selectOption('zurich');await page.getByRole('button',{name:/^Look around Zurich/}).click();await expect(canvas).toHaveAttribute('data-camera-phase','Looking up');await expect(canvas).toHaveAttribute('data-study-time',time!);await expect(canvas).toHaveAttribute('data-observer-name','Zurich')
  await page.getByRole('button',{name:'Browse exploration',exact:true}).click();const meet=page.getByRole('button',{name:/^Meet .* above Zurich/});await expect(meet).toBeEnabled();await meet.click();await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeVisible();await expect(page.locator('main')).toHaveAttribute('data-journey-phase','Exploring');await expect(canvas).not.toHaveAttribute('data-study-time',time!)
  await page.getByRole('button',{name:'Browse exploration',exact:true}).click();await page.getByRole('region',{name:'Explore ZENIT'}).getByLabel('Dated window (UTC)',{exact:true}).selectOption({index:1});await expect(page.getByRole('status').filter({hasText:'Loading dated window'})).toHaveCount(0);await expect(page.getByRole('region',{name:'Explore ZENIT'})).toBeVisible()
  await page.getByRole('button',{name:'Discover',exact:true}).click();await page.getByRole('button',{name:/^Travel with the ISS/}).click();await expect(canvas).toHaveAttribute('data-following','25544');await expect(page.getByRole('button',{name:'Play study',exact:true})).toBeVisible()
})


test('phone destinations clear the guide and keep the centre of the scene above the transport',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:667,height:320});await page.goto('/');await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:/^Navigation shells/}).click()
  for(const viewport of [{width:667,height:320},{width:390,height:844}]){
    await page.setViewportSize(viewport);await expect(page.getByRole('button',{name:'Browse exploration'})).toBeVisible();await expect(page.getByRole('region',{name:'Explore ZENIT'})).toHaveCount(0)
    const controls=await page.getByRole('region',{name:'Study and camera controls'}).boundingBox();expect(controls!.y).toBeGreaterThan(viewport.height/2)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    const play=await page.getByRole('button',{name:'Play study',exact:true}).boundingBox();expect(play!.height).toBeGreaterThanOrEqual(44)
  }
})
