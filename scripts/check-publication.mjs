import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { join } from 'node:path'
const html = await readFile('dist/index.html', 'utf8')
assert.match(html, /rel="canonical" href="https:\/\/zenit\.motionstudies\.app\/"/)
assert.doesNotMatch(html, /(?:src|href)="\/(?:assets|data)\//)
// Social crawlers receive complete metadata in the static HTML without JavaScript.
function meta(key){const matches=[...html.matchAll(new RegExp(`<meta (?:name|property)="${key}" content="([^"<>]+)"`,'g'))];assert.equal(matches.length,1,`Missing or duplicate ${key}`);return matches[0][1]}
const canonical='https://zenit.motionstudies.app/'
assert.equal(meta('og:url'),canonical);assert.equal(meta('og:type'),'website');assert.equal(meta('og:site_name'),'Motion Studies');assert.equal(meta('og:locale'),'en_GB')
assert.equal(meta('twitter:card'),'summary_large_image');assert.equal(meta('twitter:title'),meta('og:title'))
assert.equal(meta('description'),meta('og:description'));assert.equal(meta('twitter:description'),meta('description'))
assert.ok(meta('description').length>=80&&meta('description').length<=180)
assert.doesNotMatch(html,/early camera scaffold|contains no satellite or stellar dataset/)
const social=JSON.parse(await readFile('docs/evidence/social-card-2026-10-08.json','utf8'))
const imageUrl=meta('og:image');assert.equal(imageUrl,canonical+social.image.path)
assert.equal(meta('og:image:secure_url'),imageUrl);assert.equal(meta('twitter:image'),imageUrl)
assert.equal(meta('og:image:type'),'image/png');assert.equal(meta('og:image:width'),'1200');assert.equal(meta('og:image:height'),'630')
assert.equal(meta('twitter:image:alt'),meta('og:image:alt'));assert.ok(meta('og:image:alt').length>=60)
const imageBytes=await readFile('dist/'+social.image.path)
assert.equal(imageBytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
assert.equal(imageBytes.readUInt32BE(16),1200);assert.equal(imageBytes.readUInt32BE(20),630)
assert.equal(createHash('sha256').update(imageBytes).digest('hex'),social.image.sha256)
assert.equal(imageBytes.length,social.image.bytes);assert.ok(imageBytes.length<500000)
assert.match(social.image.path,new RegExp(`^share/zenit-${social.image.sha256.slice(0,12)}\\.png$`))
const structured=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
assert.equal(structured['@type'],'CreativeWork');assert.equal(structured['@id'],canonical+'#work');assert.equal(structured.url,canonical);assert.equal(structured.description,meta('description'))
assert.equal(structured.image.contentUrl,imageUrl);assert.equal(structured.image.width,1200);assert.equal(structured.image.height,630)
assert.equal(structured.image.license,'https://creativecommons.org/licenses/by-sa/4.0/');assert.equal(structured.isPartOf.url,'https://motionstudies.app/')
assert.match(await readFile('dist/share/NOTICE.txt','utf8'),/David Nash.*Astronomy Nexus/)
assert.match(await readFile('dist/favicon.svg','utf8'),/viewBox="0 0 64 64"/)
for(const [file,size] of [['favicon-32.png',32],['apple-touch-icon.png',180]]){assert.match(html,new RegExp(`href="\\./${file}"`));const png=await readFile('dist/'+file);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size)}
console.log(`Social metadata checked: canonical identity, OG/Twitter card, structured work, icons and verified 1200×630 PNG (${imageBytes.length} bytes).`)

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
const largeConstellationIndex=JSON.parse(await readFile('src/large-constellation-releases.json','utf8')),lazyConstellationPaths=new Set(Object.values(largeConstellationIndex).map(x=>'dist/'+x.file.slice(2)))
let total=0,opening=0
async function measure(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await measure(path);else{const size=gzipSync(await readFile(path)).length;total+=size;if(!lazyConstellationPaths.has(path))opening+=size}}}
await measure('dist');assert.ok(opening<=2_000_000,`Original edition artifact exceeds 2 MB gzip: ${opening}`);assert.ok(total<=3_500_000,`Complete artifact exceeds 3.5 MB gzip: ${total}`)
console.log(`Publication checked: 5,070 HYG records, source rights and integrity, relative URLs, canonical subdomain; stellar ${stellarBytes} gzip bytes, original edition ${opening} gzip bytes, complete artifact with on-demand populations ${total} gzip bytes.`)

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
const studyIndex=JSON.parse(await readFile('src/study-windows.json','utf8')),allowedOrbital=new Set(['NOTICE.txt',orbitalFile.split('/')[1],cohortFile.split('/')[1],JSON.parse(await readFile('src/debris-release.json','utf8')).file.split('/').at(-1),JSON.parse(await readFile('src/constellation-release.json','utf8')).file.split('/').at(-1),...Object.values(largeConstellationIndex).map(x=>x.file.split('/').at(-1))])
assert.equal(studyIndex.schemaVersion,1);assert.equal(studyIndex.windows.length,3);assert.equal(studyIndex.observers.length,5)
const nightPlaces=new Set()
for(const window of studyIndex.windows){
 const path=window.manifest.replace('./',''),body=await readFile('dist/'+path);assert.equal(createHash('sha256').update(body).digest('hex'),window.manifestSha256);const m=JSON.parse(body)
 assert.deepEqual(m.study,window.study);assert.deepEqual(m.evidence.stellar,manifest.evidence.stellar);assert.equal(Date.parse(m.study.endUtc)-Date.parse(m.study.startUtc),43200000)
 if(path!=='data/zenit-manifest.json'){assert.match(path,/^data\/orbital\/window-[a-f0-9]{12}\.json$/);allowedOrbital.add(path.split('/').at(-1))}
 const releases={}
 for(const kind of ['iss','orbital']){const e=m.evidence[kind];assert.match(e.file,/^orbital\/(iss|cohorts)-[a-f0-9]{12}\.json$/);const b=await readFile('dist/data/'+e.file);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);allowedOrbital.add(e.file.split('/').at(-1));releases[kind]=JSON.parse(b);assert.deepEqual(releases[kind].study,m.study);assert.equal(releases[kind].rights.id,'basic-ssa-citation');assert.equal(releases[kind].model.gravity,'WGS72');assert.equal(releases[kind].model.operationMode,'a');assert.equal(releases[kind].model.maximumElementAgeHours,24)}
 const c=releases.orbital;assert.ok(c.movers.length<=1000);assert.equal(c.movers.length,m.evidence.orbital.records);assert.equal(c.statistics.distinctIdentities,c.movers.length+c.attachments.length+c.statistics.excludedIndependentIdentities);assert.deepEqual(c.movers.find(x=>x.id==='25544').element,releases.iss.elements[0])
 for(const mover of c.movers){const ep=Date.parse(mover.element.EPOCH);assert.equal(Date.parse(mover.eligibleStartUtc),Math.max(Date.parse(m.study.startUtc),ep-86400000));assert.equal(Date.parse(mover.eligibleEndUtc),Math.min(Date.parse(m.study.endUtc),ep+86400000))}
 for(const [id,pass] of Object.entries(window.sequences)){assert.ok(studyIndex.observers.some(x=>x.id===id));const mover=c.movers.find(x=>x.id===pass.objectId);assert.ok(mover);assert.ok(pass.maximumElevationDegrees>=20);assert.equal(pass.night,pass.solarAltitudeDegrees<=-6);assert.ok(Date.parse(pass.riseUtc)<Date.parse(pass.peakUtc)&&Date.parse(pass.peakUtc)<Date.parse(pass.setUtc));assert.ok(Date.parse(pass.riseUtc)>=Date.parse(m.study.startUtc)&&Date.parse(pass.setUtc)<=Date.parse(m.study.endUtc));assert.ok(Math.abs(Date.parse(pass.peakUtc)-Date.parse(mover.element.EPOCH))<=86400000);if(pass.night)nightPlaces.add(id)}
}
assert.equal(nightPlaces.size,5)
assert.deepEqual((await readdir('dist/data/orbital')).sort(),[...allowedOrbital].sort())
console.log('Observer publication checked: five declared places, three immutable dated windows, complete geometric night sequences, source hashes and per-object 24-hour bounds.')
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

