import { test, expect } from '@playwright/test'

test('shows the research state and loads the relative evidence manifest without invented records', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ZENIT', exact: true })).toBeVisible()
  await expect(page.getByText('RESEARCH SCAFFOLD')).toBeVisible()
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://zenit.motionstudies.app/')
  const response = await request.get('/data/zenit-manifest.json')
  const manifest = await response.json()
  expect(manifest.evidence.orbital.records).toBe(0)
  expect(manifest.evidence.stellar.records).toBe(0)
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
