import {test,expect} from 'bun:test';
import {advanceFrameMinutes,createObservedClock} from '../world/render/frame-work.js';
test('fixed-minute catchup yields within budget and retains all pending minutes',()=>{
 let time=0,total=0,pending=240;
 while(pending){const n=advanceFrameMinutes(pending,minute=>{expect(minute).toBe(1);total++;time+=3},{now:()=>time,budgetMs:4});expect(n).toBeLessThanOrEqual(2);pending-=n;}
 expect(total).toBe(240);
});
test('cheap minutes are bounded by count, no steps when fractional or paused',()=>{
 let total=0;expect(advanceFrameMinutes(240,()=>total++,{now:()=>0})).toBe(8);expect(total).toBe(8);
 expect(advanceFrameMinutes(.9,()=>total++)).toBe(0);
});
test('observed presentation clock stays between observations and freezes on pause/reset',()=>{
 const clock=createObservedClock();expect(clock.sample(360,0,{runId:'a'})).toBe(360);
 expect(clock.sample(361,100,{runId:'a'})).toBe(360);expect(clock.sample(361,150,{runId:'a'})).toBe(360.5);
 expect(clock.sample(361,300,{runId:'a'})).toBe(361);
 expect(clock.sample(362,400,{runId:'a',paused:true})).toBe(362);
 expect(clock.sample(20,500,{runId:'b'})).toBe(20);
});
