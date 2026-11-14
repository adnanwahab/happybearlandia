import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Execute the normal Canvas2D entry's runWeek, not a duplicate controller.
const source=readFileSync(new URL('../world/canvas2d-world.js',import.meta.url),'utf8');
function fixture(failure,real=false){
  const nodes=Object.fromEntries(['cycleStatus','runCycleBtn','cycleRunState','cycleProgress','cycleCancel','policy','planYear','cyclePanel'].map(id=>[id,{value:id==='policy'?'balanced':3,style:{},removeAttribute(){delete this.value;},replaceChildren(){},append(){}}]));
  const workers=[],events=[];let deadline;
  const context={URL,Error,Number,Math,document:{createElement:()=>({})},$:id=>nodes[id],notify:(...args)=>events.push(args),
    setTimeout(fn,ms){if(real)return setTimeout(fn,ms);deadline=fn;return 1;},clearTimeout(id){if(real)clearTimeout(id);else deadline=null;},
    Worker:class {constructor(){if(real){const worker=new Worker(new URL('../world/cycle.worker.js',import.meta.url),{type:'module'});workers.push(worker);return worker;}if(failure==='constructor')throw new Error('constructor failed');workers.push(this);}terminate(){this.terminated=true;}postMessage(msg){this.payload=msg;if(failure==='post')throw new Error('post failed');}}};
  const functions=source.slice(source.indexOf('function runWeek(){'),source.indexOf('\nlet townArea='))
    .replace('import.meta.url',JSON.stringify('http://localhost/world/canvas2d-world.js'));
  runInNewContext(`let weeklyPromise=null,cancelWeek=null;const origin={lat:29.7286,lng:-95.4746},townArea={source:'none'},town={people:Array(${real?16:2}).fill({})},planDefinitions={balanced:{ids:${JSON.stringify(real?['t_brt','h_lots','f_drainage','s_311']:['t_brt'])},label:'Balanced'}};${functions};globalThis.api={runWeek,cancel:()=>cancelWeek?.()};`,context);
  return {...context.api,nodes,workers,events,expire:()=>deadline()};
}
const result={avg:{noPlan:40,withPlan:43},improved:2,worse:0};
test('Canvas weekly comparison reports progress and opens actual returned metrics',async()=>{
  const f=fixture(),pending=f.runWeek(),w=f.workers[0];
  expect(f.runWeek()).toBe(pending);
  expect(f.nodes.cycleRunState.textContent).toBe('Running');
  expect(f.nodes.cycleCancel.hidden).toBe(false);
  expect(w.payload.payload).toMatchObject({days:7,maxPeople:2,proposalIds:['t_brt'],year:3});
  w.onmessage({data:{type:'progress',stage:'Simulating without the plan',frac:.25}});
  expect(f.nodes.cycleProgress.value).toBe(.25);
  w.onmessage({data:{type:'unrelated'}});expect(w.terminated).toBeUndefined();
  w.onmessage({data:{type:'done',result}});
  expect(await pending).toBe(result);
  expect(f.nodes.cyclePanel.style.display).toBe('block');
  expect(f.events[0][1].metrics[2].value).toBe('+3.0');
  expect(f.nodes.cycleRunState.textContent).toBe('Completed');
  expect(f.nodes.cycleProgress.hidden).toBe(true);
  expect(w.terminated).toBe(true);
});
test('Canvas cancel rejects waiter and ignores late completion during retry',async()=>{
  const f=fixture(),pending=f.runWeek(),old=f.workers[0];
  f.cancel();await expect(pending).rejects.toThrow('cancelled');
  expect(f.nodes.cycleRunState.textContent).toBe('Cancelled');
  expect(f.nodes.cycleCancel.hidden).toBe(true);
  expect(f.nodes.runCycleBtn.disabled).toBe(false);
  const retry=f.runWeek();old.onmessage({data:{type:'done',result}});old.onerror({message:'stale error'});
  expect(f.nodes.cycleRunState.textContent).toBe('Running');expect(f.events).toHaveLength(0);
  f.workers[1].onmessage({data:{type:'done',result}});await retry;
  expect(f.nodes.cycleRunState.textContent).toBe('Completed');
});
test('Canvas failures clean up and permit retry, including synchronous startup failures',async()=>{
  for(const mode of ['constructor','post','error','messageerror','timeout','worker','malformed']){
    const f=fixture(mode),pending=f.runWeek(),w=f.workers[0];
    if(mode==='error')w.onerror({message:'load failed'});
    if(mode==='messageerror')w.onmessageerror();
    if(mode==='timeout')f.expire();
    if(mode==='worker')w.onmessage({data:{type:'error',error:'simulation failed'}});
    if(mode==='malformed')w.onmessage({data:{type:'done'}});
    await expect(pending).rejects.toThrow();
    expect(f.nodes.cycleRunState.textContent).toBe('Failed');
    expect(f.nodes.cycleStatus.textContent).toContain('retry');
    expect(f.nodes.runCycleBtn.disabled).toBe(false);
    expect(f.nodes.cycleProgress.hidden).toBe(true);
    if(w)expect(w.terminated).toBe(true);
    const retry=f.runWeek();
    if(['constructor','post'].includes(mode))await expect(retry).rejects.toThrow();
    else {f.workers.at(-1).onmessage({data:{type:'done',result}});await retry;expect(f.nodes.cycleRunState.textContent).toBe('Completed');}
  }
});

test('Canvas entry runs real Balanced worker and publishes its paired metrics',async()=>{
  const f=fixture(undefined,true),started=performance.now();
  try {
    const r=await f.runWeek();
    expect(r.proposalIds).toEqual(['t_brt','h_lots','f_drainage','s_311']);
    expect(r.days).toBe(7);expect(r.year).toBe(3);
    expect(r.scores.noPlan).toHaveLength(16);
    expect(Number.isFinite(r.avg.withPlan)).toBe(true);
    expect(f.nodes.cycleRunState.textContent).toBe('Completed');
    expect(f.nodes.cyclePanel.style.display).toBe('block');
    expect(f.events.at(-1)[1].metrics[0].value).toBe(r.avg.noPlan.toFixed(1));
    console.log('Canvas runWeek + real worker integration: '+(performance.now()-started).toFixed(1)+'ms; 16 procedural residents; Balanced recipe');
  }finally{f.cancel();f.workers.forEach(worker=>worker.terminate());}
},30000);
