import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { blockedByEarth, horizonReading, readCatalogue, skyDirections, starColour } from './stellar'
import reference from './stellar-reference.json'

const manifest=JSON.parse(readFileSync('public/data/zenit-manifest.json','utf8'))
const raw=JSON.parse(readFileSync('public/data/'+manifest.evidence.stellar.file,'utf8'))
const catalogue=readCatalogue(raw)

describe('HYG bright-star evidence',()=>{
  it('reconciles the complete selected population, missing values and named anchors',()=>{
    expect(catalogue.stars).toHaveLength(5070)
    expect(catalogue.stars.filter(x=>x.name)).toHaveLength(428)
    expect(catalogue.stars.filter(x=>x.distance===null)).toHaveLength(104)
    expect(catalogue.stars.filter(x=>x.bv===null)).toHaveLength(23)
    expect(catalogue.stars.filter(x=>x.variable)).toHaveLength(778)
    expect(catalogue.stars.every(x=>x.mag<=6&&x.hyg>0)).toBe(true)
    expect(raw.statistics.sourceRecords).toBe(5070+114543+1)
    expect(catalogue.stars.find(x=>x.name==='Sirius')).toMatchObject({id:'hyg-v44:32263',mag:-1.44})
    expect(catalogue.stars.find(x=>x.name==='Canopus')).toMatchObject({id:'hyg-v44:30365',mag:-0.62})
  })
  it('rejects duplicate identities, non-finite coordinates and unnormalized distances',()=>{
    for(const change of [(x: { rows: unknown[][]; frame: string })=>{x.rows[1][0]=x.rows[0][0]},(x: { rows: unknown[][]; frame: string })=>{x.rows[0][8]=NaN},(x: { rows: unknown[][]; frame: string })=>{x.rows[0][12]=100000},(x: { rows: unknown[][]; frame: string })=>{x.frame='TEME'}]) {
      const data=structuredClone(raw);change(data);expect(()=>readCatalogue(data)).toThrow()
    }
  })
  it('keeps missing colour distinct from a measured zero index',()=>{
    expect(starColour(null)).not.toEqual(starColour(0))
  })
})

describe('celestial orientation and occultation',()=>{
  it('agrees with twelve independently generated Astropy/ERFA sky directions within one arcminute',()=>{
    for(const c of reference.cases) {
      const star=catalogue.stars.find(x=>x.id===c.id)!
      const direction=skyDirections([star],c.time)[0]
      const actual=horizonReading(direction,c.latitude,c.longitude)
      const altitude=actual.altitude*Math.PI/180,azimuth=actual.azimuth*Math.PI/180
      const vector=new Vector3(Math.cos(altitude)*Math.sin(azimuth),Math.cos(altitude)*Math.cos(azimuth),Math.sin(altitude))
      expect(vector.angleTo(new Vector3(...c.eastNorthUp))*180/Math.PI*60).toBeLessThan(1)
    }
  })
  it('distinguishes an Earth-blocked direction from an unobstructed one',()=>{
    const position=new Vector3(4,0,0)
    expect(blockedByEarth(position,new Vector3(-1,0,0))).toBe(true)
    expect(blockedByEarth(position,new Vector3(1,0,0))).toBe(false)
    expect(blockedByEarth(position,new Vector3(0,1,0))).toBe(false)
  })
})
