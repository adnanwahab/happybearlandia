import {test,expect} from 'bun:test';
import {householdPostcard} from '../world/future-machine/data/postcard.js';
import {mountFamilyCard} from '../world/future-machine/ui/family-card.js';
const snapshot=()=>({month:0,state:{month:0,seed:42,version:'v1',households:[{id:'h1',size:2,unitId:'u1',income:1000,savings:0}],units:[{id:'u1',householdId:'h1',status:'occupied',rent:0,buildingId:'b1'}],buildings:[{id:'b1'}]},events:[]});
const history=()=>({seed:42,modelVersion:'v1',experimentId:'run-1',baseline:[snapshot()],plan:[snapshot()]});
test('zero values remain honest unchanged observations; changes retain exact records',()=>{
 const h=history(),before=JSON.stringify(h),card=householdPostcard(h,'h1',0);
 expect(card.status).toBe('unchanged');expect(card.arms.plan.record.household).toBe(h.plan[0].state.households[0]);
 expect(card.arms.plan.record.observation.rent).toBe(0);expect(JSON.stringify(h)).toBe(before);
 h.plan[0].state.households[0].savings=1;expect(householdPostcard(h,'h1',0).status).toBe('changed');
});
test('missing/duplicate households, missing rents, bad clocks/seeds/versions never become unchanged',()=>{
 for(const mutate of [h=>h.plan=[],h=>h.plan.push(snapshot()),h=>h.plan[0].state.households=[],h=>h.plan[0].state.households.push({...h.plan[0].state.households[0]}),h=>h.plan[0].state.units=[],h=>h.plan[0].state.month=1,h=>h.plan[0].state.seed=43,h=>h.plan[0].state.version='v2',h=>h.plan[0].state.households[0].income=0,h=>h.plan[0].state.households[0].size=null,h=>{h.plan[0].state.households[0].income=Number.MIN_VALUE;h.plan[0].state.units[0].rent=Number.MAX_VALUE;}]){
  const h=history();mutate(h);expect(householdPostcard(h,'h1',0).status).toBe('unavailable');
 }
 expect(householdPostcard(history(),'absent',0).status).toBe('unavailable');
 expect(householdPostcard(history(),'h1',121).status).toBe('unavailable');
});
test('event receipts retain exact arm/month/entity and dependencies; unrelated events excluded',()=>{
 const h=history(),event={id:'0-0',simulationTime:0,eventType:'OBSERVATION',modelVersion:'v1',payload:{householdId:'h1'},dependencies:['source-1']};
 h.baseline[0].events=[event,{...event,id:'wrong-month',simulationTime:1},{...event,id:'district',payload:{districtId:'d1'}}];h.plan[0].events=[event];
 const receipts=householdPostcard(h,'h1',0).receipts;
 expect(receipts.map(r=>[r.future,r.eventId,r.entity.entityId,r.month])).toEqual([['a','0-0','h1',0],['b','0-0','h1',0]]);
 expect(receipts[0].dependencies).toEqual(['source-1']);
});
function documentStub(){const doc={createElement(tag){return {tag,ownerDocument:doc,children:[],style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(...nodes){this.children.push(...nodes);},prepend(n){this.children.unshift(n);},replaceChildren(...nodes){this.children=nodes;},querySelector(tag){return walk(this).find(n=>n.tag===tag);},scrollIntoView(){},remove(){}};}};return doc;}
function walk(n){return [n,...n.children.flatMap(walk)];}
test('component shows empty/unavailable states and routes an exact event through existing callback',()=>{
 const doc=documentStub(),root=doc.createElement('div'),calls=[],view=mountFamilyCard(root,{onInspectEvent:x=>calls.push(x)});
 view.update({});expect(walk(root).some(n=>n.textContent==='No recorded households available.')).toBe(true);
 const h=history();h.plan[0].events=[{id:'e1',simulationTime:0,payload:{householdId:'h1'}}];
 view.update({familyHistory:h,month:0});let nodes=walk(root);
 expect(nodes.some(n=>n.className==='fm-family-avatar')).toBe(false);
 nodes.find(n=>n.textContent==='Inspect event e1 · plan · Month 0').onclick();expect(calls[0].entity).toEqual({collection:'households',id:'h1',arm:'plan'});
 expect(nodes.some(n=>n.textContent?.startsWith('House view unavailable'))).toBe(true);
 h.plan=[];view.update({familyHistory:h,month:0});expect(walk(root).some(n=>n.textContent?.startsWith('Comparison unavailable'))).toBe(true);view.dispose();
});
