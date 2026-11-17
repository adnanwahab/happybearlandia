import {test,expect} from 'bun:test';
import {createFirstPlayFunnel,visibleDivergence} from '../world/future-machine/first-play.js';

test('first-only milestones reject invalid transitions, isolate snapshots and stop after disposal',()=>{
 let clock=0,backend='pending';const funnel=createFirstPlayFunnel({now:()=>clock,renderer:()=>backend});
 expect(funnel.record('landing',{entry:'direct'})).toBe(false);
 backend='canvas2d';expect(funnel.record('landing',{entry:'direct',url:'secret'})).toBe(false);
 expect(funnel.record('landing',{entry:'direct'})).toBe(true);
 for(let i=0;i<100;i++)expect(funnel.record('landing',{entry:'direct'})).toBe(false);
 const snapshot=funnel.snapshot();snapshot[0].event.payload.entry='shared';expect(funnel.snapshot()[0].event.payload.entry).toBe('direct');
 clock=86400001;expect(funnel.record('first_input',{control:'policy'})).toBe(false);
 clock=1;funnel.dispose();expect(funnel.snapshot()).toEqual([]);expect(funnel.record('landing',{entry:'direct'})).toBe(false);
});

test('divergence uses recorded available paired differences and versions, never elapsed demo time',()=>{
 const h={schemaVersion:'future-machine.v1',modelVersion:'city-systems.1.1.0',seed:42};
 const diffs=Array.from({length:4},(_,month)=>({month,available:true,physicalCount:0,metrics:{homes:{status:'available',delta:month<2?0:4}}}));
 expect(visibleDivergence(h,diffs,0)).toBe(null);expect(visibleDivergence(h,diffs,1)).toBe(null);
 expect(visibleDivergence(h,diffs,2)).toEqual({source:'recorded-paired-history',modelVersion:h.modelVersion,dataVersion:h.schemaVersion,seed:42,month:2,scenario:'plan',synthetic:true});
 expect(visibleDivergence(null,diffs,3)).toBe(null);
 expect(visibleDivergence({...h,modelVersion:'unsupported'},diffs,3)).toBe(null);
 diffs[3].available=false;expect(visibleDivergence(h,diffs,3)).toBe(null);
 for(const d of diffs)d.available=false;expect(visibleDivergence(h,diffs,2)).toBe(null);
});


test('deferred milestones preserve action time and first settled result until measured readiness',()=>{
 let clock=0,backend='pending';const funnel=createFirstPlayFunnel({now:()=>clock,renderer:()=>backend});
 clock=15;expect(funnel.record('share',{method:'copy',result:'succeeded'},{deferUntilReady:true})).toBe(false);
 clock=20;funnel.record('share',{method:'copy',result:'failed'},{deferUntilReady:true});
 funnel.record('why_opened',{target:'recorded-event',private:'never retained'},{deferUntilReady:true});
 expect(funnel.snapshot()).toEqual([]);
 backend='canvas2d';clock=3000;funnel.flush();
 expect(funnel.snapshot()).toHaveLength(1);
 expect(funnel.snapshot()[0]).toMatchObject({renderer:'canvas2d',event:{elapsedMs:15,payload:{method:'copy',result:'succeeded'}}});
 funnel.flush();expect(funnel.snapshot()).toHaveLength(1);funnel.dispose();
});

test('disposal discards deferred milestones without publishing them',()=>{
 let backend='pending';const funnel=createFirstPlayFunnel({renderer:()=>backend});
 funnel.record('landing',{entry:'direct'},{deferUntilReady:true});funnel.dispose();backend='canvas2d';funnel.flush();expect(funnel.snapshot()).toEqual([]);
});
