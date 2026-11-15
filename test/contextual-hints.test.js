import { test, expect } from 'bun:test';
import { availableHintActions } from '../world/universe/contextual-hints.js';

// DOM availability boundary: no activation or model API is involved in discovery.
function control(label, {tagName='BUTTON', hidden=false, disabled=false, excluded=false, visibility='visible'}={}) {
 return {tagName,textContent:label,visibility,excluded,
  getAttribute:()=>null,closest:()=>hidden,matches:()=>disabled,
  getClientRects:()=>hidden?[]:[{}],click:()=>{throw new Error('Hints must not activate actions');}};
}
const rootFor = controls => ({querySelectorAll:()=>controls,defaultView:{getComputedStyle:c=>({visibility:c.visibility})}});
const excluded = {contains:c=>c.excluded};
test('hints use enabled visible labeled controls, prefer actions over travel, preserve native order',()=>{
 const link=control('Leave workspace',{tagName:'A'}),disabled=control('Run',{disabled:true}),hidden=control('Hidden',{hidden:true}),nav=control('Hint itself',{excluded:true}),invisible=control('Invisible',{visibility:'hidden'}),empty=control('  '),first=control('Inspect evidence'),second=control('Run paired futures');
 expect(availableHintActions(rootFor([link,disabled,hidden,nav,invisible,empty,first,second]),excluded)).toEqual([first,second,link]);
});
test('empty and changed availability are evaluated afresh without executing anything',()=>{
 const controls=[];const root=rootFor(controls);expect(availableHintActions(root,excluded)).toEqual([]);
 const action=control('Run experiment');controls.push(action);expect(availableHintActions(root,excluded)).toEqual([action]);controls.pop();expect(availableHintActions(root,excluded)).toEqual([]);
});
