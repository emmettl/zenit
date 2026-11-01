import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {PerspectiveCamera,Vector3} from 'three'
import {blockedByEarth} from '../src/stellar'
import {json2satrec,sgp4,eciToEcf,gstime} from 'satellite.js'
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as {PNG:{sync:{read:(bytes:Buffer)=>{width:number;height:number;data:Buffer}}}}
const index=JSON.parse(readFileSync('src/debris-release.json','utf8')),release=JSON.parse(readFileSync('public/'+index.file.slice(2),'utf8')),start=Date.parse(release.study.startUtc)

for(const viewport of [{width:1280,height:850},{width:390,height:844}])test(`near-side debris stays visible across adjacent instants at ${viewport.width}px`,async({page},info)=>{
  await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/after-the-collision/');const canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-eligible','462')
  await page.getByRole('button',{name:'Families & records'}).click()
  // Remove interface occlusion only; keep the production Earth, depth buffer and glyph rendering.
  await page.addStyleTag({content:'header,aside,nav,.transport,footer,.chapter-load{opacity:0!important}'})
  const camera=new PerspectiveCamera(43,viewport.width/viewport.height,.05,100);camera.position.set(0,1.7,3.7).multiplyScalar(Math.max(1,viewport.height/viewport.width));camera.lookAt(0,0,0);camera.updateMatrixWorld()
  const records=release.movers.map((m:{id:string;group:string;element:Parameters<typeof json2satrec>[0]})=>({...m,epoch:Date.parse(String(m.element.EPOCH)),baseline:json2satrec(m.element,'a')}))
  const metrics=[]
  for(const offset of [0,2000,4000]){
    await page.locator('#time').fill(String(offset));await expect(canvas).toHaveAttribute('data-time',String(start+offset));await expect(canvas).toHaveAttribute('data-shown','462')
    const projected=records.map((m:typeof records[number])=>{const state=sgp4({...m.baseline},(start+offset-m.epoch)/60000);if(!state||!state.position)throw Error('Reference propagation failed');const fixed=eciToEcf(state.position,gstime(new Date(start+offset))),world=new Vector3(fixed.x,fixed.z,-fixed.y).divideScalar(6378.137),ndc=world.clone().project(camera);return {id:m.id,group:m.group,x:(ndc.x+1)*viewport.width/2,y:(1-ndc.y)*viewport.height/2,front:world.clone().normalize().dot(camera.position.clone().normalize()),blocked:blockedByEarth(camera.position,world.clone().sub(camera.position).normalize(),world.distanceTo(camera.position))}})
    // Well inside the near hemisphere: none can be hidden by the true Earth limb.
    const samples=projected.filter((p:typeof projected[number])=>p.front>.65&&p.x>8&&p.x<viewport.width-8&&p.y>8&&p.y<viewport.height-8&&!projected.some((q:typeof projected[number])=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<(viewport.width<650?8:12)))
    expect(samples.length).toBeGreaterThan(15)
    const raster=PNG.sync.read(await page.screenshot({scale:'css',path:info.outputPath(`near-side-${offset}.png`)}))
    await page.locator('#iridium-33').uncheck();await page.locator('#cosmos-2251').uncheck()
    const background=PNG.sync.read(await page.screenshot({scale:'css'}))
    await page.locator('#iridium-33').check();await page.locator('#cosmos-2251').check()
    const hidden=projected.filter((p:typeof projected[number])=>p.blocked&&p.front<-.85&&p.x>8&&p.x<viewport.width-8&&p.y>8&&p.y<viewport.height-8&&!projected.some((q:typeof projected[number])=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<(viewport.width<650?8:12)))
    expect(hidden.length).toBeGreaterThan(0)
    const missing=[],leaked=[]
    for(const p of [...samples,...hidden]){let visible=false;for(let y=Math.floor(p.y)-3;y<=Math.ceil(p.y)+3;y++)for(let x=Math.floor(p.x)-3;x<=Math.ceil(p.x)+3;x++){const i=(y*raster.width+x)*4,r=raster.data[i]-background.data[i],g=raster.data[i+1]-background.data[i+1],b=raster.data[i+2]-background.data[i+2];if(p.group==='iridium-33'?b>50&&g>35:r>50&&r-b>30)visible=true}if(!p.blocked&&!visible)missing.push(p.id);if(p.blocked&&visible)leaked.push(p.id)}
    metrics.push({offset,samples:samples.length,hidden:hidden.length,missing,leaked})
  }
  await info.attach('near-side-visibility',{body:JSON.stringify(metrics,null,2),contentType:'application/json'})
  for(const metric of metrics){expect(metric.missing,`Visible near-side fragments missing at +${metric.offset} ms`).toEqual([]);expect(metric.leaked,`Far-side fragments showing through Earth at +${metric.offset} ms`).toEqual([])}
})
