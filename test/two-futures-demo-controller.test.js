import {test,expect} from 'bun:test';
import {createDemoController} from '../world/future-machine/demo-controller.js';
test('guided clock pauses, resumes and highlights an actual supplied change once',()=>{
 let time=0,tick,cleared=0;const months=[],highlights=[],states=[];
 const controller=createDemoController({now:()=>time,schedule:fn=>(tick=fn,1),unschedule:()=>cleared++,onMonth:m=>months.push(m),onHighlight:p=>highlights.push(p),onState:s=>states.push(s)});
 controller.start({month:20,entity:{collection:'buildings',id:'recorded'}});expect(months.at(-1)).toBe(0);
 time=10000;tick();expect(months.at(-1)).toBe(21);expect(highlights).toHaveLength(1);
 controller.togglePause();time=30000;tick();expect(months.at(-1)).toBe(21);
 controller.togglePause();time=70000;tick();expect(months.at(-1)).toBe(120);expect(controller.getState().status).toBe('complete');expect(highlights).toHaveLength(1);expect(cleared).toBe(1);
 controller.dispose();expect(controller.getState().status).toBe('disposed');
});
