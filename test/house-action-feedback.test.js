import {test,expect} from 'bun:test';
import {createActionFeedback} from '../world/house/action-feedback.js';
test('pending precedes acknowledgment; rapid work runs and settles in submission order, including rejection',async()=>{
 const events=[],calls=[],f=createActionFeedback(e=>events.push(e));let release;
 const first=f.run(()=>{calls.push(1);return new Promise(resolve=>release=resolve);},{type:'read',personId:'p1'});
 const second=f.run(()=>{calls.push(2);throw Error('Occupied');},{type:'sit'});const rejected=second.catch(e=>e.message);
 expect(events.map(e=>e.state)).toEqual(['pending','pending']);await Promise.resolve();expect(calls).toEqual([1]);expect(events.some(e=>e.state==='completed')).toBe(false);
 release({accepted:true,actionId:'actual-1'});await first;expect(await rejected).toBe('Occupied');expect(calls).toEqual([1,2]);expect(events.map(e=>[e.sequence,e.state])).toEqual([[1,'pending'],[2,'pending'],[1,'accepted'],[2,'rejected']]);
 await f.run(()=>({accepted:false,reason:'No food'}));expect(events.at(-1).state).toBe('rejected');
});
test('only new authoritative completion IDs celebrate; initialization, interruption, refresh and teardown do not',async()=>{
 const events=[],f=createActionFeedback(e=>events.push(e));f.observe({completedActions:[{id:'old'}]});f.observe({actions:[],completedActions:[{id:'old'}]});expect(events).toHaveLength(0);
 f.observe({minute:70,completedActions:[{id:'old'},{id:'real',type:'read'}]});f.observe({minute:71,completedActions:[{id:'real',type:'read'}]});expect(events).toEqual([{state:'completed',actionId:'real',label:'read',minute:70}]);f.destroy();await f.run(()=>({accepted:true}));expect(events).toHaveLength(1);
});
test('completion arriving during acknowledgment waits for the response',async()=>{
 const events=[],f=createActionFeedback(e=>events.push(e));f.observe({completedActions:[]});let ack;
 const promise=f.run(()=>new Promise(resolve=>ack=resolve),{type:'read'});await Promise.resolve();f.observe({minute:20,completedActions:[{id:'a',type:'read',completedMinute:19}]});expect(events.map(e=>e.state)).toEqual(['pending']);ack({accepted:true,actionId:'a'});await promise;expect(events.map(e=>e.state)).toEqual(['pending','accepted','completed']);expect(events.at(-1).minute).toBe(19);
});
