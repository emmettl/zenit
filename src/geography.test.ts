import {describe,it,expect} from 'vitest'
import {earthGeometry,landAt,mapPoint} from './geography'
describe('Natural Earth geographic reference',()=>{
  it('retains continental interiors, ocean and polar geography',()=>{
    for(const [longitude,latitude] of [[135,-25],[-60,-5],[15,23],[0,-85]])expect(landAt(longitude,latitude)).toBe(true)
    for(const [longitude,latitude] of [[-150,0],[0,0],[80,-35]])expect(landAt(longitude,latitude)).toBe(false)
    expect(mapPoint(0,0)).toEqual([1024,512]);expect(mapPoint(-180,90)).toEqual([0,0]);expect(mapPoint(180,-90)).toEqual([2048,1024])
  })
  it('places texture Greenwich, east and west on the declared Earth axes without a mirror or half-turn',()=>{
    const geometry=earthGeometry(),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
    for(const [u,expected] of [[.5,[1,0,0]],[.75,[0,0,-1]],[.25,[0,0,1]]] as const){
      const index=Array.from({length:uv.count},(_,i)=>i).find(i=>Math.abs(uv.getX(i)-u)<1e-6&&Math.abs(uv.getY(i)-.5)<1e-6)!
      expect(index).toBeDefined();expect([position.getX(index),position.getY(index),position.getZ(index)].every((x,i)=>Math.abs(x-expected[i])<1e-6)).toBe(true)
    }geometry.dispose()
  })
})
