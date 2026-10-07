import { readFile, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { join } from 'node:path'
const html = await readFile('dist/index.html', 'utf8')
assert.match(html, /rel="canonical" href="https:\/\/zenit\.motionstudies\.app\/"/)
assert.doesNotMatch(html, /(?:src|href)="\/(?:assets|data)\//)
const manifest = JSON.parse(await readFile('dist/data/zenit-manifest.json', 'utf8'))
assert.equal(manifest.status, 'scaffold')
assert.equal(manifest.evidence.orbital.records, 0)
assert.equal(manifest.evidence.stellar.records, 0)
assert.deepEqual(await readdir('dist/data'), ['zenit-manifest.json'])
let total = 0
async function measure(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    if (item.isDirectory()) await measure(path)
    else total += gzipSync(await readFile(path)).length
  }
}
await measure('dist')
assert.ok(total <= 2_000_000, `Compressed application artifact exceeds opening budget: ${total}`)
console.log(`Publication checked: empty evidence, relative URLs, canonical subdomain; ${total} gzip bytes across the complete artifact.`)
