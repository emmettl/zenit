import {alive,ENTRY_HEIGHT,type Experiment} from './collision-model'
import {FAMILY_COLOURS} from './collision-glyphs'
const NS='http://www.w3.org/2000/svg'
/** Gabbard-style perigee/apogee plot of the synthetic release orbits. */
export function mountSpreadView(host:HTMLElement){
  host.innerHTML='<h3>One event, many orbits</h3><p class="spread-description">Each pair of marks is one sample’s perigee and apogee, against its orbital period. Earth’s oblateness turns the planes; it does not widen this height range by itself.</p><svg viewBox="0 0 320 205" role="img" aria-label="Synthetic perigee and apogee against orbital period"></svg><p class="spread-legend">● apogee · ○ perigee · dim: removed/consumed<br><span class="family-a">A</span> / <span class="family-b">B</span> / <span class="family-c">secondary C</span></p><p class="spread-summary"></p>'
  const svg=host.querySelector('svg')!,summary=host.querySelector('.spread-summary')!
  let previous:Experiment|undefined,marks:Array<{group:SVGGElement;index:number}>=[]
  function tag(name:string,attrs:Record<string,string|number>){const node=document.createElementNS(NS,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node}
  function initialise(run:Experiment){
    previous=run;svg.replaceChildren();marks=[]
    const minimum=Math.floor(Math.min(...run.samples.map(s=>s.orbit.period/60))/10)*10,maximum=Math.ceil(Math.max(...run.samples.map(s=>s.orbit.period/60))/10)*10
    const top=Math.max(2000,Math.ceil(Math.max(...run.samples.map(s=>s.orbit.apogee))/1000)*1000),bottom=Math.min(0,Math.floor(Math.min(...run.samples.map(s=>s.orbit.perigee))/500)*500),x=(p:number)=>40+(p-minimum)/(maximum-minimum)*264,y=(h:number)=>174-(h-bottom)/(top-bottom)*145
    for(const height of [...new Set([bottom,0,top/2,top])]){svg.append(tag('path',{d:`M40 ${y(height)}H304`,class:'spread-grid'}));const text=tag('text',{x:34,y:y(height)+3,'text-anchor':'end'});text.textContent=String(height);svg.append(text)}
    for(const period of [minimum,(minimum+maximum)/2,maximum]){const text=tag('text',{x:x(period),y:189,'text-anchor':'middle'});text.textContent=String(Math.round(period));svg.append(text)}
    const axis=tag('text',{x:174,y:203,'text-anchor':'middle'});axis.textContent='Period / minutes';svg.append(axis)
    const title=tag('text',{x:40,y:15});title.textContent='Height / km';svg.append(title)
    svg.append(tag('path',{d:`M40 ${y(ENTRY_HEIGHT)}H304`,class:'entry-boundary'}))
    run.samples.forEach((s,index)=>{
      const group=tag('g',{'data-family':s.family,stroke:FAMILY_COLOURS[s.family],fill:FAMILY_COLOURS[s.family]}) as SVGGElement,px=x(s.orbit.period/60)
      group.append(tag('circle',{cx:px,cy:y(s.orbit.apogee),r:1.5,stroke:'none'}),tag('circle',{cx:px,cy:y(s.orbit.perigee),r:1.5,fill:'none','stroke-width':.7}));svg.append(group);marks.push({group,index})
    })
  }
  return {render(run:Experiment,time:number){
    if(previous!==run)initialise(run)
    for(const {group,index}of marks){const s=run.samples[index];group.style.display=time<s.born?'none':'';group.style.opacity=alive(s,time)?'.7':'.13'}
    const active=run.samples.filter(s=>alive(s,time)),entered=run.samples.filter(s=>time>=s.born+s.orbit.entryTime).length,secondary=run.secondary&&time>=run.secondary.time
    const lo=active.length?Math.min(...active.map(s=>s.orbit.perigee)):0,hi=active.length?Math.max(...active.map(s=>s.orbit.apogee)):0
    summary.textContent=`${active.length} active samples · ${entered} crossed the prescribed 120 km entry boundary. Active release orbits span ${Math.round(lo).toLocaleString('en-GB')}–${Math.round(hi).toLocaleString('en-GB')} km in perigee/apogee.${secondary?' The new C family is included.':''}`
  }}
}
