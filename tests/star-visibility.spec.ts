import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {PerspectiveCamera,Quaternion} from 'three'
import {readCatalogue,skyDirections,horizonReading} from '../src/stellar'
// Use the PNG decoder already supplied by the exact pinned Playwright dependency.
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as {PNG:{sync:{read:(bytes:Buffer)=>{width:number;height:number;data:Buffer}}}}
const catalogue=readCatalogue(JSON.parse(readFileSync(new URL('../public/data/stellar/hyg-v44-bright-d874dfa7da5f.json',import.meta.url),'utf8')))

test('compact sky gives isolated mid and faint catalogue stars a readable raster footprint',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:664});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/')
  const canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-orbital-count','616')
  await page.getByRole('button',{name:'Watch Sydney pass'}).click();await page.getByRole('button',{name:'Show panels',exact:true}).click();await page.getByRole('button',{name:'Seek to pass peak'}).click()
  await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse('2026-10-07T17:58:49Z')))
  await page.getByRole('button',{name:'Hide panels',exact:true}).click();await page.evaluate(()=>document.fonts.ready)
  // Sample an explored sky direction, away from the compass's instruction strip.
  for(let i=0;i<5;i++)await canvas.press('ArrowRight')
  const camera=new PerspectiveCamera(100,390/664,.1,2);camera.quaternion.copy(new Quaternion(...(await canvas.getAttribute('data-camera-rotation'))!.split(',').map(Number) as [number,number,number,number]));camera.updateMatrixWorld()
  const rays=skyDirections(catalogue.stars,'2026-10-07T17:58:49Z')
  const points=rays.flatMap((ray,i)=>{const ndc=ray.clone().project(camera);return ndc.z> -1&&ndc.z<1&&horizonReading(ray).altitude>5?[{star:catalogue.stars[i],x:(ndc.x+1)*195,y:(1-ndc.y)*332}]:[]})
  const exclusions=await page.locator('header:visible,.composition:visible,.controls:visible,.horizon-compass:visible,.sky-star-label:visible,.iss-marker:visible').all().then(nodes=>Promise.all(nodes.map(node=>node.boundingBox())))
  const samples=points.filter(point=>point.x>12&&point.x<378&&point.y>12&&point.y<652&&!exclusions.some(box=>box&&point.x>box.x-12&&point.x<box.x+box.width+12&&point.y>box.y-12&&point.y<box.y+box.height+12)&&!points.some(other=>other!==point&&Math.hypot(other.x-point.x,other.y-point.y)<10))
  const onBytes=await page.screenshot({scale:'css',path:testInfo.outputPath('compact-stars.png')}),on=PNG.sync.read(onBytes)
  await page.getByRole('button',{name:'Show panels',exact:true}).click();await page.getByRole('checkbox',{name:'Show stars',exact:true}).uncheck();await page.getByRole('button',{name:'Hide panels',exact:true}).click()
  const off=PNG.sync.read(await page.screenshot({scale:'css'}));expect(on.width).toBe(390);expect(off.height).toBe(664)
  const metrics=samples.map(({star,x,y})=>{
    let peak=0,coverage=0
    for(let py=Math.floor(y)-4;py<=Math.ceil(y)+4;py++)for(let px=Math.floor(x)-4;px<=Math.ceil(x)+4;px++){
      const offset=(py*on.width+px)*4,difference=.2126*(on.data[offset]-off.data[offset])+.7152*(on.data[offset+1]-off.data[offset+1])+.0722*(on.data[offset+2]-off.data[offset+2])
      peak=Math.max(peak,difference);if(difference>=24)coverage++
    }
    return {id:star.id,magnitude:star.mag,peak,coverage}
  })
  const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]
  const bands=[[2,3],[4,5],[5.5,6]].map(([min,max])=>{const selected=metrics.filter(x=>x.magnitude>=min&&x.magnitude<=max);return {min,max,samples:selected.length,medianPeak:median(selected.map(x=>x.peak)),medianCoverage:median(selected.map(x=>x.coverage))}})
  console.log(JSON.stringify({project:testInfo.project.name,bands}))
  await testInfo.attach('star-raster-metrics',{body:JSON.stringify({bands,samples:metrics},null,2),contentType:'application/json'})
  expect(bands[0].medianPeak).toBeGreaterThan(bands[1].medianPeak);expect(bands[1].medianPeak).toBeGreaterThan(bands[2].medianPeak)
  for(const band of bands){expect(band.samples).toBeGreaterThanOrEqual(band.min<4?2:10);expect(band.medianPeak).toBeGreaterThanOrEqual(band.min>=5.5?55:80);expect(band.medianCoverage).toBeGreaterThanOrEqual(2)}
  await expect(canvas).toHaveAttribute('data-star-display','compact');await expect(canvas).toHaveAttribute('data-star-count','5070')
  await page.setViewportSize({width:844,height:390});await expect(canvas).toHaveAttribute('data-star-display','compact')
  await page.setViewportSize({width:1280,height:720});await expect(canvas).toHaveAttribute('data-star-display','standard')
  await expect(canvas).toHaveAttribute('data-study-time',String(Date.parse('2026-10-07T17:58:49Z')))
})
