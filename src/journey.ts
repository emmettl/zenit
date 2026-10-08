import {smoothBetween} from './camera'
// Authored real-time composition. Every sky/body position still uses one dated UTC sample.
export const JOURNEY = {overview:8000,descent:12000,sky:28000,ascent:12000,fade:1000} as const
export const JOURNEY_DURATION=JOURNEY.overview+JOURNEY.descent+JOURNEY.sky+JOURNEY.ascent
export function journeySample(elapsed:number,initial:number,start:number,end:number) {
  const t=((elapsed%JOURNEY_DURATION)+JOURNEY_DURATION)%JOURNEY_DURATION
  const opening=Math.max(start,initial-JOURNEY.overview*600),last=Math.min(end,initial+JOURNEY.sky*10)
  let progress=0,time=opening,rate=(initial-opening)/JOURNEY.overview,stage='Orbital shells'
  if(t<JOURNEY.overview)time=opening+t*rate
  else if(t<JOURNEY.overview+JOURNEY.descent){progress=(t-JOURNEY.overview)/JOURNEY.descent;time=initial;rate=0;stage='Descending to Sydney'}
  else if(t<JOURNEY.overview+JOURNEY.descent+JOURNEY.sky){progress=1;rate=(last-initial)/JOURNEY.sky;time=initial+(t-JOURNEY.overview-JOURNEY.descent)*rate;stage='The sky above Sydney'}
  else{progress=1-(t-JOURNEY.overview-JOURNEY.descent-JOURNEY.sky)/JOURNEY.ascent;time=last;rate=0;stage='Returning to orbit'}
  const opacity=smoothBetween(0,JOURNEY.fade,t)*(1-smoothBetween(JOURNEY_DURATION-JOURNEY.fade,JOURNEY_DURATION,t))
  return {elapsed:t,progress,time,rate,stage,opacity}
}
