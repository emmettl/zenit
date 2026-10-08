import {test,expect} from '@playwright/test'

test('rapid seeks retain one coherent scene, reject superseded packets and settle at the latest target',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  // Delay delivery of real worker results, rather than replacing orbital calculations.
  await page.addInitScript(()=>{
    const gate={held:false,queued:[] as (()=>void)[],release(){this.queued.shift()?.()}}
    Object.assign(window,{populationGate:gate})
    const OriginalWorker=window.Worker
    window.Worker=class extends OriginalWorker {
      private receiver:((event:MessageEvent)=>void)|null=null
      constructor(url:string|URL,options?:WorkerOptions){
        super(url,options)
        this.addEventListener('message',event=>{
          const deliver=()=>this.receiver?.(event)
          if(event.data.type==='frame'&&gate.held)gate.queued.push(deliver)
          else deliver()
        })
      }
      override get onmessage(){return this.receiver}
      override set onmessage(handler:((event:MessageEvent)=>void)|null){this.receiver=handler}
    }
  })
  await page.goto('/')
  const canvas=page.locator('canvas'),clock=page.getByRole('slider',{name:'Study time',exact:true})
  await expect(canvas).toHaveAttribute('data-orbital-count','616')
  await page.getByLabel('Satellite or attachment',{exact:true}).selectOption('26407')
  await page.getByRole('button',{name:'Focus and follow',exact:true}).click()
  await page.evaluate(()=>document.fonts.ready)
  const layout=()=>clock.evaluate(node=>{const scrubber=node.getBoundingClientRect(),panel=node.closest('.controls')!.getBoundingClientRect();return {scrubberTop:scrubber.top+scrollY,panelHeight:panel.height}})
  const settledLayout=await layout()
  const initial=await canvas.getAttribute('data-study-time'),iss=await canvas.getAttribute('data-iss-position'),target=await canvas.getAttribute('data-camera-target')
  const initialIllumination=await canvas.getAttribute('data-illumination-counts')
  const first=Number(initial)+60000,latest=Number(initial)+90000
  await page.evaluate(()=>{
    const state=window as unknown as {populationGate:{held:boolean};blankFrames:number}
    state.populationGate.held=true;state.blankFrames=0
    const canvas=document.querySelector('canvas')!
    new MutationObserver(()=>{if(Number(canvas.dataset.orbitalCount)===0)state.blankFrames++}).observe(canvas,{attributes:true,attributeFilter:['data-orbital-count']})
  })
  const queued=()=>page.evaluate(()=>(window as unknown as {populationGate:{queued:unknown[]}}).populationGate.queued.length)
  await clock.fill(String(first));await expect.poll(queued).toBe(1)
  await expect(canvas).toHaveAttribute('data-study-time',initial!)
  await expect(canvas).toHaveAttribute('data-orbital-count','616')
  await expect(canvas).toHaveAttribute('data-iss-position',iss!)
  await expect(canvas).toHaveAttribute('data-camera-target',target!)
  await expect(page.getByText('Updating orbital positions…',{exact:true})).toBeVisible()
  expect(await layout()).toEqual(settledLayout)
  await expect(canvas).toHaveAttribute('data-illumination-time',initial!)
  await expect(canvas).toHaveAttribute('data-illumination-counts',initialIllumination!)
  await clock.fill(String(Number(initial)+120000));await clock.fill(String(latest))
  await expect(clock).toHaveValue(String(latest))
  await page.evaluate(()=>(window as unknown as {populationGate:{release:()=>void}}).populationGate.release())
  await expect.poll(queued).toBe(1)
  // The obsolete first response must neither clear the retained scene nor move it.
  await expect(canvas).toHaveAttribute('data-study-time',initial!)
  await expect(canvas).toHaveAttribute('data-camera-target',target!)
  await page.evaluate(()=>{const gate=(window as unknown as {populationGate:{held:boolean;release:()=>void}}).populationGate;gate.held=false;gate.release()})
  await expect(canvas).toHaveAttribute('data-study-time',String(latest))
  await expect(canvas).toHaveAttribute('data-illumination-time',String(latest))
  await expect(page.getByTestId('study-time')).toHaveText('2026-10-07 17:58:49 UTC')
  await expect(canvas).not.toHaveAttribute('data-iss-position',iss!)
  await expect(canvas).not.toHaveAttribute('data-camera-target',target!)
  await expect(canvas).toHaveAttribute('data-following','26407')
  await expect(page.getByText('Updating orbital positions…',{exact:true})).toHaveCount(0)
  expect(await layout()).toEqual(settledLayout)
  expect(await page.evaluate(()=>(window as unknown as {blankFrames:number}).blankFrames)).toBe(0)
})
