import {test,expect} from 'bun:test';
import {familyIdentity,familyRecord,rankFamilies,mountFamilyCard} from '../world/future-machine/ui/family-card.js';
const snapshot=(month,rent=500,buildingId='b1')=>({month,state:{month,households:[{id:'h1',income:2000,savings:0,size:3,unitId:'u1'},{id:'h2',income:1000,unitId:'u2'}],units:[{id:'u1',householdId:'h1',status:'occupied',rent,buildingId},{id:'u2',householdId:'h2',status:'occupied',rent:200,buildingId:'b1'}],buildings:[{id:'b1'},{id:'b2'}]}});
const fixture=()=>({seed:42,modelVersion:'v1',experimentId:'exact-run',baseline:[snapshot(0),snapshot(1)],plan:[snapshot(0),snapshot(1,1000,'b2')]});
test('synthetic identity depends only on seed and exact City ID',()=>{
 expect(familyIdentity(42,'h1')).toEqual(familyIdentity(42,'h1'));
 expect(familyIdentity(43,'h1')).not.toEqual(familyIdentity(42,'h1'));
 expect(familyIdentity(42,'h2')).not.toEqual(familyIdentity(42,'h1'));
});
test('ranking uses matched monthly burden, preserves source, zero ties and missing values',()=>{
 const h=fixture(),before=JSON.stringify(h);expect(rankFamilies(h)).toEqual([{id:'h1',difference:.25},{id:'h2',difference:0}]);
 h.plan[1].state.households[0].income=0;expect(rankFamilies(h)[0].difference).toBe(0);
 h.plan=[];expect(rankFamilies(h).every(r=>r.difference===null)).toBe(true);
 expect(JSON.stringify(fixture())).toBe(before);
});
test('home resolution follows each arm and refuses missing, duplicate or nonreciprocal occupancy',()=>{
 const h=fixture();expect(familyRecord(h.baseline[1],'h1').building.id).toBe('b1');expect(familyRecord(h.plan[1],'h1').building.id).toBe('b2');
 for(const mutate of [s=>s.units.push({...s.units[0]}),s=>s.units[0].householdId='other',s=>s.households.push({...s.households[0]}),s=>s.buildings=[]]){const s=snapshot(1);mutate(s.state);expect(familyRecord(s,'h1').building).toBeNull();}
 expect(familyRecord(null,'h1').observation.burden).toBeNull();
});
function documentStub(){const doc={createElement(tag){return {tag,ownerDocument:doc,children:[],style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(...nodes){this.children.push(...nodes);},prepend(n){this.children.unshift(n);},replaceChildren(...nodes){this.children=nodes;},querySelector(tag){return walk(this).find(n=>n.tag===tag);},scrollIntoView(){},remove(){this.removed=true;}};}};return doc;}
function walk(n){return [n,...n.children.flatMap(walk)];}
test('card numbers and spark points expose exact records, selection and follow dispose',()=>{
 const doc=documentStub(),root=doc.createElement('div'),calls=[],card=mountFamilyCard(root,{onFollow:id=>calls.push(id)}),h=fixture();
 card.update({familyHistory:h,frame:{baseline:h.baseline[1],plan:h.plan[1]},month:1});
 let nodes=walk(root);expect(nodes.find(n=>n.tag==='select').children[0].value).toBe('h1');
 expect(nodes.some(n=>n.textContent?.includes('Synthetic name and avatar'))).toBe(true);
 const link=nodes.find(n=>n.tag==='a'&&n.textContent==='25.00% rent burden');link.onclick();expect(nodes.find(n=>n.id===link.href.slice(1)).open).toBe(true);
 const point=nodes.find(n=>n.tag==='button'&&n.title?.startsWith('Month 0:'));point.onclick();expect(JSON.parse(nodes.find(n=>n.tag==='pre').textContent).month).toBe(0);link.onclick();expect(JSON.parse(nodes.find(n=>n.tag==='pre').textContent).month).toBe(1);
 nodes.find(n=>n.textContent==='Follow this family').onclick();expect(calls).toEqual(['h1']);
 card.update({familyHistory:h,frame:{baseline:h.baseline[0],plan:h.plan[0]},month:0});expect(walk(root).filter(n=>n.title?.startsWith('Month')).length).toBe(2);
 card.dispose();expect(calls.at(-1)).toBeNull();
});
