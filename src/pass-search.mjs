import {sgp4,gstime,eciToEcf,ecfToLookAngles} from 'satellite.js'
import {Body,GeoVector,Rotation_EQJ_HOR,RotateVector,Observer} from 'astronomy-engine'
export function searchPasses(orbit,observer,objectId='25544',name='ISS / ZARYA'){
 const site={latitude:observer.latitude*Math.PI/180,longitude:observer.longitude*Math.PI/180,height:observer.heightKm},passes=[]
 const sample=time=>{if(time<orbit.start||time>orbit.end||Math.abs(time-orbit.epoch)>86400000)return null;const pv=sgp4({...orbit.baseline},(time-orbit.epoch)/60000);if(!pv)return null;const look=ecfToLookAngles(site,eciToEcf(pv.position,gstime(new Date(time))));return {time,altitude:look.elevation*180/Math.PI,azimuth:look.azimuth*180/Math.PI,rangeKm:look.rangeSat}}
 const crossing=(lo,hi)=>{const before=(sample(lo)?.altitude??-90)>0;while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(((sample(mid)?.altitude??-90)>0)===before)lo=mid;else hi=mid}return hi}
 let current=null
 for(let time=orbit.start;time<=orbit.end+20000;time+=20000){const value=time<=orbit.end?sample(time):null
  if(value&&value.altitude>0){current??={rise:time,peak:value,truncated:time===orbit.start};if(value.altitude>current.peak.altitude)current.peak=value}
  else if(current){if(!current.truncated&&time<=orbit.end){const rise=crossing(current.rise-20000,current.rise),set=crossing(time-20000,time);let peak=sample(Math.round(current.peak.time/1000)*1000)??current.peak
   for(let t=Math.ceil(Math.max(rise,peak.time-20000)/1000)*1000;t<=Math.min(set,current.peak.time+20000);t+=1000){const p=sample(t);if(p&&p.altitude>peak.altitude)peak=p}
   if(peak.altitude>=20){const date=new Date(peak.time),sun=RotateVector(Rotation_EQJ_HOR(date,new Observer(observer.latitude,observer.longitude,observer.heightKm*1000)),GeoVector(Body.Sun,date,false)),solar=Math.asin(sun.z/Math.hypot(sun.x,sun.y,sun.z))*180/Math.PI
    passes.push({objectId,name,riseUtc:new Date(rise).toISOString(),peakUtc:new Date(peak.time).toISOString(),setUtc:new Date(set).toISOString(),maximumElevationDegrees:peak.altitude,peakAzimuthDegrees:peak.azimuth,peakRangeKm:peak.rangeKm,solarAltitudeDegrees:solar,night:solar<=-6})}}
   current=null}
 }
 return passes
}
export function recommendedPass(passes){return [...passes].sort((a,b)=>Number(b.night)-Number(a.night)||Number(b.solarAltitudeDegrees<=-18)-Number(a.solarAltitudeDegrees<=-18)||b.maximumElevationDegrees-a.maximumElevationDegrees||a.peakUtc.localeCompare(b.peakUtc))[0]??null}
