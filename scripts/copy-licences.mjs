import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
await mkdir('dist/licences', { recursive: true })
for (const [source, target] of [
  ['@motionstudies/web/fonts/Inter-OFL.txt', 'Inter-OFL.txt'],
  ['@motionstudies/web/fonts/DM-Mono-OFL.txt', 'DM-Mono-OFL.txt'],
  ['@motionstudies/web/LICENSE', 'motionstudies-web.txt'],
  ['@motionstudies/core/LICENSE', 'motionstudies-core.txt'],
  ['react/LICENSE', 'react.txt'],
  ['react-dom/LICENSE', 'react-dom.txt'],
  ['three/LICENSE', 'three.txt'],
  ['satellite.js/LICENSE.md', 'satellite-js.txt'],
]) await copyFile('node_modules/' + source, 'dist/licences/' + target)

const astronomy=await readFile('node_modules/astronomy-engine/astronomy.js','utf8')
await writeFile('dist/licences/astronomy-engine.txt',astronomy.slice(0,astronomy.indexOf('*/')+2)+'\n')
