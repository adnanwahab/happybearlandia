import {test,expect} from 'bun:test';
import {selectMoments} from '../world/future-machine/story/game-director.js';
import {createCity} from '../world/city/seed.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {freeze} from '../world/future-machine/data/core.js';
const event=(id,month,type,extra={})=>({id,simulationTime:month,eventType:type,payload:{projectId:'p1'},...extra});

test('scoped exact provenance, explicit chains only, deterministic ordering and no aliases',()=>{
 const history={seed:42,baseline:[{month:1,events:[event('1',1,'CONSTRUCTION_STARTED')]},{month:2,events:[event('2',2,'OTHER',{dependencies:['1']}),event('3',2,'OTHER',{dependencies:['absent']})]}],plan:[{month:1,events:[event('1',1,'CONSTRUCTION_STARTED')]}]};
 const original=JSON.stringify(history),moments=selectMoments(freeze(history));
 expect(moments).toHaveLength(3);expect(new Set(moments.map(m=>m.id)).size).toBe(3);
 expect(moments.find(m=>m.kind==='chain').dependencies[0].id).toBe('1');
 expect(selectMoments({...history,baseline:[...history.baseline].reverse()})).toEqual(moments);
 moments[0].record.payload.projectId='changed';expect(JSON.stringify(history)).toBe(original);
 expect(()=>selectMoments(history,{limit:0})).toThrow();
 expect(selectMoments({baseline:[],plan:[]})).toEqual([]);
});

test('real seed replay and enabling presentation preserve simulation results',()=>{
 const initial=createCity({seed:42,households:5}),before=JSON.stringify(initial),engine=createEngine();
 const run=()=>engine.run(addIntervention(initial,{type:'housing',districtId:'d1',amount:24,cost:1000000}),24);
 const first=run(),history=freeze({seed:42,plan:first.steps.map(step=>({...step,month:step.state.month})),baseline:[]});
 const recorded=JSON.stringify(history),moments=selectMoments(history);
 expect(moments.some(m=>m.kind==='construction')).toBe(true);
 expect(moments.some(m=>m.kind==='character-decision')).toBe(true);
 const second=run();expect(second).toEqual(first);
 expect(selectMoments({seed:42,plan:second.steps.map(step=>({...step,month:step.state.month})),baseline:[]})).toEqual(moments);
 expect(JSON.stringify(history)).toBe(recorded);expect(JSON.stringify(initial)).toBe(before);
});

import {renderMoments} from '../world/future-machine/story/moment-narrative.js';
test('presentation skip, replay, exact source and disposal are local to the view',()=>{
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.handlers=new Map();this.style={};this.ownerDocument=doc;}
  append(node){this.children.push(node);} replaceChildren(node){this.children=[node];}
  setAttribute(){} addEventListener(type,handler){this.handlers.set(type,handler);}
  removeEventListener(type){this.handlers.delete(type);} remove(){this.removed=true;}
 }
 const doc={createElement:tag=>new Element(tag)},container=new Element('div');let jump=null;
 const moments=freeze(selectMoments({seed:7,plan:[{month:1,events:[event('exact-source',1,'PROJECT_COMPLETE')]}]}));
 const dispose=renderMoments(container,moments,{onJump:row=>jump=row});
 const root=container.children[0],article=root.children.find(node=>node.tag==='article'),content=article.children[0];
 const buttons=article.children.filter(node=>node.tag==='button');
 buttons[0].handlers.get('click')();expect(content.hidden).toBe(true);expect(jump).toBeNull();
 buttons[1].handlers.get('click')();expect(content.hidden).toBe(false);expect(jump.month).toBe(1);expect(jump.evidence[0].eventId).toBe('exact-source');
 buttons[2].handlers.get('click')();const details=content.children.find(node=>node.tag==='details');expect(details.open).toBe(true);expect(details.children[1].textContent).toContain('exact-source');
 dispose();expect(buttons.every(node=>node.handlers.size===0)).toBe(true);expect(root.removed).toBe(true);
});

test('conflict evidence, malformed sources, missing dependencies and selection bounds',()=>{
 const h={plan:[{month:1,events:[event('x',1,'BUDGET_DEFICIT',{dependencies:['missing']}),event('bad',2,'PROJECT_COMPLETE')]},{month:2,events:[event('future',2,'OTHER',{dependencies:['future']})]}]};
 const moments=selectMoments(h);expect(moments).toHaveLength(1);expect(moments[0].kind).toBe('goal-conflict');expect(moments[0].missingDependencies).toEqual(['missing']);
 expect(()=>selectMoments({plan:[h.plan[0],h.plan[0]]})).toThrow();
 expect(()=>selectMoments({plan:[{month:121}]})).toThrow();
 expect(selectMoments(h,{limit:1})).toHaveLength(1);
});
