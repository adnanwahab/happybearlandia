import {test,expect} from 'bun:test';
import {tripFireflies} from '../world/population/fireflies.js';
import {fireflyFixture} from './fixtures/trip-fireflies.js';
test('committed samples retain identity, weights and deterministic route progress',()=>{
 const frame=fireflyFixture(),before=structuredClone(frame),a=tripFireflies(frame);
 expect(a.modeledActiveTrips).toBe(1200);expect(a.particles).toHaveLength(160);
 expect(a.particles[0].position).toEqual({x:5,z:0,heading:Math.PI/2});
 expect(a.samplingWeight).toBeNull();expect(a.particles[0].representationWeight).toBe(10);
 expect(tripFireflies(frame)).toEqual(a);expect(frame).toEqual(before);
 expect(tripFireflies({...frame,visibleAgents:[...frame.visibleAgents].reverse()})).toEqual(a);
});
test('missing and invalid routes never invent travel or totals',()=>{
 expect(tripFireflies(null).modeledActiveTrips).toBeNull();
 const f=fireflyFixture();f.visibleAgents=f.visibleAgents.slice(0,1);
 for(const change of [t=>t.route.kind='straight-line fallback',t=>t.route.points[0][0]=NaN,t=>t.route.distanceMetres=999,t=>t.progress=2,t=>t.remainingMinutes=0,t=>t.route.rulesVersion='unknown']){const bad=structuredClone(f);change(bad.visibleAgents[0].trip);expect(tripFireflies(bad).particles).toEqual([]);}
 expect(tripFireflies(f,Infinity).particles).toEqual([]);
 f.visibleAgents.push(f.visibleAgents[0]);expect(tripFireflies(f).particles).toHaveLength(1);
});
test('snapshot replay and run revision isolation',()=>{
 const frame=fireflyFixture();expect(tripFireflies(JSON.parse(JSON.stringify(frame)))).toEqual(tripFireflies(frame));
 const next=structuredClone(frame);next.runtime.revision++;expect(tripFireflies(next).particles[0].tripKey).not.toBe(tripFireflies(frame).particles[0].tripKey);
});

test('overlay click pins trip receipt, missing source clears markers, destroy releases DOM',async()=>{
 const {mountTripFireflies}=await import('../world/population/fireflies.js');
 class Element {
  constructor(doc){this.ownerDocument=doc;this.children=[];this.style={};this.events={};this.textContent='';}
  append(...items){for(const item of items){this.children.push(item);if(typeof item==='object')item.parent=this;}}
  addEventListener(type,fn){this.events[type]=fn;}
  removeEventListener(type){delete this.events[type];}
  setAttribute(name,value){this[name]=value;}
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 }
 const doc={createElement:()=>new Element(doc)},container=new Element(doc),controls=new Element(doc);
 let frame=fireflyFixture(),selected=null;
 const ui=mountTripFireflies({container,controls,getFrame:()=>frame,project:p=>({x:p.x,y:p.z}),onSelect:id=>selected=id});
 const panel=controls.children[0],toggle=panel.children[1].children[0],receipt=panel.children[3];
 toggle.checked=true;ui.update(0);expect(ui.getState().allocatedMarkers).toBe(160);
 const overlay=container.children[0];overlay.children[0].events.click();
 expect(selected).toBe('fixture-p000');expect(receipt.textContent).toContain('"departureMinute": 1070');
 const pose=overlay.children[0].style.left;ui.update(1000);expect(overlay.children[0].style.left).toBe(pose);
 frame=null;ui.update(1016);expect(overlay.children.every(b=>b.hidden)).toBe(true);expect(receipt.textContent).toBe('');
 ui.destroy();ui.destroy();ui.update(1032);expect(container.children).toEqual([]);expect(controls.children).toEqual([]);expect(ui.getState().allocatedMarkers).toBe(0);expect(ui.getState().latest).toBeNull();
});
