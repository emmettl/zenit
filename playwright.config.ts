import { defineConfig, devices } from '@playwright/test'
const port=Number(process.env.ZENIT_TEST_PORT??4194)
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid ZENIT_TEST_PORT')
const baseURL=`http://127.0.0.1:${port}`
export default defineConfig({
  // Hosted software graphics initialise more slowly than local browser contexts.
  expect: { timeout: process.env.CI ? 10000 : 5000 },
  // Each test may replace several renderers as verified datasets arrive.
  // Serialize hosted GPU work so WebKit can release contexts between cases.
  testDir: './tests', fullyParallel: true, workers: process.env.CI ? 1 : 2, reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', testIgnore: '**/desktop-star-visibility.spec.ts', use: { ...devices['iPhone 13'] } },
    { name: 'webkit-desktop', testMatch: '**/desktop-star-visibility.spec.ts', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: `npm run preview -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false },
})
