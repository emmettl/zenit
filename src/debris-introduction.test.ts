import {describe,it,expect} from 'vitest'
import {debrisIntroduction} from './debris-introduction'
import {readDebris} from './debris'
import {readFileSync} from 'node:fs'
import index from './debris-release.json'
const release=JSON.parse(readFileSync('public/'+index.file.slice(2),'utf8'))
describe('bounded debris chapter',()=>{
 it('presents both complete families separately before combining them',()=>{expect(debrisIntroduction(0).groups).toEqual(['iridium-33']);expect(debrisIntroduction(8000).groups).toEqual(['cosmos-2251']);expect(debrisIntroduction(16000).groups).toEqual(['iridium-33','cosmos-2251']);expect(debrisIntroduction(24000).index).toBe(2)})
 it('reconciles source identities, parent roles and changing eligibility without a visual cap',()=>{const r=readDebris(release);expect(r.movers).toHaveLength(462);expect(r.movers.filter(m=>m.role==='original-catalogue-identity').map(m=>m.id)).toEqual(['22675','24946']);expect(r.groups.map(g=>[g.initialEligibleRecords,g.endEligibleRecords])).toEqual([[74,74],[388,380]])})
 it('rejects misattribution, duplicate identity, altered frames and extended age eligibility',()=>{for(const mutate of [(r:typeof release)=>r.movers[0].group='iridium-33',(r:typeof release)=>r.movers[1]=r.movers[0],(r:typeof release)=>r.movers[0].element.REF_FRAME='GCRS',(r:typeof release)=>r.movers[0].eligibleEndUtc='2026-11-02T00:00:00.000Z']){const r=structuredClone(release);mutate(r);expect(()=>readDebris(r)).toThrow()}})
})
