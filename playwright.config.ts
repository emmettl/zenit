import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  // Hosted software graphics initialise more slowly than local browser contexts.
  expect: { timeout: process.env.CI ? 10000 : 5000 },
  testDir: './tests', fullyParallel: true, workers: 2, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4194', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: { command: 'npm run preview -- --port 4194 --strictPort', url: 'http://127.0.0.1:4194', reuseExistingServer: false },
})
