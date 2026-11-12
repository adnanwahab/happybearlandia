import {test, expect} from 'bun:test';
import {selectChanges, directorCommand, explainChange, householdImpact, buildStory, describeSelection, renderStory} from '../world/future-machine/story/index.js';
import {createCity} from '../world/city/seed.js';
import {createEngine, addIntervention} from '../world/city/engine.js';

test('first divergence, structural significance and stable ordering', () => {
  const frames = [{month: 120, changes: [{collection:'buildings',entityId:'new',kind:'added'}]}, {month:1,changes:[{collection:'households',entityId:'z',fields:['income']},{collection:'households',entityId:'a',fields:['savings']}]}];
  const result = selectChanges(frames);
  expect(result.first.entityId).toBe('a');
  expect(result.significant[0].entityId).toBe('new');
  expect(selectChanges([...frames].reverse())).toEqual(result);
  expect(result.stops).toHaveLength(3);
  expect(selectChanges([{month:0,changes:[]}]).physicalStatus).toBe('no-physical-change');
  expect(() => selectChanges([{month:121}])).toThrow();
  expect(() => selectChanges([{month:0},{month:0}])).toThrow();
});

test('director never invents a location or accepts ambiguous/unproven geometry', () => {
  const change={month:12,collection:'buildings',entityId:'b1'};
  expect(directorCommand(change).camera).toBeNull();
  const mapping={collection:'buildings',entityId:'b1',position:{x:1,y:0,z:3},provenance:'synthetic'};
  expect(directorCommand(change,[mapping]).status).toBe('mapped');
  expect(directorCommand(change,[mapping,mapping]).camera).toBeNull();
  expect(directorCommand(change,[{...mapping,provenance:undefined}]).camera).toBeNull();
  expect(directorCommand(null).status).toBe('no-change');
});

test('receipts retain arm-scoped IDs, dependencies and payload without claiming cause', () => {
  const change={month:2,collection:'households',entityId:'h1'};
  const event={id:'2-0',simulationTime:2,eventType:'HOUSEHOLD_BUDGET_STRESS',payload:{householdId:'h1'},dependencies:['1-2'],modelVersion:'v1'};
  const result=explainChange(change,{a:[event],b:[{...event,dependencies:[]},{...event,id:'wrong-month',simulationTime:1},{...event,id:'wrong-entity',payload:{householdId:'h2'}}]});
  expect(result.receipts.map(row=>[row.future,row.eventId])).toEqual([['a','2-0'],['b','2-0']]);
  expect(result.receipts[0].dependencies).toEqual(['1-2']);
  expect(result.uncertainty.join(' ')).toContain('do not establish');
  expect(explainChange(change).status).toBe('missing-events');
});

const state = (households,units=[]) => ({schemaVersion:'CityState.v1',month:120,households,units});
test('household observations match only exact monthly City IDs and preserve missingness', () => {
  const h={id:'h1',unitId:'u1',income:100,savings:20,districtId:'d1'};
  const a=state([h],[{id:'u1',householdId:'h1',rent:40}]);
  const b=state([{...h,savings:30}]);
  expect(householdImpact(a,b,'h1').deltas).toEqual({income:0,savings:10,housingBurden:null,rent:null});
  expect(householdImpact(a,state([]),'h1').status).toBe('missing-household');
  expect(() => householdImpact(a,{...b,month:119},'h1')).toThrow();
  expect(() => householdImpact(a,{...b,schemaVersion:'Population.v1'},'h1')).toThrow();
});

test('frozen story interface handles first, large, zero, missing months and selection', () => {
  const snapshot={month:120,state:state([]),events:[]};
  const history={baseline:[snapshot],plan:[snapshot]};
  const diff={month:120,available:true,entities:[{collection:'buildings',id:'b1',kind:'added',changedFields:[]}],physicalCount:1};
  const story=buildStory(history,[{month:0,available:false},diff]);
  expect(story.stops[0].entity).toEqual({collection:'buildings',id:'b1'});
  expect(story.stops[0].month).toBe(120);
  expect(story.limitations.join(' ')).toContain('unavailable');
  expect(buildStory(history,[{...diff,entities:[]}]).stops).toEqual([]);
  expect(describeSelection({month:120,baseline:snapshot,plan:snapshot},diff,{collection:'buildings',id:'missing'}).summary).toContain('No recorded A/B difference');
});

