import { test, expect } from '@playwright/test'

test('progressive scene replacement releases retired GPU contexts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const contexts: WebGL2RenderingContext[] = []
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      const context = Reflect.apply(original, this, [kind, ...args])
      if (kind === 'webgl2' && context && !contexts.includes(context)) contexts.push(context)
      return context
    } as typeof original
    Object.defineProperty(window, '__contextState', { get: () => contexts.map(context => ({
      connected: context.canvas instanceof HTMLCanvasElement && context.canvas.isConnected,
      lost: context.isContextLost(),
    })) })
  })
  const releases: (() => void)[] = []
  for (const pattern of ['**/data/stellar/hyg-*.json', '**/data/orbital/iss-*.json', '**/data/orbital/cohorts-*.json']) {
    const ready = new Promise<void>(resolve => { releases.push(resolve) })
    await page.route(pattern, async route => { await ready; await route.continue() })
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  releases[0]()
  await expect(canvas).toHaveAttribute('data-star-count', '5070')
  releases[1]()
  await expect(canvas).toHaveAttribute('data-orbital-count', '1')
  releases[2]()
  await expect(canvas).toHaveAttribute('data-orbital-count', '616')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__contextState')
    .filter((state: { connected: boolean; lost: boolean }) => !state.connected && !state.lost).length)).toBe(0)
  const states = await page.evaluate(() => Reflect.get(window, '__contextState') as { connected: boolean; lost: boolean }[])
  expect(states.length).toBeGreaterThanOrEqual(4)
  expect(states.filter(state => state.connected)).toEqual([{ connected: true, lost: false }])
})
