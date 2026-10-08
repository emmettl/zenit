import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const directory='work/sources/geography-2026-10-08/'
const raw=await readFile(directory+'ne_110m_land.geojson'),capture=JSON.parse(await readFile(directory+'capture.json','utf8'))
const sourceHash='9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9'
assert.equal(createHash('sha256').update(raw).digest('hex'),sourceHash);assert.equal(capture.sha256,sourceHash)
const source=JSON.parse(raw);assert.equal(source.type,'FeatureCollection');assert.equal(source.crs?.properties?.name,'urn:ogc:def:crs:OGC:1.3:CRS84')
const polygons=source.features.map(feature=>{assert.equal(feature.geometry.type,'Polygon');return feature.geometry.coordinates.map(ring=>{
  assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1))
  return ring.map(point=>{assert.ok(point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90);return point.map(value=>Number(value.toFixed(4)))})
})})
const geography={source:{name:'Natural Earth 1:110m land',revision:capture.revision,url:capture.url,sha256:sourceHash,capturedAtUtc:capture.capturedAtUtc,rights:'Public domain',rightsUrl:capture.rightsUrl},frame:'WGS84 longitude/latitude degrees',selection:'All land polygons, rings and holes; feature properties removed; coordinates rounded to four decimal places. Source antimeridian cuts and polar closing edges retained.',polygons}
const encoded=JSON.stringify(geography)+'\n',sha256=createHash('sha256').update(encoded).digest('hex')
await writeFile('src/earth-land.json',encoded)
const counts={polygons:polygons.length,rings:polygons.reduce((n,p)=>n+p.length,0),vertices:polygons.flat(2).length}
const audit={...capture,compiledSha256:sha256,compiledBytes:Buffer.byteLength(encoded),...counts,delivery:'Bundled into the hashed application asset; offline reproduction, no provider fetch in CI or browsers.',selection:geography.selection,limits:'Generalised global geography, not local coast accuracy, terrain, a Sydney skyline or observing conditions.'}
await writeFile('docs/evidence/geography-release-2026-10-08.json',JSON.stringify(audit,null,2)+'\n')
const manifest=JSON.parse(await readFile('public/data/zenit-manifest.json','utf8'));manifest.geography={name:geography.source.name,sourceSha256:sourceHash,compiledSha256:sha256,...counts,rights:'Public domain',rightsUrl:capture.rightsUrl,delivery:audit.delivery,limits:audit.limits};await writeFile('public/data/zenit-manifest.json',JSON.stringify(manifest,null,2)+'\n')
await writeFile('public/licences/natural-earth.txt',`Made with Natural Earth. Tom Patterson, Nathaniel Vaughn Kelso and contributors.\nPublic-domain land polygons at 1:110 million scale.\nTerms: ${capture.rightsUrl}\nPinned source: ${capture.url}\nSource SHA-256: ${sourceHash}\nCompiled geometry SHA-256: ${sha256}\nAll polygons and holes retained; four-decimal coordinates; canvas rasterisation at runtime.\nGeneralised global map only; no local terrain or observing-condition model.\n`)
console.log(JSON.stringify({sha256,...counts,bytes:Buffer.byteLength(encoded)}))
