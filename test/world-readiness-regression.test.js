import {test,expect} from 'bun:test';
import {mountControlReadiness,withMetadataDeadline} from '../world/onboarding/first-run-repairs.js';

function fixture(){
 let callback,observed,disconnected=false,writes=0;
 const node=(attributes={})=>({attributes:new Map(Object.entries(attributes)),disabled:false,hidden:false,textContent:'',
  getAttribute(key){return this.attributes.get(key)??null;},
  setAttribute(key,value){writes++;this.attributes.set(key,String(value));},
  removeAttribute(key){writes++;this.attributes.delete(key);},remove(){this.removed=true;}});
 const controls=[node({title:'Original tooltip','aria-description':'Original help'}),node()];
 const root={append(value){this.note=value;},querySelectorAll(){return controls.filter(c=>c.disabled);}};
 class Observer{constructor(fn){callback=fn;}observe(_root,options){observed=options;}disconnect(){disconnected=true;}}
 const document={defaultView:{MutationObserver:Observer},getElementById:()=>root,createElement:()=>node()};
 return {document,controls,root,update:()=>callback(),get writes(){return writes;},get observed(){return observed;},get disconnected(){return disconnected;}};
}
test('reenabling restores original title/help and removes reasons absent before loading',()=>{
 const f=fixture();f.controls.forEach(c=>c.disabled=true);
 const mounted=mountControlReadiness(f.document,()=> 'Waiting for scene.');
 expect(f.root.note.textContent).toBe('Waiting for scene.');
 f.controls.forEach(c=>c.disabled=false);f.update();
 expect(f.controls[0].getAttribute('title')).toBe('Original tooltip');
 expect(f.controls[0].getAttribute('aria-description')).toBe('Original help');
 expect(f.controls[1].getAttribute('title')).toBeNull();expect(f.controls[1].getAttribute('aria-description')).toBeNull();
 expect(f.root.note.hidden).toBe(true);mounted.dispose();
});
test('repeated readiness updates do not write the same attributes or observe their own annotations',()=>{
 const f=fixture();f.controls[0].disabled=true;let reason='Loading scene.';
 const mounted=mountControlReadiness(f.document,()=>reason),writes=f.writes;
 f.update();f.update();expect(f.writes).toBe(writes);
 expect(f.observed.attributeFilter).toEqual(['disabled','hidden']);
 reason='Loading policies.';f.update();expect(f.controls[0].getAttribute('title')).toBe(reason);
 mounted.dispose();expect(f.controls[0].getAttribute('title')).toBe('Original tooltip');expect(f.disconnected).toBe(true);
});
test('cleanup preserves explanations another owner replaces and handles hidden controls',()=>{
 const f=fixture();f.controls[0].disabled=true;
 const mounted=mountControlReadiness(f.document,()=> 'Loading scene.');
 f.controls[0].setAttribute('title','New feature help');f.controls[0].hidden=true;f.update();
 expect(f.controls[0].getAttribute('title')).toBe('New feature help');
 expect(f.controls[0].getAttribute('aria-description')).toBe('Original help');mounted.dispose();
});
test('an empty prerequisite restores prior annotations without enabling the control',()=>{
 const f=fixture();f.controls[0].disabled=true;let reason='Loading scene.';
 const mounted=mountControlReadiness(f.document,()=>reason);reason='';f.update();
 expect(f.controls[0].disabled).toBe(true);expect(f.controls[0].getAttribute('title')).toBe('Original tooltip');mounted.dispose();
});
test('stalled provenance rejects on deadline while successful and failed assets retain actual results',async()=>{
 const data={status:'definitions-ready'};
 expect(await withMetadataDeadline(Promise.resolve(data),20)).toBe(data);
 await expect(withMetadataDeadline(Promise.reject(new Error('asset HTTP 503')),20)).rejects.toThrow('asset HTTP 503');
 await expect(withMetadataDeadline(new Promise(()=>{}),5)).rejects.toThrow('Parameter provenance did not load. Reload to retry; simulation controls remain available.');
});
test('updated outside help survives a second loading phase and final disposal',()=>{
 const f=fixture();f.controls[0].disabled=true;let reason='Loading scene.';
 const mounted=mountControlReadiness(f.document,()=>reason);
 f.controls[0].setAttribute('title','Feature-specific updated tooltip');
 reason='Loading policies.';f.update();
 expect(f.controls[0].getAttribute('title')).toBe(reason);
 f.controls[0].disabled=false;f.update();
 expect(f.controls[0].getAttribute('title')).toBe('Feature-specific updated tooltip');
 f.controls[0].disabled=true;f.update();mounted.dispose();
 expect(f.controls[0].getAttribute('title')).toBe('Feature-specific updated tooltip');
 expect(f.controls[0].getAttribute('aria-description')).toBe('Original help');
});
