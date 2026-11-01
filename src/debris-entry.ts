import {loadDebris} from './debris'
import {mountDebrisChapter} from './debris-view.js'
const state=document.getElementById('chapter-state')!,retry=document.getElementById('retry') as HTMLButtonElement
let controller:AbortController|undefined
async function load(){controller?.abort();controller=new AbortController();state.hidden=false;state.textContent='Loading the retained debris study…';retry.hidden=true;try{const release=await loadDebris(controller.signal);mountDebrisChapter(release,{introduction:true});state.hidden=true;document.documentElement.dataset.chapter='ready'}catch(error){document.documentElement.dataset.chapter='error';state.textContent=error instanceof Error?error.message:'Debris study unavailable';retry.hidden=false}}
retry.onclick=()=>{if(document.querySelector('canvas'))location.reload();else void load()};void load()
