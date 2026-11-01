import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2022', assetsInlineLimit: 0, rolldownOptions: { input: { main: 'index.html', debris: 'after-the-collision/index.html' } } },
  test: { include: ['src/**/*.test.ts'] },
})
