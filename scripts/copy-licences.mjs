import { copyFile, mkdir } from 'node:fs/promises'
await mkdir('dist/licences', { recursive: true })
for (const [source, target] of [
  ['@motionstudies/web/fonts/Inter-OFL.txt', 'Inter-OFL.txt'],
  ['@motionstudies/web/fonts/DM-Mono-OFL.txt', 'DM-Mono-OFL.txt'],
  ['@motionstudies/web/LICENSE', 'motionstudies-web.txt'],
  ['@motionstudies/core/LICENSE', 'motionstudies-core.txt'],
  ['react/LICENSE', 'react.txt'],
  ['react-dom/LICENSE', 'react-dom.txt'],
  ['three/LICENSE', 'three.txt'],
]) await copyFile('node_modules/' + source, 'dist/licences/' + target)
