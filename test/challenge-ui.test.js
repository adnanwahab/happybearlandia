import {test,expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {createChallengeEnvelope} from '../world/challenges/contract.js';
import {defaultChallengeActions,mountChallengePanel} from '../world/challenges/panel.js';
import {challengeLinkPayload,challengeFromLink} from '../world/challenges/transport.js';
test('challenge links retain frozen seed, geometry, cap and objective definitions through compression',async()=>{const initial=createCity({households:6,seed:42}),actions=defaultChallengeActions(initial),challenge=await createChallengeEnvelope({initialState:initial,budget:50000,months:12,actions,referenceSelection:['housing']});const payload=await challengeLinkPayload(challenge),decoded=await challengeFromLink(payload);expect(decoded).toEqual(challenge);expect(decoded.seed).toBe(42);expect(decoded.budget.metric).toBe('cumulativeCapitalExpense');expect(decoded.actions).toEqual(challenge.actions);await expect(challengeFromLink('bad-format')).rejects.toThrow();expect(initial.policies).toEqual([]);});

test('district policy menu has three bounded alternatives and an enforceable allocation cap',async()=>{
 const {selectedCapitalBudget}=await import('../world/challenges/panel.js');
 const state=createCity({households:6,seed:42}),actions=defaultChallengeActions(state);
 expect(actions).toHaveLength(3);expect(actions.every(a=>a.intervention.districtId===state.districts[0].id)).toBe(true);
 expect(selectedCapitalBudget(actions,['housing','transit'],20000)).toEqual({committed:20000,remaining:0,withinCap:true});
 expect(selectedCapitalBudget(actions,actions.map(a=>a.id),20000).withinCap).toBe(false);
 expect(selectedCapitalBudget(actions,[],0).withinCap).toBe(true);
 for(const cap of [NaN,Infinity,-1,1e13])expect(()=>selectedCapitalBudget(actions,[],cap)).toThrow();
 expect(()=>selectedCapitalBudget(actions,['housing','housing'],20000)).toThrow();
 expect(()=>selectedCapitalBudget(actions,['unknown'],20000)).toThrow();
});

test('each district policy replays deterministically against an unchanged same-seed control',async()=>{
 const {verifyChallenge}=await import('../world/challenges/contract.js');
 const initial=createCity({households:6,seed:42}),before=JSON.stringify(initial),actions=defaultChallengeActions(initial);
 const envelope=await createChallengeEnvelope({initialState:initial,months:12,budget:20000,actions,referenceSelection:[],metrics:['unhousedHouseholds','meanExperiencedCommuteMinutes']});
 for(const action of actions){
  const first=await verifyChallenge(envelope,{selection:[action.id]}),second=await verifyChallenge(envelope,{selection:[action.id]});
  expect(first).toEqual(second);expect(first.reference.initialHash).toBe(first.candidate.initialHash);expect(first.reference.seed).toBe(42);expect(first.candidate.seed).toBe(42);
  expect(first.metrics.every(row=>row.delta===null||Number.isFinite(row.delta))).toBe(true);
 }
 expect(JSON.stringify(initial)).toBe(before);
});

// Match the repository's small DOM/event fixtures. Static HTML contributes only
// its actual data-challenge controls; dynamic checkbox trees use normal queries.
// The verification worker below is real, including transport and engine replay.
function challengeDocument(WorkerClass) {
 const document={defaultView:{Worker:WorkerClass,location:{origin:'https://challenge.test',search:'',hash:''},URL,Blob,setTimeout},createElement:tag=>new Element(tag)};
 class Element {
  constructor(tag){this.tag=tag;this.ownerDocument=document;this.children=[];this.attributes={};this.dataset={};this.listeners={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;this._text='';}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join(' ');}
  set innerHTML(value){
   this.replaceChildren();
   for(const [,tag,attributes] of value.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)){
    const control=attributes.match(/\b(data-challenge-[a-z-]+)\b/);
    if(!control)continue;
    const node=new Element(tag);node.setAttribute(control[1],'');
    node.value=attributes.match(/\bvalue="([^"]*)"/)?.[1]??'';
    node.hidden=/\bhidden\b/.test(attributes);node.disabled=/\bdisabled\b/.test(attributes);
    this.append(node);
   }
  }
  setAttribute(name,value){this.attributes[name]=String(value);}
  matches(selector){const attribute=selector.match(/^\[([^\]]+)\]$/);return attribute?Object.hasOwn(this.attributes,attribute[1]):selector==='input:checked'?this.tag==='input'&&this.checked:this.tag===selector;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)??null;}
  addEventListener(type,handler){(this.listeners[type]??=new Set()).add(handler);}
  removeEventListener(type,handler){this.listeners[type]?.delete(handler);}
  async dispatch(type){const event={target:this,preventDefault(){},stopPropagation(){}};const pending=[];for(let node=this;node;node=node.parent)for(const handler of node.listeners[type]??[])pending.push(handler(event));await Promise.all(pending);}
  focus(){}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 }
 return {document,container:new Element('div')};
}

test('imported frozen challenge verifies actual spending despite a larger delayed authorization',async()=>{
 const initial=createCity({households:6,seed:42});
 const envelope=await createChallengeEnvelope({initialState:initial,months:2,budget:0,
  actions:[{id:'housing',label:'Delayed housing',intervention:{type:'housing',districtId:initial.districts[0].id,amount:4,cost:12000,delay:10}}],
  referenceSelection:[],metrics:['unhousedHouseholds']});
 const workerURLs=[];
 class VerificationWorker extends Worker {constructor(url,options){super(url,options);workerURLs.push(String(url));}}
 const {container}=challengeDocument(VerificationWorker);
 const panel=mountChallengePanel(container,{getInitialState(){throw Error('Imported terms must not create a replacement city.');}});
 const control=name=>container.querySelector(`[data-challenge-${name}]`);
 try{
  const serialized=JSON.stringify(envelope);
  control('import').files=[{size:new TextEncoder().encode(serialized).length,text:async()=>serialized}];
  await control('import').dispatch('change');
  await panel.open();
  expect(panel.getState().envelope).toEqual(envelope);
  expect(control('create').hidden).toBe(true);
  const checkbox=control('candidate').querySelector('input');checkbox.checked=true;
  await checkbox.dispatch('change');
  await control('verify').dispatch('click');
  // The rejected UI path must fail here rather than merely rechecking the engine.
  expect(control('status').textContent).toContain('Verified:');
  expect(workerURLs).toHaveLength(1);
  expect(workerURLs[0]).toContain('/world/challenges/verification.worker.js');
  expect(panel.getState().result).toMatchObject({status:'not-beaten',won:false,
   candidate:{seed:42,selection:['housing'],cumulativeCapitalExpense:0},
   budget:{cap:0,candidateSpent:0,candidateWithinCap:true}});
  expect(panel.getState().envelope).toEqual(envelope);
  expect(control('result').textContent).toContain('Actual capital spent: reference 0 / candidate 0');
 }finally{panel.destroy();}
},10000);
