import {test, expect} from 'bun:test';
import {worldEditAffordances, mountEditAffordances} from '../world/decision/edit-affordances.js';
import {housingModel, createHousingScenarios} from '../world/models/housing/index.js';
import {createBuildingProposal} from '../world/buildings/proposal.js';
const input = () => ({schemaVersion:'decision-experiment.v1',name:'Hints',decision:'Test',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:2,years:6,scenarios:createHousingScenarios(),metadata:{}});
test('only actual scenario projects are editable; source identity and data stay intact', () => {
 const data=input(), project=createBuildingProposal({id:'tower',status:'approved'}); data.scenarios.find(s=>s.id==='plan-a').projects=[project];
 const context={input:data,scenarioId:'plan-a',selection:{kind:'building',id:'tower'}}, before=JSON.stringify(context);
 expect(worldEditAffordances(context).some(r=>r.kind==='project')).toBe(true);
 expect(worldEditAffordances({...context,selection:{...context.selection,existing:true}}).some(r=>r.kind==='project')).toBe(false);
 expect(worldEditAffordances({...context,selection:{kind:'building',id:'osm-unknown'}}).some(r=>r.kind==='project')).toBe(false);
 expect(JSON.stringify(context)).toBe(before);
});
test('parcel geometry, read-only, unsupported policy and unavailable context fail closed', () => {
 const data=input(), context={input:data,scenarioId:'plan-a',selection:{kind:'district',id:'downtown',location:{districtId:'downtown',x:0,z:0}}};
 expect(worldEditAffordances(context).map(r=>r.kind)).toEqual(['parcel','policy']);
 data.metadata.placementContext={bounds:{minX:0,maxX:1,minZ:0,maxZ:1}};
 expect(worldEditAffordances(context).some(r=>r.kind==='parcel')).toBe(false);
 expect(worldEditAffordances({...context,readOnly:true})).toEqual([]);
 expect(worldEditAffordances({})).toEqual([]);
 expect(worldEditAffordances({...context,scenarioId:'missing'})).toEqual([]);
 expect(worldEditAffordances({...context,selection:{kind:'parameter',id:'unsupported'}})).toEqual([]);
});
test('bounded discovery benchmark (local CPU; no frame-loop calls)', () => {
 const data=input(), context={input:data,scenarioId:'plan-a'}, start=performance.now();
 for(let i=0;i<200;i++)worldEditAffordances(context);
 console.log(`SHE-468: 200 policy hint refreshes ${(performance.now()-start).toFixed(2)} ms`);
 expect(worldEditAffordances(context)).toHaveLength(1);
});

test('hint component exposes native buttons, empty and locked states, callbacks and cleanup', () => {
 const element = tag => ({tag, children:[], attributes:{}, hidden:false,
  setAttribute(key,value){this.attributes[key]=value;},
  append(...nodes){for(const child of nodes){child.parent=this;this.children.push(child);}},
  replaceChildren(){this.children=[];},
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}});
 const doc={createElement:element},host=element('section');host.ownerDocument=doc;host.closest=()=>null;
 let activated=null;
 const component=mountEditAffordances(host,row=>activated=row), root=host.children[0];
 component.update({input:input(),scenarioId:'plan-a'});
 expect(root.attributes['aria-label']).toBe('Editable world hints');
 const button=root.children.find(child=>child.tag==='button');expect(button.type).toBe('button');
 button.onclick();expect(activated.kind).toBe('policy');
 component.update({input:input(),scenarioId:'plan-a',readOnly:true});expect(root.hidden).toBe(true);expect(root.children).toHaveLength(0);
 component.update({input:null});expect(root.hidden).toBe(false);expect(root.children.at(-1).textContent).toContain('No supported edits');
 component.destroy();expect(host.children).toHaveLength(0);
});
