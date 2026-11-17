import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Exercise the renderer's actual lifecycle without initializing its GPU scene.
const source = readFileSync(new URL('../world/render.js', import.meta.url), 'utf8');
function fixture() {
  const nodes = Object.fromEntries(['runCycleBtn','cycleNext','cycleRunState','cycleProgress','cycleCancel','cycleStatus'].map(id=>[id,{textContent:'',removeAttribute(){delete this.value;},addEventListener(_,fn){this.click=fn;}}]));
  const workers=[]; let deadline, completed=0;
  const context = {URL,Math,Number,String,Error,$:id=>nodes[id],worldFeedback(){},
    setTimeout(fn){deadline=fn;return 1;},clearTimeout(){deadline=null;},
    onCycleDone(){completed++;},
    createTrackedWorker(){const w={terminate(){this.terminated=true;}};workers.push(w);return w;}};
  const functions=source.slice(source.indexOf('function setCycleBusy('),source.indexOf('\nfunction runCycle() {')).replace('import.meta.url',JSON.stringify('http://localhost/world/render.js'));
  const vm={...context};
  runInNewContext(`let cycleResults=[],cycleBusy=false,cycleWorker=null,cycleDeadline=null,cycleWaiter=null;\n${functions}\nglobalThis.api={start(){setCycleBusy(true);startCycleWorker();}};`,vm);
  return {nodes,workers,start:()=>vm.api.start(),expire:()=>deadline(),completed:()=>completed};
}
test('weekly progress, cancellation and late worker replies stay consistent',()=>{
  const f=fixture();f.start();const worker=f.workers.at(-1);
  expect(f.nodes.cycleRunState.textContent).toBe('Running');
  worker.onmessage({data:{type:'progress',stage:'Simulating without the plan',frac:.25}});
  expect(f.nodes.cycleProgress.value).toBe(.25);
  f.nodes.cycleCancel.click();
  expect(worker.terminated).toBe(true);
  expect(f.nodes.cycleRunState.textContent).toBe('Cancelled');
  expect(f.nodes.runCycleBtn.disabled).toBe(false);
  worker.onmessage({data:{type:'done',result:{}}});expect(f.completed()).toBe(0);
  f.start();worker.onerror({message:'stale failure'});
  expect(f.nodes.cycleRunState.textContent).toBe('Running');
});
test('native worker failure, unreadable messages and timeout enable retry',()=>{
  for(const failure of ['error','messageerror','timeout']){
    const f=fixture();f.start();const w=f.workers.at(-1);
    if(failure==='error')w.onerror({message:'load failed'});
    else if(failure==='messageerror')w.onmessageerror();else f.expire();
    expect(f.nodes.cycleRunState.textContent).toBe('Failed');
    expect(f.nodes.cycleStatus.textContent).toContain('retry');
    expect(f.nodes.cycleProgress.hidden).toBe(true);
    expect(f.nodes.runCycleBtn.disabled).toBe(false);
    f.start();expect(f.nodes.cycleRunState.textContent).toBe('Running');
  }
});
