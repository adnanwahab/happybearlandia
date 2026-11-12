import {test,expect} from 'bun:test';
import {createDemoController} from '../world/future-machine/demo-controller.js';
test('guided clock pauses, resumes and highlights an actual supplied change once',()=>{
 let time=0,tick,cleared=0;const months=[],highlights=[],states=[];
 const controller=createDemoController({now:()=>time,schedule:fn=>(tick=fn,1),unschedule:()=>cleared++,onMonth:m=>months.push(m),onHighlight:p=>highlights.push(p),onState:s=>states.push(s)});
 controller.start({month:20,entity:{collection:'buildings',id:'recorded'}});expect(months.at(-1)).toBe(0);
 time=10000;tick();expect(months.at(-1)).toBe(20);expect(highlights).toHaveLength(1);
 controller.togglePause();time=30000;tick();expect(months.at(-1)).toBe(20);
 controller.togglePause();time=70000;tick();expect(months.at(-1)).toBe(120);expect(controller.getState().status).toBe('complete');expect(highlights).toHaveLength(1);expect(cleared).toBe(1);
 controller.dispose();expect(controller.getState().status).toBe('disposed');
});

test('recorded divergence holds six seconds and replay preserves the same month sequence',()=>{
 let time=0,tick;const months=[],highlights=[];const c=createDemoController({now:()=>time,schedule:f=>(tick=f,1),unschedule:()=>{},onMonth:m=>months.push(m),onHighlight:x=>highlights.push(x)});
 const stop={month:16,entity:{collection:'buildings',id:'recorded'}};
 c.start(stop);for(const t of [4000,9999,10000,13000,15999,16000,38000]){time=t;tick();}
 expect(months).toEqual([0,0,15,16,16,16,16,120]);expect(highlights).toEqual([stop]);
 c.start(stop);time+=10000;tick();expect(months.at(-1)).toBe(16);expect(highlights).toHaveLength(2);c.dispose();
});

test('preparation retains pause intent, restart resets it, and takeover cancels ticks',()=>{
 let time=0,tick;const months=[],states=[];
 const c=createDemoController({now:()=>time,schedule:f=>(tick=f,1),unschedule:()=>{},onMonth:m=>months.push(m),onState:s=>states.push(s)});
 c.prepare();c.togglePause();expect(c.getState()).toMatchObject({status:'preparing',paused:true});
 c.start(null,{paused:c.getState().paused});time=10000;tick();expect(months).toEqual([0]);
 c.togglePause();time=15000;tick();expect(c.getState().elapsedMs).toBe(5000);
 c.prepare();expect(c.getState()).toMatchObject({status:'preparing',paused:false,elapsedMs:0});
 c.start(null);c.takeover();time=60000;tick();expect(c.getState().status).toBe('manual');
 expect(states.at(-1).caption).toContain('Manual control');c.dispose();
});
