import {test,expect} from 'bun:test';
import {householdTimeline} from '../world/future-machine/ui/household-timeline.js';
import {createOutcomeTimeline} from '../world/future-machine/ui/outcome-timeline.js';
const snapshot=(month,savings=0)=>({month,state:{month,version:'v1',seed:42,households:[{id:'h1',unitId:'u1',income:2000,savings}],units:[{id:'u1',householdId:'h1',status:'occupied',rent:500}]}});
const history=()=>({seed:42,modelVersion:'v1',baseline:[snapshot(0),snapshot(1,1),snapshot(3,10),snapshot(4,11)],plan:[snapshot(0),snapshot(1,2),snapshot(3,20),snapshot(4,20)]});
test('paired changes retain exact time and identity without filling gaps',()=>{
  const h=history(),before=JSON.stringify(h),rows=householdTimeline(h,'h1');
  expect(rows[1].changes).toEqual([['savings'],['savings']]);
  expect(rows[2].baseline).toBeNull();expect(rows[3].changes).toEqual([[],[]]);
  expect(rows[4].changes).toEqual([['savings'],[]]);expect(rows[1].plan.unitId).toBe('u1');
  expect(rows[0].baseline.savings).toBe(0);expect(JSON.stringify(h)).toBe(before);
  expect(householdTimeline(h,'absent').every(row=>row.baseline===null&&row.plan===null)).toBe(true);
  expect(householdTimeline(h,'h1')).toEqual(rows);
});
test('reject duplicate times and mismatched model, seed and state clocks',()=>{
  for(const patch of [{version:'v2'},{seed:43},{month:2}]){const h=history();Object.assign(h.plan[1].state,patch);expect(()=>householdTimeline(h,'h1')).toThrow();}
  const h=history();h.plan.push(snapshot(1));expect(()=>householdTimeline(h,'h1')).toThrow();
});

test('actual City engine pair repeats household observations with matched provenance',async()=>{
  const {createCity}=await import('../world/city/seed.js');
  const {createEngine,addIntervention}=await import('../world/city/engine.js');
  function run(){const engine=createEngine(),initial=engine.initialize(createCity({seed:42,households:6}));const arm=policy=>{let state=policy?addIntervention(initial,{type:'housing',districtId:'d1',amount:24,cost:1000000,delay:0,compliance:1}):initial;const snapshots=[{month:0,state:initial}];for(let i=0;i<12;i++){state=engine.step(state).state;snapshots.push({month:state.month,state});}return snapshots;};return {seed:42,modelVersion:initial.version,baseline:arm(false),plan:arm(true)};}
  const a=run(),id=a.baseline[0].state.households[0].id,rows=householdTimeline(a,id);
  expect(rows).toEqual(householdTimeline(run(),id));expect(rows[0].baseline).toEqual(rows[0].plan);
  expect(rows[12].baseline.income).toBe(a.baseline[12].state.households.find(h=>h.id===id).income);
  expect(rows[13].baseline).toBeNull();
});


test('composed household and outcome timelines keep playback quiet and announce explicit selections',()=>{
  const nodes=[];
  const doc={createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag)};
  class Element {
    constructor(tag){this.tag=tag;this.ownerDocument=doc;this.children=[];this.style={};this.dataset={};this.attributes={};this.writes=0;this.text='';nodes.push(this);}
    set textContent(value){this.text=String(value);this.writes++;}
    get textContent(){return this.text;}
    setAttribute(key,value){this.attributes[key]=String(value);}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this.append(...children);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
    addEventListener(){}
    removeEventListener(){}
  }
  const h=history();
  for(const arm of ['baseline','plan'])for(const row of h[arm])row.state.households.push({id:'h2',income:3000,savings:100});
  const container=doc.createElement('main'),selected=[];
  const timeline=createOutcomeTimeline(container,{history:h,onMonth:month=>selected.push(month)});
  const outcome=nodes.find(node=>node.className==='fm-outcome-values');
  const household=nodes.find(node=>node.className==='fm-household-values');
  const announcement=nodes.find(node=>node.dataset.householdAnnouncement==='true');
  const paths=nodes.filter(node=>node.tag==='path');
  const writes=[outcome.writes,announcement.writes],visualWrites=household.writes;
  expect(household.textContent).toContain('h1 · Month 0');
  timeline.update(1);timeline.update(3);timeline.update(3);
  expect([outcome.writes,announcement.writes]).toEqual(writes);
  expect(household.writes).toBe(visualWrites+2);expect(household.textContent).toContain('Month 3');
  expect(nodes.filter(node=>node.tag==='path')).toEqual(paths);
  timeline.update(3,{announce:true});timeline.update(3,{announce:true});
  expect([outcome.writes,announcement.writes]).toEqual(writes.map(value=>value+1));
  expect(announcement.textContent).toBe(household.textContent);
  expect(household.textContent).toContain('savings 20 USD');
  const next=nodes.find(node=>node.tag==='button'&&node.textContent==='Next household change');
  expect(next.disabled).toBe(false);next.onclick();
  expect(selected).toEqual([4]);expect(outcome.textContent).toContain('Month 4');expect(household.textContent).toContain('Month 4');
  expect(next.disabled).toBe(true);
  const select=nodes.find(node=>node.attributes['aria-label']==='Timeline household');
  select.value='h2';select.onchange();
  expect(selected).toEqual([4,4]);expect(household.textContent).toContain('h2 · Month 4');
  expect(household.textContent).toContain('savings 100 USD');
  timeline.update(2,{announce:true});
  expect(outcome.textContent).toContain('Unavailable');expect(household.textContent).toContain('Unavailable — no matched observation');
  const finalWrites=[outcome.writes,household.writes,announcement.writes];
  timeline.dispose();timeline.dispose();timeline.update(0,{announce:true});
  expect(container.children).toEqual([]);expect(select.onchange).toBeNull();expect(next.onclick).toBeNull();
  expect([outcome.writes,household.writes,announcement.writes]).toEqual(finalWrites);
});