test('real City event history produces deterministic grounded stories', () => {
  const initial=createCity({seed:42,households:5});
  const engine=createEngine();
  const run=engine.run(initial,2);
  const last=run.steps[1];
  const history={baseline:[{month:2,state:last.state,events:last.events}],plan:[{month:2,state:last.state,events:last.events}]};
  const diffs=[{month:2,available:true,entities:[]}];
  expect(buildStory(history,diffs)).toEqual(buildStory(structuredClone(history),diffs));
  expect(buildStory(history,diffs).stops).toEqual([]);
});

test('seed-matched 120-month City histories keep Month 0 and 120 and immutable input', () => {
  const initial=createCity({seed:42,households:5}), original=JSON.stringify(initial);
  const engine=createEngine();
  const baseline=engine.run(initial,120), plan=engine.run(addIntervention(initial,{type:'housing',districtId:'d1',amount:24,cost:1000000}),120);
  const snapshots=run=>[{month:0,state:initial,events:[]},...run.steps.map(row=>({month:row.state.month,state:row.state,events:row.events}))];
  const history={baseline:snapshots(baseline),plan:snapshots(plan)};
  const diffs=history.baseline.map((a,i)=>({month:a.month,available:true,entities:history.plan[i].state.policies.filter(after=>!a.state.policies.some(before=>before.id===after.id)).map(after=>({collection:'policies',id:after.id,kind:'added',changedFields:[]}))}));
  const story=buildStory(history,diffs);
  expect(history.baseline).toHaveLength(121);expect(history.plan[120].month).toBe(120);
  expect(story.stops.length).toBeGreaterThan(0);
  expect(story).toEqual(buildStory(structuredClone(history),structuredClone(diffs)));
  for(const stop of story.stops) for(const receipt of stop.evidence) expect(receipt.month).toBe(stop.month);
  expect(JSON.stringify(initial)).toBe(original);
});

test('renderer creates accessible jumps, literal evidence and disposes handlers', () => {
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.handlers=new Map();this.ownerDocument=doc;}
    append(node){this.children.push(node);}
    replaceChildren(node){this.children=[node];}
    addEventListener(type,handler){this.handlers.set(type,handler);}
    removeEventListener(type){this.handlers.delete(type);}
    remove(){this.removed=true;}
  }
  const doc={createElement:tag=>new Element(tag)};
  const container=new Element('div');let selected=null;
  const stop={month:1,title:'First divergence',summary:'<script>literal</script>',evidence:[]};
  const dispose=renderStory(container,{summary:'Recorded change',stops:[stop],limitations:[]},{onJump:row=>selected=row});
  const root=container.children[0],button=root.children.find(row=>row.tag==='button');
  expect(button.type).toBe('button');button.handlers.get('click')();expect(selected).toBe(stop);
  expect(root.children.some(row=>row.textContent==='<script>literal</script>')).toBe(true);
  dispose();expect(button.handlers.size).toBe(0);expect(root.removed).toBe(true);
});


test('director deduplicates repeated policy additions and includes completed physical buildings',()=>{
 const frames=Array.from({length:120},(_,i)=>({month:i+1,changes:[{collection:'policies',entityId:'policy',kind:'added'},...(i>=8?[{collection:'buildings',entityId:'new-home',kind:'added'}]:[])]}));
 const result=selectChanges(frames);expect(result.stops[0].month).toBe(1);expect(result.stops[1].entityId).toBe('new-home');expect(result.stops[1].month).toBe(9);expect(result.stops).toHaveLength(2);
});
