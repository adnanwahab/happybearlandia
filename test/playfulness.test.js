import {test,expect} from 'bun:test';
import {createExperiment, KEY} from '../world/playfulness/core.js';
function setup(random=()=>0) { const values=new Map(); const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}; let today=10; return {storage,values,next:()=>today++,make:(enabled=true)=>createExperiment({storage,enabled,random,day:()=>today})}; }
test('no consent, denial and kill switch collect nothing',()=>{
 const f=setup(), e=f.make(); expect(e.read()).toBeNull(); e.record('task'); expect(f.values.size).toBe(0);
 e.consent(); const disabled=f.make(false); expect(disabled.read()).toBeNull(); expect(disabled.consent()).toBeNull(); expect(f.values.size).toBe(0);
 expect(()=>createExperiment({enabled:true,storage:{getItem(){throw Error('denied')}}}).read()).toThrow('denied');
});
test('both assignments persist; declared denominators and deduplication',()=>{
 for(const [draw,arm] of [[0,'plain'],[.9,'playful']]) {const f=setup(()=>draw), e=f.make(); expect(e.consent().arm).toBe(arm); expect(()=>e.record('replay')).toThrow(); e.record('task'); e.record('task'); e.record('replay'); expect(e.summary().meaningfulReplay).toEqual({numerator:1,denominator:1}); expect(f.make().read().arm).toBe(arm); f.next(); const reload=f.make(); reload.read(); expect(reload.summary().returnVisit.numerator).toBe(1); e.withdraw(); expect(f.values.size).toBe(0); expect(e.summary().withdrawn).toBe(1); expect(f.make().summary()).toBeNull(); }
});
test('malformed records are erased without inventing observations',()=>{const f=setup();f.values.set(KEY,'{"version":"wrong"}');expect(f.make().read()).toBeNull();expect(f.values.size).toBe(0);});
test('withdrawal in another tab prevents stale writes',()=>{const f=setup(),a=f.make();a.consent();const b=f.make();b.read();a.withdraw();b.record('task');expect(f.values.size).toBe(0);expect(b.summary()).toBeNull();});
