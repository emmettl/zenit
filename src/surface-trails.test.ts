import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {PerspectiveCamera,Vector3} from 'three'
import {createPopulation,populationFrame,readCohorts} from './cohorts'
import {earthFixedSun,illumination,illuminationWeight} from './illumination'
import {orbitalState} from './orbital'
import {cameraPose,earthSurface,observerNormal,OBSERVER,EARTH_RADIUS_KM} from './camera'
import {surfaceTrailVertices,validSurfaceTrails,SURFACE_TRAIL_CANDIDATES,SURFACE_TRAIL_SAMPLES} from './surface-trails'
const manifest=JSON.parse(readFileSync('public/data/zenit-manifest.json','utf8')),snapshot=readCohorts(JSON.parse(readFileSync('public/data/'+manifest.evidence.orbital.file,'utf8'))),population=createPopulation(snapshot),time=Date.parse('2026-10-07T17:58:49Z'),up=observerNormal(OBSERVER.latitude,OBSERVER.longitude),site=earthSurface(OBSERVER.latitude,OBSERVER.longitude).addScaledVector(up,OBSERVER.heightKm/EARTH_RADIUS_KM)
describe('surface motion tails',()=>{
  it('samples bounded unique independent movers with exact packet heads and direct SGP4 histories',()=>{
    const frame=populationFrame(population,time,4,true)
    expect(validSurfaceTrails(frame,snapshot.movers.length)).toBe(true);expect(frame.surfaceTrails.length).toBeGreaterThan(3);expect(frame.surfaceTrails.length).toBeLessThanOrEqual(SURFACE_TRAIL_CANDIDATES)
    for(const path of frame.surfaceTrails){
      expect(snapshot.movers[path.index].id).not.toBe('25544')
      expect(Array.from(path.positions.slice(-3))).toEqual(Array.from(frame.positions.slice(path.index*3,path.index*3+3)))
      for(let i=0;i<SURFACE_TRAIL_SAMPLES;i++){const direct=orbitalState(population.propagators[path.index],time-(15-i)*3000);expect(path.valid[i]).toBe(direct&&direct.world.clone().sub(site).dot(up)>0?1:0);if(path.valid[i])expect(new Vector3().fromArray(path.positions,i*3).distanceTo(direct!.world)).toBeLessThan(1e-12)}
    }
    expect(populationFrame(population,time).surfaceTrails).toEqual([])
  })
  it('is independent of forward, reverse and loop seeks and clips samples at eligibility boundaries',()=>{
    const frame=populationFrame(population,time,0,true)
    populationFrame(population,Date.parse(snapshot.study.endUtc),8,true);populationFrame(population,Date.parse(snapshot.study.startUtc),9,true)
    expect(populationFrame(population,time,0,true)).toEqual(frame)
    const orbit=population.propagators[frame.surfaceTrails[0].index],start=orbit.start;orbit.start=time-15000
    const clipped=populationFrame(population,time,2,true).surfaceTrails.find(x=>x.index===frame.surfaceTrails[0].index)
    // A candidate without a valid past endpoint is omitted rather than bridged.
    expect(clipped).toBeUndefined();orbit.start=start
  })
  it('selects at most two phone or three desktop tails, honours filters and selection and fades real segments',()=>{
    const frame=populationFrame(population,time,0,true),pose=cameraPose(1),camera=new PerspectiveCamera(100,1280/720,.0000001,100);camera.position.copy(pose.position)
    const head=new Vector3().fromArray(frame.surfaceTrails[0].positions,45);camera.lookAt(head);camera.updateMatrixWorld()
    const desktop=surfaceTrailVertices(frame,snapshot,camera,['stations','gnss','geo'],undefined,1280,720,[])
    expect(desktop.visible.length).toBeGreaterThan(0);expect(desktop.visible.length).toBeLessThanOrEqual(3);expect(desktop.alphas.every(x=>x>=0&&x<=.34)).toBe(true);expect(desktop.alphas).toContain(0)
    camera.aspect=390/664;camera.updateProjectionMatrix()
    const phone=surfaceTrailVertices(frame,snapshot,camera,['stations','gnss','geo'],undefined,390,664,[]);expect(phone.visible.length).toBeGreaterThan(0);expect(phone.visible.length).toBeLessThanOrEqual(2)
    const firstId=phone.visible[0].id,path=frame.surfaceTrails.find(x=>snapshot.movers[x.index].id===firstId)!
    const expected:number[]=[];for(let i=1;i<SURFACE_TRAIL_SAMPLES;i++)if(path.valid[i-1]&&path.valid[i])for(const j of [i-1,i])expected.push(.34*(j/15)**1.4*illuminationWeight(illumination(new Vector3().fromArray(path.positions,j*3),earthFixedSun(time-(15-j)*3000)).transition))
    expect(phone.alphas.slice(0,expected.length)).toEqual(expected)
    expect(surfaceTrailVertices(frame,snapshot,camera,[],undefined,390,664,[]).visible).toEqual([])
    expect(surfaceTrailVertices(frame,snapshot,camera,['stations','gnss','geo'],phone.visible[0].id,390,664,[]).visible.some(x=>x.id===phone.visible[0].id)).toBe(false)
    expect(surfaceTrailVertices(frame,snapshot,camera,['stations','gnss','geo'],undefined,390,664,[{x:0,y:0,width:390,height:664}]).visible).toEqual([])
    const single={...frame,surfaceTrails:[frame.surfaceTrails[0]]};single.surfaceTrails[0].valid[5]=0
    const gaps=surfaceTrailVertices(single,snapshot,camera,['stations','gnss','geo'],undefined,390,664,[]);expect(gaps.visible[0].segments).toBe(13)
  })
  it('rejects malformed or duplicated worker trail buffers',()=>{
    const frame=populationFrame(population,time,0,true)
    expect(validSurfaceTrails({...frame,surfaceTrails:[frame.surfaceTrails[0],frame.surfaceTrails[0]]},635)).toBe(false)
    expect(validSurfaceTrails({...frame,surfaceTrails:[{...frame.surfaceTrails[0],positions:new Float64Array(2)}]},635)).toBe(false)
    expect(validSurfaceTrails({...frame,trailsRequested:false},635)).toBe(false)
  })
})
