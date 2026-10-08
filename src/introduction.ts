import {eciToGeodetic} from 'satellite.js'
import {EARTH_RADIUS_KM,smoothBetween} from './camera'
import {type Cohorts,type PopulationFrame,type GroupId} from './cohorts'
export type RevealFocus=GroupId|'iss'
export const REVEAL_BEATS=[
  {focus:'stations',label:'Stations',title:'Near Earth, a quick orbit.'},
  {focus:'gnss',label:'Navigation',title:'Higher shells, a slower rhythm.'},
  {focus:'geo',label:'Geosynchronous',title:'Close to Earth’s turning rhythm.'},
  {focus:'iss',label:'ISS / ZARYA',title:'The same light above Sydney.'},
] as const
export interface Reveal {elapsed:number;focus:RevealFocus;index:number;weights:Record<RevealFocus,number>}
export function openingReveal(elapsed:number):Reveal|null {
  if(elapsed<0||elapsed>=16000)return null
  const index=Math.min(3,Math.floor(elapsed/4000)),weights={stations:1,gnss:0,geo:0,iss:0}
  for(let i=1;i<4;i++){const blend=smoothBetween(i*4000-300,i*4000+300,elapsed);weights[REVEAL_BEATS[i-1].focus]*=1-blend;weights[REVEAL_BEATS[i].focus]=blend}
  return {elapsed,focus:REVEAL_BEATS[index].focus,index,weights}
}
export function moverEmphasis(groups:readonly GroupId[],id:string,reveal:Reveal|null):number {
  if(!reveal)return 1
  return Math.max(id==='25544'?reveal.weights.iss:0,...groups.map(group=>reveal.weights[group]))
}
/** Caption medians use only eligible independent identities in the displayed
 * worker packet. Membership may overlap; an identity occurs once per group.
 * Input axes are Earth-fixed X / north-Y / west-Z in equatorial Earth radii.
 */
export function familyReading(snapshot:Cohorts|null,frame:PopulationFrame|null,focus:RevealFocus) {
  if(!snapshot||!frame)return null
  const heights:number[]=[],periods:number[]=[]
  snapshot.movers.forEach((mover,i)=>{
    if(frame.availability[i]!==1||(focus==='iss'?mover.id!=='25544':!mover.groups.includes(focus)))return
    const x=frame.positions[i*3]*EARTH_RADIUS_KM,y=-frame.positions[i*3+2]*EARTH_RADIUS_KM,z=frame.positions[i*3+1]*EARTH_RADIUS_KM
    // A zero rotation converts the already Earth-fixed vector to WGS84 height.
    const height=eciToGeodetic({x,y,z},0).height,period=1440/Number(mover.element.MEAN_MOTION)
    if(Number.isFinite(height)&&Number.isFinite(period)){heights.push(height);periods.push(period)}
  })
  if(!heights.length)return null
  const median=(values:number[])=>{values.sort((a,b)=>a-b);const middle=Math.floor(values.length/2);return values.length%2?values[middle]:(values[middle-1]+values[middle])/2}
  return {count:heights.length,heightKm:median(heights),meanPeriodMinutes:median(periods),time:frame.time}
}
