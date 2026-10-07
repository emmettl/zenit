import { test, expect } from '@playwright/test'

test('loads the verified stellar release and relative evidence manifest', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ZENIT', exact: true })).toBeVisible()
  await expect(page.getByText('STELLAR REFERENCE', { exact: true })).toBeVisible()
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://zenit.motionstudies.app/')
  const response = await request.get('/data/zenit-manifest.json')
  const manifest = await response.json()
  expect(manifest.evidence.orbital.records).toBe(0)
  expect(manifest.evidence.stellar.records).toBe(5070)
  await expect(page.getByText('5,070 catalogue records · V ≤ 6.0')).toBeVisible()
  await expect(page.locator('canvas')).toHaveAttribute('data-star-count', '5070')
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('reduced motion lands directly, seeks and returns to orbit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Descend to surface' }).click()
  await expect(page.getByRole('heading', { name: 'The sky above a place.' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Descent to surface' })).toHaveValue('1')
  await page.getByRole('button', { name: 'Return to orbit' }).click()
  await expect(page.getByRole('slider', { name: 'Descent to surface' })).toHaveValue('0')
  await expect(page.getByRole('heading', { name: 'A world surrounded by motion.' })).toBeVisible()
})

test('animated camera can be interrupted without a hidden time reset', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Descend to surface' }).click()
  await expect(page.getByRole('status')).toHaveText('Camera moving')
  await expect.poll(async () => Number(await page.getByRole('slider').inputValue())).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause camera' }).click()
  await expect(page.getByRole('status')).toHaveText('Camera paused')
  const stopped = await page.getByRole('slider').inputValue()
  await expect(page.getByRole('slider')).toHaveValue(stopped)
  expect(Number(stopped)).toBeLessThan(1)
})


test('catalogue selection, layer toggle and surface horizon remain inspectable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByLabel('Named star')).toBeEnabled()
  await page.getByLabel('Named star').selectOption('hyg-v44:11734')
  const card = page.getByRole('article', { name: 'Selected star' })
  await expect(card.getByRole('heading', { name: 'Polaris' })).toBeVisible()
  await expect(card).toContainText('HYG 11734 · HIP 11767')
  await expect(card).toContainText('47.6° · Above horizon')
  await page.getByLabel('Show stars').uncheck()
  await expect(page.getByLabel('Show stars')).not.toBeChecked()
  await page.getByRole('button', { name: 'Descend to surface' }).click()
  await expect(page.getByRole('slider')).toHaveValue('1')
  await page.getByLabel('Named star').selectOption('hyg-v44:30365')
  await expect(card).toContainText('Below horizon')
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(card).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('failed catalogue acquisition can be retried without interrupting the camera', async ({ page }) => {
  await page.route('**/data/stellar/hyg-v44-bright-*.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await expect(page.getByText('Stellar catalogue unavailable')).toBeVisible()
  await expect(page.getByLabel('Named star')).toBeDisabled()
  await expect(page.locator('canvas')).toHaveAttribute('data-star-count', '0')
  await page.unroute('**/data/stellar/hyg-v44-bright-*.json')
  await page.getByRole('button', { name: 'Retry stellar catalogue' }).click()
  await expect(page.getByText('5,070 catalogue records · V ≤ 6.0')).toBeVisible()
})

test('tampered catalogue is rejected before rendering', async ({ page }) => {
  await page.route('**/data/stellar/hyg-v44-bright-*.json', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace('Sirius', 'Altered') })
  })
  await page.goto('/')
  await expect(page.getByText('Stellar catalogue unavailable')).toBeVisible()
  await expect(page.locator('canvas')).toHaveAttribute('data-star-count', '0')
})
