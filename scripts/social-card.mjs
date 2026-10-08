import {chromium,expect} from '@playwright/test'
import {createHash} from 'node:crypto'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
// Manual artwork release from the verified production renderer. Never run in CI
// or contact a provider; fonts and scene inputs are pinned local public assets.
const base=process.argv[2]??'http://127.0.0.1:4200/'
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Artwork must be captured from a built local preview')
const manifest=JSON.parse(await readFile('public/data/zenit-manifest.json','utf8'))
const orbit=JSON.parse(await readFile('public/data/'+manifest.evidence.iss.file,'utf8'))
const browser=await chromium.launch(process.platform==='darwin'?{args:['--use-angle=metal']}: {})
try{
  const context=await browser.newContext({viewport:{width:1200,height:630},deviceScaleFactor:1,reducedMotion:'reduce'})
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const published=await page.request.get(new URL('data/zenit-manifest.json',base).href)
  expect(published.ok()).toBe(true)
  const publishedManifest=await published.json()
  expect(publishedManifest.evidence).toEqual(manifest.evidence)
  expect(publishedManifest.study).toEqual(manifest.study)
  expect(publishedManifest.geography).toEqual(manifest.geography)
  await page.goto(base)
  const canvas=page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-star-count','5070')
  await expect(canvas).toHaveAttribute('data-orbital-count','616')
  await page.getByRole('button',{name:'Watch Sydney pass',exact:true}).click()
  await page.getByRole('button',{name:'Show panels',exact:true}).click()
  await page.getByRole('button',{name:'Seek to pass peak',exact:true}).click()
  await expect(canvas).toHaveAttribute('data-camera-phase','Looking up')
  await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse(orbit.pass.peakUtc)))
  await expect.poll(async()=>Number(await canvas.getAttribute('data-orbital-count'))).toBeGreaterThan(0)
  await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse(orbit.pass.peakUtc)))
  await expect(page.getByRole('button',{name:'Inspect ISS',exact:true})).toBeVisible()
  if(errors.length)throw Error(errors.join('\n'))
  const view=await canvas.evaluate(element=>({...element.dataset}))
  await page.evaluate(()=>document.fonts.ready)
  await page.addStyleTag({content:'header,.edition-state,.composition,.controls,.stellar-panel,footer,.iss-marker{display:none!important}'})
  const scene=await canvas.screenshot()
  const fontStyles=new URL(import.meta.resolve('@motionstudies/web/fonts.css'))
  const faces=[...(await readFile(fontStyles,'utf8')).matchAll(/@font-face\s*\{([^}]+)\}/g)].map(x=>x[1])
  async function font(family,weight){
    const face=faces.find(css=>css.includes(`font-family: '${family}'`)&&css.includes(`font-weight: ${weight};`)&&css.includes('unicode-range: U+0000-00FF'))
    const asset=face?.match(/src:\s*url\(['"]([^'"]+)['"]\)/)?.[1]
    if(!asset)throw Error('Public Latin font missing: '+family)
    return (await readFile(new URL(asset,fontStyles))).toString('base64')
  }
  const inter=await font('Inter','400 600'),mono=await font('DM Mono','400')
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:400 600}
    @font-face{font-family:Mono;src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:400}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#05090e;color:#e4edf3;font-family:Inter,sans-serif}
    .sky{position:absolute;inset:0;width:1200px;height:630px}
    .shade{position:absolute;inset:0;background:linear-gradient(90deg,#05090ef5 0%,#05090ee8 28%,#05090e80 43%,#05090e00 58%),linear-gradient(0deg,#05090eee 0%,#05090e00 18%)}
    .series{position:absolute;left:58px;top:48px;font:14px Mono,monospace;letter-spacing:3px;color:#9bb0bd;margin:0}
    h1{position:absolute;left:50px;top:132px;margin:0;font-size:112px;line-height:1;font-weight:400;letter-spacing:14px}
    h2{position:absolute;left:58px;top:290px;margin:0;font-size:36px;line-height:1.25;font-weight:400;letter-spacing:-.8px}
    .concept{position:absolute;left:58px;top:414px;font-size:17px;line-height:1.6;color:#9bb0bd;margin:0}
    .address{position:absolute;left:58px;bottom:42px;font:13px Mono,monospace;color:#a5d2e6;margin:0}
    .place{position:absolute;right:46px;bottom:79px;font:13px Mono,monospace;color:#c8dce8;margin:0}
    .credit{position:absolute;right:46px;bottom:35px;font:10px/1.7 Mono,monospace;text-align:right;color:#8b9daa;margin:0}
  </style></head><body><img class="sky" alt="" src="data:image/png;base64,${scene.toString('base64')}"><div class="shade"></div>
    <p class="series">MOTION STUDIES</p><h1>ZENIT</h1><h2>Earth orbit.<br>The sky above us.</h2>
    <p class="concept">Orbital shells. A descent to Earth.<br>A moving light among the stars.</p><p class="address">zenit.motionstudies.app</p>
    <p class="place">Sydney · the retained ISS pass</p>
    <p class="credit">HYG © David Nash / Astronomy Nexus · CC BY-SA 4.0<br>Orbital data: CelesTrak / USSPACECOM · Dated model</p>
  </body></html>`)
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()))})
  const image=await page.screenshot(),sha256=createHash('sha256').update(image).digest('hex'),path=`share/zenit-${sha256.slice(0,12)}.png`
  await mkdir('public/share',{recursive:true});await writeFile('public/'+path,image)
  const icon=await context.newPage(),svg=(await readFile('public/favicon.svg')).toString('base64')
  await icon.setContent(`<style>*{margin:0}html,body,img{width:100%;height:100%;background:#05090e}</style><img src="data:image/svg+xml;base64,${svg}">`)
  await icon.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())))
  for(const [size,file] of [[32,'favicon-32.png'],[180,'apple-touch-icon.png']]){await icon.setViewportSize({width:size,height:size});await icon.screenshot({path:'public/'+file})}
  await writeFile('public/share/NOTICE.txt',`ZENIT social artwork\n\n${path}\nCaptured from ZENIT's production renderer at ${orbit.pass.peakUtc}, Sydney's modelled ISS culmination. Typography, framing, glyph sizes, palette and idealised horizon are authored. This is a dated model, not an optical observation.\n\nStellar field: HYG 4.4, © David Nash / Astronomy Nexus, CC BY-SA 4.0. This adapted social artwork is distributed under CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . Attribution and reproduction record: https://github.com/emmettl/zenit .\nOrbital data: CelesTrak; USSPACECOM / 18th Space Defense Squadron via Space-Track.org. See ../data/orbital/NOTICE.txt for the retained basic-SSA terms.\nFonts: pinned @motionstudies/web Inter and DM Mono public assets, SIL Open Font License; see ../licences/.\nThe separately authored favicon is MIT licensed with the code.\n`)
  await mkdir('docs/evidence',{recursive:true})
  const record={schema:'zenit-social-card/1',generatedAt:new Date().toISOString(),image:{path,width:1200,height:630,bytes:image.length,sha256,licence:'CC-BY-SA-4.0'},presentation:{timeUtc:orbit.pass.peakUtc,observer:orbit.observer,view},sources:manifest.evidence,fonts:'Pinned @motionstudies/web public Inter and DM Mono assets; OFL',note:'A static production-renderer capture of the retained dated Sydney pass. No invented objects, stellar motion or provider requests. Typography and framing authored. Regenerate manually from a built local preview; not part of build/CI.'}
  await writeFile('docs/evidence/social-card-2026-10-08.json',JSON.stringify(record,null,2)+'\n')
  console.log(JSON.stringify(record.image))
}finally{await browser.close()}
