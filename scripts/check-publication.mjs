import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { join } from 'node:path'
const html = await readFile('dist/index.html', 'utf8')
assert.match(html, /rel="canonical" href="https:\/\/zenit\.motionstudies\.app\/"/)
assert.doesNotMatch(html, /(?:src|href)="\/(?:assets|data)\//)
const manifest = JSON.parse(await readFile('dist/data/zenit-manifest.json', 'utf8'))
assert.equal(manifest.status, 'orbital-families');assert.equal(manifest.evidence.orbital.records, 635)
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
assert.equal((await readdir('dist/licences')).length,11)
const stellarBytes=gzipSync(bytes).length
assert.ok(stellarBytes<=500_000,`Stellar payload exceeds 500 KB gzip: ${stellarBytes}`)
let total=0
async function measure(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await measure(path);else total+=gzipSync(await readFile(path)).length}}
await measure('dist');assert.ok(total<=2_000_000,`Opening artifact exceeds 2 MB gzip: ${total}`)
console.log(`Publication checked: 5,070 HYG records, source rights and integrity, relative URLs, canonical subdomain; stellar ${stellarBytes} gzip bytes, complete artifact ${total} gzip bytes.`)

const orbitalFile=manifest.evidence.iss.file
assert.match(orbitalFile,/^orbital\/iss-[a-f0-9]{12}\.json$/)
const orbitalBytes=await readFile('dist/data/'+orbitalFile)
assert.equal(createHash('sha256').update(orbitalBytes).digest('hex'),manifest.evidence.iss.sha256)
const orbital=JSON.parse(orbitalBytes)
assert.equal(orbital.elements.length,1);assert.equal(orbital.elements[0].NORAD_CAT_ID,'25544')
assert.equal(orbital.source.sha256,'9b6b872f9c609de40fa76642ba8ea6f4d6c043666e8ba06557b5a1587da6eda3')
assert.equal(orbital.elements[0].REF_FRAME,'TEME');assert.equal(orbital.rights.id,'basic-ssa-citation')
assert.equal(orbital.model.version,'7.1.0');assert.equal(orbital.model.gravity,'WGS72');assert.equal(orbital.model.operationMode,'a')
assert.equal(orbital.selection.independentMovers,1);assert.equal(orbital.selection.attachments,0)
const cohortFile=manifest.evidence.orbital.file
assert.match(cohortFile,/^orbital\/cohorts-[a-f0-9]{12}\.json$/)
const cohortBytes=await readFile('dist/data/'+cohortFile)
assert.equal(createHash('sha256').update(cohortBytes).digest('hex'),manifest.evidence.orbital.sha256)
const cohorts=JSON.parse(cohortBytes)
assert.equal(cohorts.statistics.independentMovers,635);assert.equal(cohorts.statistics.initialEligibleMovers,616);assert.equal(cohorts.attachments.length,12)
assert.deepEqual(cohorts.source.sources.map(x=>x.sha256),['9a8dd20063818e9782e17cc0fbb363bb9687fd38bc4df0416c7ec7deec0cbe0c','a36af6fab6f198e9fd9e605bd968b1b4b39b937631dc343c76146e98dc67255a','e9b64b76fa4b2133c6f3cce1a30d5fd89894fc0ba53a7689ae09525ef61e1ad1','60140c6a1d8b9902bfb9019be85bd43ef4cbc6d67d6dd41da4bded6b3d64d8b2'])
assert.equal(cohorts.statistics.distinctIdentities,716);assert.equal(cohorts.statistics.inputRows,762)
assert.equal(cohorts.movers.length,635);assert.equal(new Set(cohorts.movers.map(x=>x.id)).size,635)
assert.deepEqual(cohorts.study,manifest.study)
assert.deepEqual((await readdir('dist/data/orbital')).sort(),['NOTICE.txt',orbitalFile.split('/')[1],cohortFile.split('/')[1]].sort())
assert.match(await readFile('dist/data/orbital/NOTICE.txt','utf8'),/USSPACECOM/)
assert.deepEqual(manifest.study,orbital.study)
const epoch=Date.parse(orbital.elements[0].EPOCH)
assert.equal(Date.parse(orbital.study.endUtc)-Date.parse(orbital.study.startUtc),43200000)
assert.ok([orbital.study.startUtc,orbital.study.endUtc].every(x=>Math.abs(Date.parse(x)-epoch)<=86400000))
assert.ok(orbital.pass.solarAltitudeDegrees<-6)
console.log('Orbital publication checked: 635 independent movers, 12 attachments, 69 excluded identities, retained ISS pass, source terms and payload SHA-256.')

const geographyBytes=await readFile('src/earth-land.json'),geography=JSON.parse(geographyBytes)
assert.equal(createHash('sha256').update(geographyBytes).digest('hex'),manifest.geography.compiledSha256)
assert.equal(geography.source.sha256,'9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9')
assert.equal(geography.polygons.length,127);assert.equal(geography.source.rights,'Public domain')
assert.match(await readFile('dist/licences/natural-earth.txt','utf8'),/Public-domain land polygons/)
console.log('Geography checked: pinned Natural Earth land, 127 polygons and public-domain notice; geometry bundled in the application.')
