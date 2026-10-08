import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {openingReveal,moverEmphasis,familyReading} from './introduction'
import {type PopulationFrame,readCohorts} from './cohorts'
import {EARTH_RADIUS_KM,earthSurface,observerNormal} from './camera'
const manifest=JSON.parse(readFileSync('public/data/zenit-manifest.json','utf8'))
const source=readCohorts(JSON.parse(readFileSync('public/data/'+manifest.evidence.orbital.file,'utf8')))
describe('orbital introduction',()=>{
  it('blends each family and the ISS without changing shared identity membership',()=>{
    for(const [t,focus] of [[2000,'stations'],[6000,'gnss'],[10000,'geo'],[14000,'iss']] as const){const reveal=openingReveal(t)!;expect(reveal.focus).toBe(focus);expect(reveal.weights[focus]).toBe(1);expect(Object.values(reveal.weights).reduce((a,b)=>a+b,0)).toBe(1)}
    const blend=openingReveal(8000)!;expect(moverEmphasis(['gnss','geo'],'100',blend)).toBeCloseTo(.5)
    expect(moverEmphasis(['stations'],'25544',openingReveal(14000))).toBe(1)
    expect(moverEmphasis(['gnss'],'100',openingReveal(14000))).toBe(0)
    expect(openingReveal(16000)).toBeNull();expect(openingReveal(-1)).toBeNull();expect(moverEmphasis(['geo'],'100',null)).toBe(1)
    for(let t=0;t<16000;t+=31){const w=Object.values(openingReveal(t)!.weights);expect(w.every(x=>x>=0&&x<=1)).toBe(true);expect(w.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12)}
  })
  it('reports WGS84 height and mean period only for eligible independent identities',()=>{
    const snapshot={...source,movers:source.movers.slice(0,3).map((m,i)=>({...m,id:i===0?'25544':String(100+i),groups:i===0?['stations' as const]:i===1?['gnss' as const,'geo' as const]:['gnss' as const],element:{...m.element,MEAN_MOTION:i===0?16:i===1?2:1}}))}
    const at=(height:number)=>earthSurface(45,30).addScaledVector(observerNormal(45,30),height/EARTH_RADIUS_KM).toArray()
    const frame:PopulationFrame={trailsRequested:false,surfaceTrails:[],time:1234,revision:0,positions:new Float64Array([...at(400),...at(20000),...at(36000)]),availability:new Uint8Array([1,1,0])}
    expect(familyReading(snapshot,frame,'stations')!.heightKm).toBeCloseTo(400,6)
    expect(familyReading(snapshot,frame,'iss')).toMatchObject({count:1,meanPeriodMinutes:90,time:1234})
    expect(familyReading(snapshot,frame,'gnss')).toMatchObject({count:1,meanPeriodMinutes:720,time:1234})
    expect(familyReading(snapshot,frame,'geo')!.heightKm).toBeCloseTo(20000,6)
    frame.availability[2]=1;expect(familyReading(snapshot,frame,'gnss')!.heightKm).toBeCloseTo(28000,6);expect(familyReading(snapshot,frame,'gnss')!.meanPeriodMinutes).toBe(1080)
    frame.availability.fill(2);expect(familyReading(snapshot,frame,'gnss')).toBeNull();expect(familyReading(snapshot,null,'stations')).toBeNull()
  })
})
