import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { join } from 'node:path'
const html = await readFile('dist/index.html', 'utf8')
assert.match(html, /rel="canonical" href="https:\/\/zenit\.motionstudies\.app\/"/)
assert.doesNotMatch(html, /(?:src|href)="\/(?:assets|data)\//)
const manifest = JSON.parse(await readFile('dist/data/zenit-manifest.json', 'utf8'))
assert.equal(manifest.status, 'iss-pass');assert.equal(manifest.evidence.orbital.records, 1)
assert.equal(manifest.evidence.stellar.records, 5070)
const file=manifest.evidence.stellar.file
assert.match(file,/^stellar\/hyg-v44-bright-[a-f0-9]{12}\.json$/)
const bytes=await readFile('dist/data/'+file)
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.evidence.stellar.sha256)
const data=JSON.parse(bytes);assert.equal(data.source.version,'4.4');assert.equal(data.licence.id,'CC-BY-SA-4.0')
assert.equal(data.source.compressedSha256,'00b349893b9a53106dd488d8371e8d2fa586043e500bb3cdb8bff3931682197d')
assert.equal(data.epoch,2000);assert.equal(data.frame,'J2000 mean equatorial')
assert.equal(data.rows.length,5070);assert.equal(data.selection.maximumVisualMagnitude,6)
assert.equal(new Set(data.rows.map(x=>x[0])).size,5070)
assert.ok(data.rows.every(x=>x[1]>0&&x[10]<=6&&Number.isFinite(x[8])&&Number.isFinite(x[9])))
assert.deepEqual((await readdir('dist/data')).sort(),['orbital','stellar','zenit-manifest.json'])
assert.deepEqual((await readdir('dist/data/stellar')).sort(),['NOTICE.txt',file.split('/')[1]].sort())
assert.match(await readFile('dist/data/stellar/NOTICE.txt','utf8'),/David Nash.*Astronomy Nexus/)
assert.equal((await readdir('dist/licences')).length,10)
const stellarBytes=gzipSync(bytes).length
assert.ok(stellarBytes<=500_000,`Stellar payload exceeds 500 KB gzip: ${stellarBytes}`)
let total=0
async function measure(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await measure(path);else total+=gzipSync(await readFile(path)).length}}
await measure('dist');assert.ok(total<=2_000_000,`Opening artifact exceeds 2 MB gzip: ${total}`)
console.log(`Publication checked: 5,070 HYG records, source rights and integrity, relative URLs, canonical subdomain; stellar ${stellarBytes} gzip bytes, complete artifact ${total} gzip bytes.`)

const orbitalFile=manifest.evidence.orbital.file
assert.match(orbitalFile,/^orbital\/iss-[a-f0-9]{12}\.json$/)
const orbitalBytes=await readFile('dist/data/'+orbitalFile)
assert.equal(createHash('sha256').update(orbitalBytes).digest('hex'),manifest.evidence.orbital.sha256)
const orbital=JSON.parse(orbitalBytes)
assert.equal(orbital.elements.length,1);assert.equal(orbital.elements[0].NORAD_CAT_ID,'25544')
assert.equal(orbital.source.sha256,'9b6b872f9c609de40fa76642ba8ea6f4d6c043666e8ba06557b5a1587da6eda3')
assert.equal(orbital.elements[0].REF_FRAME,'TEME');assert.equal(orbital.rights.id,'basic-ssa-citation')
assert.equal(orbital.model.version,'7.1.0');assert.equal(orbital.model.gravity,'WGS72');assert.equal(orbital.model.operationMode,'a')
assert.equal(orbital.selection.independentMovers,1);assert.equal(orbital.selection.attachments,0)
assert.deepEqual((await readdir('dist/data/orbital')).sort(),['NOTICE.txt',orbitalFile.split('/')[1]].sort())
assert.match(await readFile('dist/data/orbital/NOTICE.txt','utf8'),/USSPACECOM/)
assert.deepEqual(manifest.study,orbital.study)
const epoch=Date.parse(orbital.elements[0].EPOCH)
assert.equal(Date.parse(orbital.study.endUtc)-Date.parse(orbital.study.startUtc),43200000)
assert.ok([orbital.study.startUtc,orbital.study.endUtc].every(x=>Math.abs(Date.parse(x)-epoch)<=86400000))
assert.ok(orbital.pass.solarAltitudeDegrees<-6)
console.log('Orbital publication checked: one ISS element set, dated bounded study, night-side pass, source terms and payload SHA-256.')
