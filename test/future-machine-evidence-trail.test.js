import {test,expect} from 'bun:test';
import {buildEvidenceTrail} from '../world/future-machine/story/evidence-trail.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {freeze,stateHash} from '../world/future-machine/data/core.js';
const id='building-project-policy-1-0';
function history(){const initial=initialForRecipe();function run(policy){let state=policy?addIntervention(initial,policy):initial;const engine=createEngine(),steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}return {experimentId:'city_trail',seed:42,modelVersion:initial.version,baseline:run(null),plan:run(DEFAULT_RECIPE.intervention)};}
const h=freeze(history());
const trail=(month=120,source=h)=>buildEvidenceTrail(source,{collection:'buildings',id,month});
test('actual City trail preserves exact arm/month/event and policy-project-unit relationships',async()=>{
 const before=await stateHash(h),t=trail(),nodes=t.nodes.filter(n=>n.arm==='plan');
 expect(nodes.find(n=>n.type==='policy')).toMatchObject({month:1,entity:{id:'policy-1-0'},record:{amount:24,cost:1000000}});
 expect(nodes.find(n=>n.type==='project')).toMatchObject({month:3,entity:{id:'project-policy-1-0'},record:{policyId:'policy-1-0'}});
 expect(nodes.find(n=>n.type==='completion')).toMatchObject({month:16,eventId:'16-0',record:{eventType:'PROJECT_COMPLETE',simulationTime:16,payload:{units:24}}});
 const units=nodes.find(n=>n.type==='housing-units');expect(units).toMatchObject({month:16,eventId:'16-0',status:'recorded',record:{count:24,unit:'homes',buildingId:id}});expect(units.record.ids).toHaveLength(24);
 expect(t.nodes.find(n=>n.arm==='baseline').status).toBe('unavailable');
 expect(t.edges.filter(e=>e.status==='recorded')).toHaveLength(4);expect(t.edges.every(e=>e.causalClaim===false)).toBe(true);
 expect(t.edges.find(e=>e.relationship==='independent causal dependency trace')).toMatchObject({status:'unavailable'});
 expect(JSON.parse(JSON.stringify(t))).toEqual(t);expect(trail()).toEqual(t);expect(await stateHash(h)).toBe(before);
});
test('no future evidence at Month 0 or 15, exact completion at 16, reverse inspection stable',()=>{
 for(const month of [0,15]){const t=trail(month);expect(t.nodes.every(n=>n.type==='building'&&n.status==='unavailable')).toBe(true);expect(t.edges).toEqual([]);expect(JSON.stringify(t)).not.toContain('16-0');expect(t.nodes.some(n=>n.entity?.collection==='policies')).toBe(false);}
 const at16=trail(16);expect(at16.nodes.find(n=>n.type==='housing-units').record.count).toBe(24);trail(120);expect(trail(16)).toEqual(at16);
});
test('missing event, inventory or exact policy reference stays unavailable',()=>{
 for(const mutate of [x=>x.plan[16].events=[],x=>x.plan[16].events[0].simulationTime=120,x=>delete x.plan[16].state.units]){const x=structuredClone(h);mutate(x);const t=trail(120,x);expect(t.nodes.some(n=>n.status==='unavailable'&&['completion','housing-units'].includes(n.type))).toBe(true);}
 const x=structuredClone(h);for(const s of x.plan)s.state.policies=[];expect(trail(120,x).nodes.find(n=>n.type==='policy').status).toBe('unavailable');
 expect(buildEvidenceTrail(h,{collection:'households',id:'household-0',month:16}).nodes.every(n=>n.status==='unavailable')).toBe(true);
 expect(()=>trail(121)).toThrow();expect(()=>buildEvidenceTrail(h,{month:0})).toThrow();
});

test('missing snapshots, wrong-version events and ordinary buildings never invent joins',()=>{
 const sparse={...h,plan:h.plan.filter(s=>s.month!==16)};
 expect(trail(16,sparse).nodes.find(n=>n.arm==='plan').unavailableReason).toContain('snapshot unavailable');
 const wrong=structuredClone(h);wrong.plan[16].events[0].modelVersion='unsupported';
 expect(trail(120,wrong).nodes.find(n=>n.type==='completion').status).toBe('unavailable');
 const ordinary=buildEvidenceTrail(h,{collection:'buildings',id:'building-d1',month:120});
 expect(ordinary.nodes.filter(n=>n.type==='project').every(n=>n.status==='unavailable')).toBe(true);
 expect(ordinary.nodes.some(n=>n.type==='completion')).toBe(false);
 const duplicate={...h,plan:[...h.plan,h.plan[16]]};expect(()=>trail(16,duplicate)).toThrow('Duplicate evidence month');
});

test('trail view retains exact nodes across policy/project navigation and Return',async()=>{
 const {renderEvidenceTrail}=await import('../world/future-machine/story/evidence-trail-view.js');
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.ownerDocument=doc;}
  append(...children){this.children.push(...children);for(const child of children)child.parent=this;}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 }
 const doc={createElement:tag=>new Element(tag)},container=new Element('div');
 const all=node=>[node,...node.children.flatMap(all)];let selected=null,returned=false;
 const view=renderEvidenceTrail(container,h,{collection:'buildings',id,month:120},{onJump:stop=>{selected=stop;view.update(stop.month,stop.nodeId);},onReturn:()=>{returned=true;view.update(120);}});
 const nodes=all(container),buttons=nodes.filter(n=>n.dataset.nodeId),ids=buttons.map(n=>n.dataset.nodeId);
 const policy=buttons.find(n=>n.textContent==='policy · Month 1'),project=buttons.find(n=>n.textContent==='project · Month 3');
 policy.onclick();expect(selected).toMatchObject({month:1,entity:{collection:'policies',id:'policy-1-0'},nodeId:policy.dataset.nodeId});expect(policy.attributes['aria-current']).toBe('step');
 project.onclick();expect(project.attributes['aria-current']).toBe('step');expect(policy.attributes['aria-current']).toBeUndefined();
 expect(nodes.some(n=>n.textContent==='Viewing Month 3 · trail recorded through Month 120')).toBe(true);
 nodes.find(n=>n.textContent==='Return').onclick();expect(returned).toBe(true);
 expect(all(container).filter(n=>n.dataset.nodeId).map(n=>n.dataset.nodeId)).toEqual(ids);
 for(let month=0;month<=120;month++)view.update(month);
 expect(all(container).filter(n=>n.dataset.nodeId)).toEqual(buttons);
 view();expect(container.children).toHaveLength(0);
});
