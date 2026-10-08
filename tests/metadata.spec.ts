import {test,expect} from '@playwright/test'
import {createHash} from 'node:crypto'
test.use({javaScriptEnabled:false})
test('social metadata and artwork are available without executing the application',async({page,request})=>{
  await page.goto('/')
  await expect(page).toHaveTitle('ZENIT · Motion Studies')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://zenit.motionstudies.app/')
  const meta=(key:string)=>page.locator(`meta[name="${key}"],meta[property="${key}"]`).getAttribute('content')
  expect(await meta('og:type')).toBe('website');expect(await meta('twitter:card')).toBe('summary_large_image')
  expect(await meta('og:url')).toBe('https://zenit.motionstudies.app/')
  expect(await meta('og:description')).toBe(await meta('description'));expect(await meta('twitter:description')).toBe(await meta('description'))
  const image=(await meta('og:image'))!
  expect(await meta('twitter:image')).toBe(image);expect(await meta('og:image:secure_url')).toBe(image)
  expect(await meta('og:image:alt')).toContain('modelled ISS pass');expect(await meta('twitter:image:alt')).toBe(await meta('og:image:alt'))
  const response=await request.get(new URL(image).pathname),bytes=await response.body()
  expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('image/png')
  expect(bytes.readUInt32BE(16)).toBe(1200);expect(bytes.readUInt32BE(20)).toBe(630)
  expect(image).toContain(createHash('sha256').update(bytes).digest('hex').slice(0,12))
  const work=JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
  expect(work.image.contentUrl).toBe(image);expect(work.url).toBe(await meta('og:url'))
  expect(work.image.license).toBe('https://creativecommons.org/licenses/by-sa/4.0/')
  // Playwright's text matcher excludes noscript even when scripting is disabled.
  const source=await (await request.get('/')).text()
  expect(source).toContain('dated satellite models and the HYG stellar catalogue')
  expect(source).not.toContain('early camera scaffold')
  await expect(page.getByRole('link',{name:'study brief',exact:true})).toBeVisible()
  for(const path of ['/favicon.svg','/favicon-32.png','/apple-touch-icon.png','/share/NOTICE.txt'])expect((await request.get(path)).status()).toBe(200)
  expect(await page.locator('canvas').count()).toBe(0)
})
