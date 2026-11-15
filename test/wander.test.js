import {test,expect} from 'bun:test';
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
import {createWanderRoute,createWanderController} from '../world/wander/route.js';
const town=()=>buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:16});
test('seed-stable bounded street route uses exact synthetic identities without mutation',()=>{
 const t=town(),world=createWorld(t),before=JSON.stringify(world.captureCheckpoint());
 const r=createWanderRoute(t);expect(r).toEqual(createWanderRoute(t));expect(r.stops).toHaveLength(4);
 expect(new Set(r.stops.map(s=>s.landmarkId)).size).toBe(4);
 expect(createWanderRoute(t,{round:1})).not.toEqual(r);
 for(const s of r.stops){expect(Math.abs(s.x)).toBeLessThan(431);expect(Math.abs(s.z)).toBeLessThan(431);const b=t.buildings.find(b=>b.id===s.landmarkId);expect(s.label).toBe(`Synthetic ${b.kind} · ${b.id}`);}
 expect(JSON.stringify(world.captureCheckpoint())).toBe(before);
});
test('fail closed for unavailable, unrendered, blocked and missing roads',()=>{
 expect(createWanderRoute(null)).toBeNull();
 const t=town();expect(createWanderRoute({...t,source:'osm'})).toBeNull();expect(createWanderRoute({...t,source:'synthetic'})).toBeNull();
 expect(createWanderRoute(t,{rendered:()=>false})).toBeNull();expect(createWanderRoute({...t,roads:[]})).toBeNull();
 t.buildings[0].blocked=true;expect(createWanderRoute(t)).toBeNull();delete t.buildings[0].blocked;
 t.buildings[0].state={flooded:true};expect(createWanderRoute(t)).toBeNull();
});
test('every generated segment stays on clear grid for multiple seeds',()=>{
 for(let seed=0;seed<20;seed++){
  const t=town(),r=createWanderRoute(t,{seed});expect(r).not.toBeNull();
  for(let i=0;i<4;i++){
   const a=r.stops[i],b=r.stops[(i+1)%4];expect(Math.hypot(b.x-a.x,b.z-a.z)).toBe(86);
   for(let n=0;n<=86;n++){const x=a.x+(b.x-a.x)*n/86,z=a.z+(b.z-a.z)*n/86;
    expect(t.buildings.some(b=>x>=Math.min(...b.poly.map(p=>p[0]))&&x<=Math.max(...b.poly.map(p=>p[0]))&&z>=Math.min(...b.poly.map(p=>p[1]))&&z<=Math.max(...b.poly.map(p=>p[1])))).toBe(false);
   }
  }
 }
});
test('controller interrupts immediately, bounds time, supports static stepping and invalidation',()=>{
 const t=town(),r=createWanderRoute(t);let available=true,manual=false,moves=[];
 const c=createWanderController({getRoute:()=>available?r:null,move:p=>moves.push(p),manual:()=>manual});
 expect(c.start()).toBe(true);for(let n=0;n<245;n++)c.update(n*100);expect(c.getState().reason).toBe('complete');
 c.start();c.update(0);c.update(100);c.stop();const count=moves.length;c.update(200);expect(moves.length).toBe(count);
 manual=true;c.start();const staticCount=moves.length;for(let n=0;n<100;n++)c.update(n*100);expect(moves.length).toBe(staticCount);c.next();expect(c.getState().index).toBe(1);
 available=false;c.update(10000);expect(c.getState().reason).toBe('unavailable');expect(c.start()).toBe(false);
});
test('real simulation continuation and RNG are seed-matched with and without stroll',()=>{
 const a=town(),b=town(),w1=createWorld(a),w2=createWorld(b),initial=JSON.stringify(w1.captureCheckpoint());
 const c=createWanderController({getRoute:()=>createWanderRoute(a),move:()=>{}});
 c.start();c.update(0);c.update(100);c.next();c.stop();expect(JSON.stringify(w1.captureCheckpoint())).toBe(initial);
 for(let i=0;i<10;i++){c.start();c.update(i*1000);w1.step(1);w2.step(1);c.stop();}
 expect(w1.captureCheckpoint()).toEqual(w2.captureCheckpoint());
});
test('lost render support stops the next camera write; long suspension completes the bound',()=>{
 const t=town();let visible=true,moves=0;
 const c=createWanderController({getRoute:()=>createWanderRoute(t,{rendered:()=>visible}),move:()=>moves++});
 c.start();const before=moves;visible=false;c.update(1);expect(moves).toBe(before);expect(c.getState().reason).toBe('unavailable');
 visible=true;c.start();c.update(0);c.update(90000);expect(c.getState().reason).toBe('complete');
});
test('panel integrates static keyboard controls, opt-out, unavailable UI and listener disposal',async()=>{
 const {mountWander}=await import('../world/wander/panel.js');
 class Element extends EventTarget{hidden=false;disabled=false;textContent='';focused=false;focus(){this.focused=true;}contains(target){return target===this||this.children?.includes(target);}}
 const ids=Object.fromEntries(['wander-panel','wander-start','wander-next','wander-end','wander-status'].map(id=>[id,new Element()]));
 ids['wander-panel'].children=Object.values(ids);
 const doc=Object.assign(new EventTarget(),{getElementById:id=>ids[id],body:new Element(),hidden:false});
 const savedDocument=globalThis.document,savedMedia=globalThis.matchMedia;
 globalThis.document=doc;globalThis.matchMedia=()=>({matches:true});
 try{
  let writes=0;const t=town(),world=createWorld(t),before=JSON.stringify(world.captureCheckpoint());
  const panel=mountWander({town:t,move:()=>writes++});expect(ids['wander-start'].disabled).toBe(false);
  ids['wander-start'].dispatchEvent(new Event('click'));expect(panel.getState().active).toBe(true);expect(ids['wander-start'].hidden).toBe(true);
  expect(ids['wander-status'].textContent).toContain('Synthetic');panel.update(0);panel.update(10000);expect(writes).toBe(1);
  ids['wander-next'].dispatchEvent(new Event('click'));expect(panel.getState().index).toBe(1);
  const escape=new Event('keydown');Object.defineProperty(escape,'key',{value:'Escape'});doc.dispatchEvent(escape);expect(panel.getState().active).toBe(false);
  ids['wander-start'].dispatchEvent(new Event('click'));doc.dispatchEvent(new Event('pointerdown'));expect(panel.getState().active).toBe(false);
  ids['wander-start'].dispatchEvent(new Event('click'));ids['wander-end'].dispatchEvent(new Event('click'));expect(ids['wander-start'].focused).toBe(true);
  expect(JSON.stringify(world.captureCheckpoint())).toBe(before);panel.destroy();
  ids['wander-start'].dispatchEvent(new Event('click'));expect(panel.getState().active).toBe(false);
  const unavailable=mountWander({town:{...t,source:'osm'},move:()=>writes++});expect(ids['wander-start'].disabled).toBe(true);expect(ids['wander-status'].textContent).toContain('unavailable');unavailable.destroy();
 }finally{globalThis.document=savedDocument;globalThis.matchMedia=savedMedia;}
});
