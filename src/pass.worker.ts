import {json2satrec} from 'satellite.js'
import {searchPasses,recommendedPass} from './pass-search.mjs'
import {validObserver} from './observer'
const scope=self as unknown as {onmessage:((e:MessageEvent)=>void)|null;postMessage:(v:unknown)=>void}
scope.onmessage=(event:MessageEvent)=>{const v=event.data;try{if(!validObserver(v.observer)||!Array.isArray(v.elements)||v.elements.length>2||!Number.isFinite(v.start)||!Number.isFinite(v.end)||v.end-v.start!==43200000)throw Error('Invalid pass request');const passes=v.elements.flatMap((element:Record<string,unknown>)=>{const epoch=Date.parse(String(element.EPOCH));return searchPasses({baseline:json2satrec(element as never,'a'),epoch,start:Math.max(v.start,epoch-86400000),end:Math.min(v.end,epoch+86400000)},v.observer,String(element.NORAD_CAT_ID),String(element.OBJECT_NAME))});scope.postMessage({revision:v.revision,passes,recommended:recommendedPass(passes)})}catch{scope.postMessage({revision:v.revision,error:true})}}
