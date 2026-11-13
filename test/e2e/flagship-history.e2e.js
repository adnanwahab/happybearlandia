import {test,expect} from '@playwright/test';

test('full guided demo and timelapse keep history bounded and Canvas independent of Three',async({page,browserName})=>{
 const errors=[],three=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/vendor/three/'))three.push(r.url());});
 await page.addInitScript(({emulate})=>{
  if(location.pathname!=='/world/future-machine.html')return;
  const url=new URL(location.href);url.searchParams.set('renderer','canvas2d');history.replaceState(null,'',url);
  window.historyWrites=[];
  for(const name of ['replaceState','pushState']){
   const original=history[name].bind(history);
   history[name]=(...args)=>{
    const now=performance.now();
    if(emulate&&window.historyWrites.filter(t=>now-t<30000).length>=100)throw new DOMException('History write limit','SecurityError');
    window.historyWrites.push(now);return original(...args);
   };
  }
 },{emulate:browserName==='chromium'});
 await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.demo?.status),{timeout:65000}).toBe('complete');
 expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(120);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('Month 120');
 const seek=async month=>{
  const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');
 };
 await seek(0);
 await page.getByRole('button',{name:'Play timelapse',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month),{timeout:35000}).toBe(120);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.playing)).toBe(false);
 await seek(16);
 await page.getByRole('button',{name:'Play timelapse',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBeGreaterThan(16);
 await page.getByRole('button',{name:'Pause timelapse',exact:true}).click();
 const result=await page.evaluate(()=>({month:window.futureMachine.state.month,urlMonth:Number(new URL(location.href).searchParams.get('month')),error:window.futureMachine.state.error,writes:window.historyWrites.length}));
 expect(result.urlMonth).toBe(result.month);expect(result.error).toBeNull();expect(result.writes).toBeLessThan(20);
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');
 expect(three).toEqual([]);expect(errors).toEqual([]);
});