const debrisIndex=JSON.parse(await readFile('src/debris-release.json','utf8')),debrisAudit=JSON.parse(await readFile('docs/evidence/debris-chapter-2026-11-01.json','utf8'))
assert.match(debrisIndex.file,/^\.\/data\/orbital\/cohorts-[a-f0-9]{12}\.json$/)
const debrisBytes=await readFile('dist/'+debrisIndex.file.slice(2)),debris=JSON.parse(debrisBytes)
assert.equal(createHash('sha256').update(debrisBytes).digest('hex'),debrisIndex.sha256);assert.equal(debrisIndex.sha256,debrisAudit.release.sha256)
assert.ok((await readdir('dist/data/orbital')).includes(debrisIndex.file.split('/').at(-1)))
assert.equal(debris.kind,'debris-chapter');assert.equal(debris.rights.id,'basic-ssa-citation');assert.deepEqual(debris.study,debrisIndex.study);assert.equal(Date.parse(debris.study.endUtc)-Date.parse(debris.study.startUtc),1800000)
assert.equal(debris.movers.length,462);assert.equal(new Set(debris.movers.map(m=>m.id)).size,462);assert.equal(debris.statistics.excludedIdentities,232);assert.equal(debris.statistics.capExclusions,0)
assert.equal(debris.model.gravity,'WGS72');assert.equal(debris.model.operationMode,'a');assert.equal(debris.model.propagationFrame,'TEME');assert.equal(debris.model.ageLimitHours,24)
assert.equal(debrisAudit.validation.proofAgreement.passed,true);assert.equal(debrisAudit.validation.proofAgreement.payloadSha256,JSON.parse(await readFile('docs/evidence/debris-proof-2026-11-01.json','utf8')).release.sha256)
for(const mover of debris.movers){const epoch=Date.parse(mover.element.EPOCH);assert.equal(Date.parse(mover.eligibleStartUtc),Math.max(Date.parse(debris.study.startUtc),epoch-86400000));assert.equal(Date.parse(mover.eligibleEndUtc),Math.min(Date.parse(debris.study.endUtc),epoch+86400000))}
assert.equal(debris.movers.filter(m=>m.role==='original-catalogue-identity').length,2);assert.equal(debris.movers.filter(m=>Date.parse(m.eligibleEndUtc)>=Date.parse(debris.study.endUtc)).length,454)
const chapterHtml=await readFile('dist/after-the-collision/index.html','utf8');assert.match(chapterHtml,/https:\/\/zenit\.motionstudies\.app\/after-the-collision\//);assert.doesNotMatch(chapterHtml,/(?:src|href)="\/(?:assets|data)\//);assert.match(chapterHtml,/href="\.\.\/\?explore=discover"/);assert.match(await readFile('dist/data/orbital/NOTICE.txt','utf8'),/USSPACECOM/)
for(const asset of await readdir('dist/assets'))if(asset.endsWith('.js'))assert.doesNotMatch(await readFile('dist/assets/'+asset,'utf8'),/work\/sources|work\/debris-proof|private-research-proof/)
console.log('Debris publication checked: 462 audited identities, two family roles, 30-minute window, integrity hashes, relative chapter navigation and source notice; private work excluded.')

const simulationAudit=JSON.parse(await readFile('docs/evidence/collision-experiment-2026-11-01.json','utf8'))
assert.equal(simulationAudit.kind,'indicative-collision-experiment');assert.equal(simulationAudit.identity.synthetic,true);assert.equal(simulationAudit.identity.providerData,false);assert.equal(simulationAudit.identity.historicalEvent,null);assert.deepEqual(simulationAudit.identity.catalogueIdentities,[])
assert.equal(createHash('sha256').update(await readFile(simulationAudit.implementation.file)).digest('hex'),simulationAudit.implementation.sha256)
assert.equal(simulationAudit.physics.sampleCount,768);assert.equal(simulationAudit.physics.seed,0x5a454e49);assert.equal(simulationAudit.physics.originalOrbits,500);assert.equal(simulationAudit.physics.entryBoundary.heightKm,120);assert.equal(simulationAudit.physics.secondary.conditional,true)
const simulationHtml=await readFile('dist/how-a-debris-cloud-forms/index.html','utf8')
assert.match(simulationHtml,/rel="canonical" href="https:\/\/zenit\.motionstudies\.app\/how-a-debris-cloud-forms\//)
assert.match(simulationHtml,/AN INDICATIVE SIMULATION/);assert.match(simulationHtml,/circular states and fragment release are synthetic/)
assert.match(simulationHtml,/href="\.\.\/\?explore=discover"/);assert.match(simulationHtml,/href="\.\.\/after-the-collision\/"/)
assert.doesNotMatch(simulationHtml,/(?:src|href)="\/(?:assets|data)\//)
console.log('Collision experiment checked: separate synthetic identity, authored model hash, explicit assumptions, representative samples and relative chapter links; no new catalogue data.')

const constellationIndex=JSON.parse(await readFile('src/constellation-release.json','utf8')),constellationAudit=JSON.parse(await readFile('docs/evidence/constellation-proof-2026-11-02.json','utf8'))
assert.match(constellationIndex.file,/^\.\/data\/orbital\/constellation-[a-f0-9]{12}\.json$/)
const constellationBytes=await readFile('dist/'+constellationIndex.file.slice(2)),constellation=JSON.parse(constellationBytes)
assert.equal(createHash('sha256').update(constellationBytes).digest('hex'),constellationIndex.sha256);assert.equal(constellationIndex.sha256,constellationAudit.release.sha256)
assert.equal(constellation.kind,'constellation-proof');assert.equal(constellation.source.sha256,'6b04ee799fe82bb53a9c802bd4b065daaee05b58b4eac13e0cf46232e50bb647');assert.equal(constellation.rights.id,'basic-ssa-citation');assert.deepEqual(constellation.study,constellationIndex.study)
assert.equal(constellation.movers.length,647);assert.equal(new Set(constellation.movers.map(m=>m.id)).size,647);assert.equal(constellation.statistics.inputRows,651);assert.equal(constellation.statistics.excludedIdentities,4);assert.equal(constellation.statistics.capExclusions,0)
assert.equal(constellation.model.gravity,'WGS72');assert.equal(constellation.model.operationMode,'a');assert.equal(constellation.model.propagationFrame,'TEME');assert.equal(constellation.model.ageLimitHours,24)
const independent=constellationAudit.validation.independentAgreement;assert.equal(independent.passed,true);assert.equal(independent.payloadSha256,constellationIndex.sha256);assert.equal(independent.identities,647);assert.equal(independent.samples,1941)
for(const m of constellation.movers){const epoch=Date.parse(m.element.EPOCH);assert.equal(m.element.NORAD_CAT_ID,m.id);assert.match(m.name,/^ONEWEB-\d+$/);assert.equal(Date.parse(m.eligibleStartUtc),Math.max(Date.parse(constellation.study.startUtc),epoch-86400000));assert.equal(Date.parse(m.eligibleEndUtc),Math.min(Date.parse(constellation.study.endUtc),epoch+86400000))}
assert.equal(constellation.movers.filter(m=>Date.parse(m.eligibleEndUtc)>=Date.parse(constellation.study.endUtc)).length,643)
assert.equal(constellationAudit.exclusionLedger.length,4);assert.ok(constellationAudit.exclusionLedger.every(x=>x.reason==='outside-age-window'))
assert.doesNotMatch(constellationBytes.toString(),/work\/sources|responseHeaders|Set-Cookie/i)
const constellationHtml=await readFile('dist/how-a-constellation-takes-shape/index.html','utf8');assert.match(constellationHtml,/https:\/\/zenit\.motionstudies\.app\/how-a-constellation-takes-shape\//);assert.match(constellationHtml,/href="\.\.\/\?explore=discover"/);assert.doesNotMatch(constellationHtml,/(?:src|href)="\/(?:assets|data)\//)
assert.match(await readFile('dist/data/orbital/NOTICE.txt','utf8'),/OneWeb constellation/)
console.log('Constellation proof checked: 647 identities from 651 inputs, all-identity independent propagation/ECF agreement, immutable source hash, citation rights, changing age bounds and relative navigation.')

const largeAudit=JSON.parse(await readFile('docs/evidence/large-constellations-2026-11-02.json','utf8'))
assert.equal(largeAudit.budgets.maximumMoversPerGroup,20000);assert.equal(largeAudit.budgets.maximumCompleteArtifactGzip,3500000)
for(const [id,index] of Object.entries(largeConstellationIndex)){
 const body=await readFile('dist/'+index.file.slice(2)),r=JSON.parse(body),a=largeAudit.groups[id]
 assert.equal(createHash('sha256').update(body).digest('hex'),index.sha256);assert.equal(index.sha256,a.release.sha256);assert.equal(r.source.sha256,index.sourceSha256)
 assert.equal(r.constellation,id);assert.equal(r.kind,'constellation-proof');assert.deepEqual(r.study,constellation.study);assert.deepEqual(r.statistics,index.statistics)
 assert.equal(r.movers.length,index.records);assert.ok(r.movers.length<=20000);assert.ok(body.length<=8000000);assert.ok(gzipSync(body).length<=1000000)
 assert.equal(new Set(r.movers.map(m=>m.id)).size,r.movers.length);assert.equal(r.statistics.capExclusions,0);assert.equal(r.statistics.inputRows,r.movers.length+a.exclusionLedger.length)
 assert.equal(r.rights.id,'basic-ssa-citation');assert.equal(r.model.gravity,'WGS72');assert.equal(r.model.operationMode,'a');assert.equal(r.model.propagationFrame,'TEME');assert.equal(r.model.ageLimitHours,24)
 assert.equal(a.validation.independentAgreement.passed,true);assert.equal(a.validation.independentAgreement.payloadSha256,index.sha256);assert.equal(a.validation.independentAgreement.identities,r.movers.length)
 for(const m of r.movers){const epoch=Date.parse(m.element.EPOCH);assert.equal(m.element.NORAD_CAT_ID,m.id);assert.match(m.name,new RegExp(index.namePattern));assert.equal(m.name,m.element.OBJECT_NAME);assert.equal(Date.parse(m.eligibleStartUtc),Math.max(Date.parse(r.study.startUtc),epoch-86400000));assert.equal(Date.parse(m.eligibleEndUtc),Math.min(Date.parse(r.study.endUtc),epoch+86400000))}
 assert.ok(r.featured.guideIds.length<=24);assert.equal(r.featured.epochUtc,r.study.startUtc);assert.deepEqual(r.featured,a.featured);assert.doesNotMatch(body.toString(),/work\/sources|responseHeaders|Set-Cookie/i)
}
console.log('Large constellations checked: complete eligible Starlink and Kuiper groups, separate on-demand budgets, independent all-identity references, source/rights hashes, no cap and bounded orientation diagrams.')
