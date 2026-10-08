import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {Vector3} from 'three'
import {readCohorts,createPopulation,populationFrame} from '../src/cohorts'
import {earthFixedSun,illumination,illuminationWeight} from '../src/illumination'
import {readOrbit,orbitalTrailSamples} from '../src/orbital'
const manifest=JSON.parse(readFileSync(new URL('../public/data/zenit-manifest.json',import.meta.url),'utf8')),cohorts=readCohorts(JSON.parse(readFileSync(new URL('../public/data/'+manifest.evidence.orbital.file,import.meta.url),'utf8'))),population=createPopulation(cohorts),orbit=readOrbit(JSON.parse(readFileSync(new URL('../public/data/'+manifest.evidence.iss.file,import.meta.url),'utf8')))
test('illumination follows accepted UTC, preserves the population, reverses deterministically and keeps the eclipsed ISS inspectable',async({page},info)=>{
  test.setTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');const canvas=page.locator('canvas'),clock=page.getByRole('slider',{name:'Study time',exact:true})
  await expect(canvas).toHaveAttribute('data-orbital-count','616',{timeout:15000});await page.evaluate(()=>document.fonts.ready)
  const frames=[Date.parse(manifest.study.initialUtc),Date.parse(manifest.pass.peakUtc),Date.parse(manifest.study.initialUtc)+200000]
  for(const time of frames){
    await clock.fill(String(time));await expect(canvas).toHaveAttribute('data-study-time',String(time));const frame=populationFrame(population,time),sun=earthFixedSun(time),counts={sunlit:0,penumbra:0,umbra:0}
    frame.availability.forEach((status,i)=>{if(status===1)counts[illumination(new Vector3().fromArray(frame.positions,i*3),sun).state]++})
    await expect(canvas).toHaveAttribute('data-illumination-counts',JSON.stringify(counts));expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(Number(await canvas.getAttribute('data-orbital-count')))
    await expect(page.getByTestId('selected-illumination')).toHaveAttribute('data-study-time',String(time));await expect(page.getByTestId('selected-illumination')).toHaveAttribute('data-illumination',time===frames[2]?'sunlit':'umbra')
    const weights=orbitalTrailSamples(orbit,time).map(x=>illuminationWeight(illumination(x.world,earthFixedSun(x.time)).transition));expect(JSON.parse((await canvas.getAttribute('data-selected-trail-weights'))!)).toEqual(weights)
    await expect(page.getByRole('button',{name:'Inspect ISS',exact:true})).toBeVisible()
  }
  await clock.fill(String(frames[0]));await expect(canvas).toHaveAttribute('data-study-time',String(frames[0]));await expect(canvas).toHaveAttribute('data-iss-illumination','umbra');await expect(canvas).toHaveAttribute('data-iss-light','0.500000')
  await page.getByRole('button',{name:'Watch Sydney pass',exact:true}).click();await expect(canvas).toHaveAttribute('data-camera-phase','Looking up');await expect(canvas).toHaveAttribute('data-iss-light','0.500000');await page.screenshot({path:info.outputPath('shadowed-iss-sky.png')})
  await page.getByRole('button',{name:'Show panels',exact:true}).click();await expect(page.getByTestId('selected-illumination')).toHaveText('Earth shadow (umbra)');await page.getByRole('button',{name:'Seek to pass peak',exact:true}).click();await expect(canvas).toHaveAttribute('data-iss-illumination','umbra')
  await page.getByRole('button',{name:'Hide panels',exact:true}).click();await expect(page.getByRole('button',{name:'Inspect ISS',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('shadowed-iss-culmination.png')})
})
