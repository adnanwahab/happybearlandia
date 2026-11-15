import {test,expect} from 'bun:test';
import {buildSpotlight} from '../world/future-machine/diff/spotlight.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {compareHistory} from '../world/future-machine/diff/index.js';
function pair(policy=DEFAULT_RECIPE.intervention){const initial=initialForRecipe();const run=p=>{let state=p?addIntervention(initial,p):structuredClone(initial);const engine=createEngine(),steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});};return {seed:42,modelVersion:initial.version,baseline:run(null),plan:run(policy)};}
test('actual seed-matched City events own every stop, deterministic, immutable and deduplicated',()=>{
 const h=pair(),diffs=compareHistory(h),before=JSON.stringify(h),result=buildSpotlight(h,diffs);
 expect(result.status).toBe('ready');expect(result.stops.length).toBeGreaterThan(1);
 for(const stop of result.stops){const snapshot=h[stop.entity.arm].find(s=>s.month===stop.month);expect(snapshot.events.some(e=>e.id===stop.eventId&&e.simulationTime===stop.month)).toBe(true);expect(snapshot.state[stop.entity.collection].some(e=>e.id===stop.entity.id)).toBe(true);}
 expect(new Set(result.stops.map(s=>`${s.entity.arm}:${s.eventId}`)).size).toBe(result.stops.length);
 expect(result.stops.at(-1)).toMatchObject({month:16,entity:{id:'building-project-policy-1-0'}});
 expect(buildSpotlight(h,[...diffs].reverse())).toEqual(result);expect(JSON.stringify(h)).toBe(before);
 const duplicated=structuredClone(h);for(const s of duplicated.plan)s.events.push(...s.events);expect(buildSpotlight(duplicated,diffs)).toEqual(result);
 const samples=[];for(let i=0;i<100;i++){const start=performance.now();buildSpotlight(h,diffs);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);console.log('SHE-478 selector 100 warm runs ms',JSON.stringify({p50:samples[50],p95:samples[95],max:samples[99]}));
});
test('unchanged, missing and unsupported comparisons are distinct; absent or wrong-time receipts never produce stops',()=>{
 const zero=pair(null);expect(buildSpotlight(zero,compareHistory(zero))).toEqual({status:'empty',stops:[]});
 expect(buildSpotlight(null).status).toBe('unavailable');expect(buildSpotlight(zero,[{available:false}]).status).toBe('unavailable');
 const h=pair(),diffs=compareHistory(h);for(const s of h.plan)for(const e of s.events)e.simulationTime=121;
 expect(buildSpotlight(h,diffs)).toEqual({status:'unsupported',stops:[]});
});

test('component disables unavailable controls, bounds visits, clears old run and preserves literal IDs',async()=>{
 const {mountSpotlight}=await import('../world/future-machine/ui/spotlight.js');
 const doc={createElement:tag=>new Element(tag)};
 class Element{constructor(tag){this.tag=tag;this.children=[];this.ownerDocument=doc;this.handlers={};}setAttribute(k,v){this[k]=v;}append(...nodes){this.children.push(...nodes);}addEventListener(type,fn){this.handlers[type]=fn;}remove(){this.removed=true;}}
 const host=new Element('main'),visits=[],view=mountSpotlight(host,{onVisit:s=>visits.push(s)}),[title,status,previous,next]=view.root.children;
 expect(next.disabled).toBe(true);expect(status.textContent).toContain('unavailable');
 for(const kind of ['empty','unsupported','unavailable']){view.reset({status:kind,stops:[]});view.update(true);expect(next.disabled).toBe(true);next.handlers.click();expect(visits).toHaveLength(0);}
 const stop={month:4,eventId:'<event>',entity:{collection:'projects',id:'<script>',arm:'plan'}};
 view.reset({status:'ready',stops:[stop,{...stop,month:5,eventId:'next'}]});expect(previous.disabled).toBe(true);next.handlers.click();expect(visits[0]).toEqual(stop);expect(status.textContent).toContain('<script>');expect(previous.disabled).toBe(true);
 next.handlers.click();expect(next.disabled).toBe(true);next.handlers.click();expect(visits).toHaveLength(2);previous.handlers.click();expect(visits[2]).toEqual(stop);
 view.update(false);next.handlers.click();expect(visits).toHaveLength(3);view.reset({status:'empty',stops:[]});expect(status.textContent).toContain('No recorded changes');view.dispose();expect(view.root.removed).toBe(true);
});
