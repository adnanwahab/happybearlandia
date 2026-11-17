import {test,expect} from 'bun:test';
import {skyClockState} from '../world/sky-clock/controls.js';
import {simulationLighting} from '../world/render/environment/sim-lighting.js';
test('preview and reset use committed minute without changing source records',()=>{
 const receipt=Object.freeze({minute:1830,seed:42,rulesVersion:'fixture'}),before=JSON.stringify(receipt);
 const actual=skyClockState(receipt.minute,undefined),preview=skyClockState(receipt.minute,22);
 expect(actual.hour).toBe(6.5);expect(actual.cosmetic).toBe(false);expect(preview.cosmetic).toBe(true);expect(preview.committed).toBe(actual.committed);expect(preview.note).toContain('No hourly recorded state');
 expect(simulationLighting(receipt.minute,preview.hour).daylight).toBe(0);
 expect(skyClockState(receipt.minute,undefined)).toEqual(actual);expect(JSON.stringify(receipt)).toBe(before);
});
test('missing and invalid clocks are unavailable; boundaries stay within a day',()=>{
 for(const minute of [undefined,null,NaN,Infinity])expect(skyClockState(minute,undefined).valid).toBe(false);
 expect(skyClockState(601,undefined).committed).toContain('10:01');expect(skyClockState(1440,undefined).hour).toBe(0);expect(skyClockState(-30,undefined).hour).toBe(23.5);
 expect(skyClockState(0,NaN).cosmetic).toBe(false);
});

import {mountSkyClock} from '../world/sky-clock/controls.js';
function fixture(){
 const nodes=new Map(),node=()=>Object.assign(new EventTarget(),{dataset:{},textContent:'',value:'',setAttribute(key,value){this[key]=value;},append(){},remove(){this.removed=true;}});
 const root=node();root.querySelector=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);};
 const parent={ownerDocument:{createElement:tag=>tag==='details'?root:node()},append(){}};
 let minute=600,hour=14,fail=false,readFail=false,t=0;
 const receipt=Object.freeze({minute,seed:666,runId:'fixture',rulesVersion:'fixture-v1'});
 const api=mountSkyClock(parent,{now:()=>++t,read:()=>{if(readFail)throw Error('fixture');return{minute,hour};},preview:value=>{if(fail)throw Error('fixture');hour=value;},reset:()=>{if(fail)throw Error('fixture');hour=undefined;}});
 return{api,nodes,receipt,setMinute:v=>minute=v,setFail:v=>fail=v,setReadFail:v=>readFail=v,hour:()=>hour};
}
test('mounted controls handle failures, unavailable clocks, recovery, pacing and cleanup',()=>{
 const f=fixture(),input=f.nodes.get('input'),button=f.nodes.get('button'),before=JSON.stringify(f.receipt),status=f.nodes.get('[role=status]');
 input.value='22';input.dispatchEvent(new Event('input'));expect(f.hour()).toBe(22);
 f.setFail(true);input.dispatchEvent(new Event('input'));expect(status.textContent).toContain('preview failed');button.dispatchEvent(new Event('click'));expect(status.textContent).toContain('reset failed');
 f.setFail(false);button.dispatchEvent(new Event('click'));expect(f.hour()).toBeUndefined();expect(JSON.stringify(f.receipt)).toBe(before);
 f.setMinute(NaN);f.api.update(1000);expect(input.disabled).toBe(true);expect(button.disabled).toBe(true);
 f.setMinute(720);f.api.update(1100);expect(input.disabled).toBe(false);
 f.setReadFail(true);f.api.update(1200);expect(status.textContent).toContain('unavailable');f.setReadFail(false);f.api.update(1300);expect(input.disabled).toBe(false);expect(status.textContent).toContain('restored');
 const count=f.api.getStats().updates;f.api.update(1301);expect(f.api.getStats().updates).toBe(count);expect(f.api.getStats().frames).toBe(5);expect(f.api.getStats().maxFrameMs).toBe(100);
 f.api.destroy();input.value='12';input.dispatchEvent(new Event('input'));f.api.update(2000);expect(f.hour()).toBeUndefined();expect(f.api.element.removed).toBe(true);expect(f.api.getStats().disposed).toBe(true);
});
