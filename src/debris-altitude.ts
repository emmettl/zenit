export const HEIGHT_BANDS=[
 {low:-Infinity,high:400,label:'Below 400 km'},
 ...[400,600,800,1000,1200,1400].map(low=>({low,high:low+200,label:`${low.toLocaleString('en')}–${(low+200).toLocaleString('en')} km`})),
 {low:1600,high:Infinity,label:'1,600 km and up'},
]
export const DEBRIS_FAMILIES=['iridium-33','cosmos-2251'] as const
export type DebrisFamily=typeof DEBRIS_FAMILIES[number]
export function heightBand(height:number):number {return Number.isFinite(height)?HEIGHT_BANDS.findIndex(b=>height>=b.low&&height<b.high):-1}
export function altitudeCounts(records:readonly {group:DebrisFamily}[],states:readonly ({height:number}|null)[],enabled:readonly string[]){
 const bins=HEIGHT_BANDS.map(()=>({'iridium-33':0,'cosmos-2251':0}))
 records.forEach((record,i)=>{const h=states[i]?.height,band=h===undefined?-1:heightBand(h);if(band>=0&&enabled.includes(record.group))bins[band][record.group]++})
 return bins
}
export interface HeightSample {time:number;height:number|null}
/** Exact eligible endpoints plus 30-second model samples. Nulls preserve calculation gaps. */
export function sampleHeightProfile(start:number,end:number,first:number,last:number,at:(time:number)=>number|null):HeightSample[]{
 const low=Math.max(start,first),high=Math.min(end,last);if(high<low)return[]
 const times=new Set([low,high]);for(let t=Math.ceil(low/30000)*30000;t<=high;t+=30000)times.add(t)
 return [...times].sort((a,b)=>a-b).map(time=>{const height=at(time);return{time,height:height!==null&&Number.isFinite(height)?height:null}})
}
export function profilePaths(samples:readonly HeightSample[],x:(time:number)=>number,y:(height:number)=>number):string {
 let connected=false,path='';for(const sample of samples){if(sample.height===null){connected=false;continue}path+=(connected?' L':' M')+x(sample.time).toFixed(2)+','+y(sample.height).toFixed(2);connected=true}return path.trim()
}
