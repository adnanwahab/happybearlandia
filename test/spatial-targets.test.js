import {test,expect} from 'bun:test';
import {spatialTargets,nextTargetIndex} from '../world/onboarding/spatial-targets.js';
const town={people:[{id:'p-original',name:'Alex',x:1,z:2},{id:'missing',x:NaN,z:2}],buildings:[{id:'b-original',name:'Bakery',center:[8,9]}]};
test('representative source IDs, types and coordinates; no model writes',()=>{
 const before=structuredClone(town),rows=spatialTargets(town);
 expect(rows.map(r=>[r.id,r.kind])).toEqual([['p-original','resident'],['b-original','building']]);
 expect(rows[1].position).toEqual({x:8,y:0,z:9});expect(town).toEqual(before);
 expect(spatialTargets(town,{limit:1})).toHaveLength(1);
});
test('empty, unavailable, invalid positions and maximum bounds',()=>{
 expect(spatialTargets(null)).toEqual([]);expect(spatialTargets(town,{available:false})).toEqual([]);
 expect(spatialTargets({people:[],buildings:[]})).toEqual([]);
 expect(spatialTargets(town,{limit:0})).toEqual([]);
 expect(spatialTargets({people:Array.from({length:100},(_,i)=>({id:i,x:0,z:0}))},{limit:999})).toHaveLength(48);
});
test('arrows stop at boundaries and Home/End preserve escape through native Tab',()=>{
 expect(nextTargetIndex(0,'ArrowLeft',3)).toBe(0);expect(nextTargetIndex(2,'ArrowRight',3)).toBe(2);
 expect(nextTargetIndex(1,'ArrowUp',3)).toBe(0);expect(nextTargetIndex(1,'ArrowDown',3)).toBe(2);
 expect(nextTargetIndex(1,'Home',3)).toBe(0);expect(nextTargetIndex(0,'End',3)).toBe(2);
 expect(nextTargetIndex(0,'ArrowRight',0)).toBe(-1);
});

import {mountSpatialTargets} from '../world/onboarding/spatial-targets.js';
function domFixture(){
 const document={activeElement:null};
 document.createElement=tag=>{
  const node={tagName:tag,style:{},dataset:{},children:[],listeners:{},attributes:{},
   append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},
   addEventListener(k,fn){this.listeners[k]=fn;},replaceChildren(){this.children=[];},
   focus(){document.activeElement=this;this.listeners.focus?.();},remove(){this.removed=true;}};
  return node;
 };
 const container=document.createElement('div');return {document,container};
}
test('component uses one semantic list for focus and inspection, unavailable refresh and exit',()=>{
 const {document,container}=domFixture(),focused=[],inspected=[];let rows=spatialTargets(town),cleared=0,exits=0;
 const ui=mountSpatialTargets({document,container,getTargets:()=>rows,onFocus:r=>focused.push(r.id),onClear:()=>cleared++,onInspect:r=>inspected.push(r.id),onExit:()=>exits++});
 const root=container.children[0];root.open=true;root.listeners.toggle();
 const list=root.children[2],first=list.children[0].children[0],second=list.children[1].children[0];
 first.focus();expect(focused).toEqual(['p-original']);
 root.listeners.keydown({key:'ArrowRight',preventDefault(){},stopPropagation(){}});expect(document.activeElement).toBe(second);
 second.listeners.click();expect(inspected).toEqual(['b-original']);
 expect(second.textContent).toBe('Bakery · building');
 root.listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});
 expect(root.open).toBe(false);expect(exits).toBe(1);expect(document.activeElement).toBe(root.children[0]);
 rows=[];ui.refresh();expect(list.children).toHaveLength(0);expect(root.children[3].textContent).toContain('unavailable');
 ui.dispose();expect(root.removed).toBe(true);expect(cleared).toBeGreaterThan(0);
});
