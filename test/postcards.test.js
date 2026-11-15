import {test,expect} from 'bun:test';
import {postcardScenario} from '../world/universe/postcards.js';
import {EXPERIENCES} from '../world/universe/registry.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {parseShareURL} from '../world/future-machine/share/index.js';
test('supported postcard opens the exact validated new preset, with no saved identity',()=>{
 const before=JSON.stringify(DEFAULT_RECIPE),a=postcardScenario('future-machine');
 const url=new URL(a.href,'http://localhost');
 expect(parseShareURL(url.href)).toEqual({recipe:DEFAULT_RECIPE,experimentId:null,month:0});
 expect(url.searchParams.get('renderer')).toBe('canvas2d');
 expect(JSON.stringify(DEFAULT_RECIPE)).toBe(before);
});
test('every unsupported and unknown postcard explains the missing adapter without a launch URL',()=>{
 for(const app of EXPERIENCES.filter(x=>x.id!=='future-machine')){
 const result=postcardScenario(app.id);expect(result.href).toBeUndefined();expect(result.reason).toContain('no validated experiment preset');
 }
 for(const id of ['bad','__proto__','https://evil.test']) expect(postcardScenario(id).href).toBeUndefined();
});

// Minimal event surface isolates navigation intent from a browser/server dependency.
import {mountPostcards} from '../world/universe/postcards.js';
class Element extends EventTarget {
 constructor(doc){super();this.ownerDocument=doc;this.dataset={};this.children=[];this.attributes={};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attributes[key]=value;}
 removeAttribute(key){delete this.attributes[key];}
 focus(){this.ownerDocument.activeElement=this;}
 querySelector(key){return this.parts[key];}
 querySelectorAll(){return this.children;}
}
function fixture(){
 const doc=new EventTarget();doc.createElement=()=>new Element(doc);
 const host=new Element(doc),target=new Element(doc);
 target.parts={h2:new Element(doc),p:new Element(doc)};
 for(const id of ['future-machine','world']){const card=new Element(doc);card.dataset.experienceId=id;host.append(card);}
 const launched=[];mountPostcards(host,target,url=>launched.push(url));
 const data=new Map(),dataTransfer={setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)};
 const fire=(node,type,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{dataTransfer},extra);node.dispatchEvent(e);return e;};
 return {doc,host,target,launched,fire,dataTransfer};
}
test('drag hover and cancellation have zero navigation; completed drop opens once',()=>{
 const f=fixture(),card=f.host.children[0];
 f.fire(card,'dragstart');expect(f.fire(f.target,'dragover').defaultPrevented).toBe(true);expect(f.launched).toEqual([]);
 f.fire(card,'dragend');f.fire(f.target,'drop');expect(f.launched).toEqual([]);
 f.fire(card,'dragstart');f.fire(f.doc,'keydown',{key:'Escape'});f.fire(f.target,'drop');expect(f.launched).toEqual([]);
 f.fire(card,'dragstart');f.fire(f.target,'drop');f.fire(f.target,'drop');expect(f.launched).toEqual([postcardScenario('future-machine').href]);
});
test('foreign and mismatched payloads cannot navigate; unsupported click/drop focuses explanation',()=>{
 const f=fixture();f.dataTransfer.setData('application/x-hbl-postcard','future-machine');f.fire(f.target,'drop');expect(f.launched).toEqual([]);
 f.fire(f.host.children[0],'dragstart');f.dataTransfer.setData('application/x-hbl-postcard','world');f.fire(f.target,'drop');expect(f.launched).toEqual([]);
 const card=f.host.children[1];f.fire(card.children[1],'click');
 const status=f.target.children[0];expect(status.textContent).toContain('no validated experiment preset');expect(f.doc.activeElement).toBe(status);
 f.fire(card,'dragstart');f.fire(f.target,'drop');expect(f.launched).toEqual([]);expect(f.doc.activeElement).toBe(status);
});
test('click action matches drop preset',()=>{const f=fixture();f.fire(f.host.children[0].children[1],'click');expect(f.launched).toEqual([postcardScenario('future-machine').href]);});
