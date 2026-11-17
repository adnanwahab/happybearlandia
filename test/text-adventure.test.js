import {test,expect} from 'bun:test';
import {nearbyResidents,residentEvents} from '../world/text-adventure.js';
import {createPopulationRuntime} from '../world/population/runtime.js';

test('nearby list uses verified finite positions and exact IDs; missing data stays empty',()=>{
 expect(nearbyResidents(null)).toEqual([]);
 expect(nearbyResidents({visibleAgents:[{id:'far',x:501,z:0},{id:'bad',x:NaN,z:0},{id:'edge',x:300,z:400},{id:'near',x:1,z:0}]}).map(p=>p.id)).toEqual(['near','edge']);
 expect(residentEvents({id:'a',decisionTrace:[{id:'x',actorId:'b',minute:1}],currentAlternatives:{alternatives:[1]}})).toEqual([]);
});

test('real worker decisions retain actor, inputs, versions and deterministic seed replay',async()=>{
 async function execute(){const r=createPopulationRuntime({config:{population:16,seed:42,snapshotId:'text-adventure.v1'},worldContext:{},workerCount:1,stepMinutes:30});
  try{await r.ready;const id=nearbyResidents(r.getSnapshot())[0].id;expect(residentEvents(await r.inspectPerson(id))).toEqual([]);
   for(let i=0;i<48;i++)await r.step();
   const s=r.getSnapshot(),events=residentEvents(await r.inspectPerson(id));expect(events.length).toBeGreaterThan(0);
   expect(events[0].actorId).toBe(id);expect(events[0].inputs).toBeDefined();expect(events[0].behaviorModelVersion).toBe(s.modelVersion);
   return {id,events,metrics:s.metrics,config:s.config,provenance:s.provenance};
  }finally{r.destroy();}}
 expect(await execute()).toEqual(await execute());
});

// Minimal semantic DOM verifies focus ownership and interactions without claiming
// browser layout or accessibility-tree coverage.
class SemanticNode {
 constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this._text='';}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ');}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
 remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}
 querySelector(tag){return this.querySelectorAll(tag)[0];}focus(){this.ownerDocument.activeElement=this;}
}
test('semantic World → resident → real event → WHY focus, empty state, denial, recovery and deletion',async()=>{
 const {mountTextAdventure}=await import('../world/text-adventure.js');
 const doc={createElement(tag){return new SemanticNode(tag,this);}},root=doc.createElement('main');
 const r=createPopulationRuntime({config:{population:16,seed:42,snapshotId:'text-adventure.v1'},workerCount:1});
 let denied=false;const runtime={getSnapshot:()=>r.getSnapshot(),step:()=>r.step(),destroy:()=>r.destroy(),inspectPerson:id=>{if(denied)throw Error('denied');return r.inspectPerson(id);}};
 const click=async prefix=>{const b=root.querySelectorAll('button').find(n=>n.textContent.startsWith(prefix));expect(b).toBeDefined();b.onclick();for(let i=0;root.attrs['aria-busy']==='true'&&i<2000;i++)await Bun.sleep(1);expect(root.attrs['aria-busy']).toBeUndefined();};
 let api;try{await r.ready;api=mountTextAdventure({root,runtime});
  expect(doc.activeElement.textContent).toBe('Nearby residents');expect(root.querySelectorAll('dd')[0].textContent).toBe(String(r.getSnapshot().metrics.syntheticPopulation));
  await click('Inspect');expect(doc.activeElement.textContent).toStartWith('Resident ·');expect(root.textContent).toContain('No retained decision events');
  for(let i=0;i<48;i++)await click('Advance');
  await click('Event ');expect(doc.activeElement.textContent).toStartWith('Event ·');
  await click('WHY');expect(doc.activeElement.textContent).toBe('WHY · Recorded decision evidence');
  expect(root.textContent).toContain('"actorId"');expect(root.textContent).toContain('"inputs"');expect(root.textContent).toContain('"seed": 42');expect(root.textContent).toContain('"modelVersion": "1.3.0"');
  await click('Back to event');expect(doc.activeElement.textContent).toStartWith('Event ·');await click('Back to resident');
  denied=true;await click('Advance');expect(root.textContent).toContain('Data unavailable or access denied');expect(doc.activeElement.textContent).toBe('Look nearby');
  denied=false;await click('Look nearby');expect(doc.activeElement.textContent).toBe('Nearby residents');
  await click('Clear');expect(root.textContent).toContain('Nothing was shared or saved');expect(doc.activeElement.tag).toBe('h1');
 }finally{api?.destroy();r.destroy();}
});

test('normal World entry selects an isolated semantic document without gameplay scripts',async()=>{
 const server=await Bun.file(new URL('../server.js',import.meta.url)).text();
 const entry=await Bun.file(new URL('../world/text-adventure.html',import.meta.url)).text();
 expect(server).toContain('["/world", "/world/"].includes(pathname) && new URL(request.url).searchParams.get("text") === "1"');
 expect(server.indexOf('return serveFile("./world/text-adventure.html")')).toBeLessThan(server.indexOf('if (under(pathname, "/world"))'));
 expect(entry).toContain('startTextAdventure');expect(entry).not.toMatch(/renderer-entry|canvas|launch-shell|session-recorder/);
 for(const path of ['../world/index.html','../world/static-city.html'])expect(await Bun.file(new URL(path,import.meta.url)).text()).toContain('href="/world?text=1"');
});
