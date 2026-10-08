import {useEffect,useState} from 'react'
import type {ObserverLocation} from './observer'
import {observerKey} from './observer'
import type {Cohorts} from './cohorts'
import type {Orbit} from './orbital'
import type {StationPass} from './pass-search.mjs'
export function usePasses(orbit:Orbit|null,cohorts:Cohorts|null,observer:ObserverLocation,curated:StationPass|undefined){
 const [result,setResult]=useState<{key:string;pass:StationPass|null;state:string}>({key:'',pass:null,state:'loading'}),key=orbit?[orbit.epoch,orbit.start,orbit.end,observerKey(observer)].join(':'):''
 const usable=curated&&(curated.objectId==='25544'?Boolean(orbit):Boolean(cohorts?.movers.some(x=>x.id===curated.objectId)))
 useEffect(()=>{if(!orbit||usable)return;let worker:Worker;try{worker=new Worker(new URL('./pass.worker.ts',import.meta.url),{type:'module'})}catch{setResult({key,pass:null,state:'error'});return}setResult({key,pass:null,state:'loading'});worker.onmessage=e=>{if(e.data.revision===key)setResult({key,pass:e.data.recommended??null,state:e.data.error?'error':'ready'})};worker.onerror=()=>setResult({key,pass:null,state:'error'});const elements=cohorts?cohorts.movers.filter(x=>['25544','48274'].includes(x.id)).map(x=>x.element):orbit.release.elements;worker.postMessage({revision:key,start:orbit.start,end:orbit.end,observer,elements});return()=>worker.terminate()},[key,orbit,cohorts,usable])
 return usable?{pass:curated!,state:'ready'}:result.key===key?result:{pass:null,state:'loading'}
}
