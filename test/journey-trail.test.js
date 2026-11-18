import {test,expect} from 'bun:test';
import {createJourneyTrail} from '../world/population/journey-trail.js';
const frame=(tick,patch={})=>({minute:tick,runtime:{id:'run-a',revision:1,tick,stepMinutes:1},modelVersion:'v1',config:{seed:42},visibleAgents:[{id:'resident',x:tick,z:0,trip:{schemaVersion:'population-current-trip.v1',departureMinute:0,remainingMinutes:100,from:{x:0,z:0},to:{x:100,z:0},geometry:'model approximation'}}],...patch});
test('selected committed trip uses exact positions and provenance without mutating evidence',()=>{
 const trail=createJourneyTrail();trail.select('resident');const input=frame(1),before=structuredClone(input);trail.observe(input);trail.observe(frame(2));trail.observe(frame(2));
 expect(input).toEqual(before);expect(trail.getSamples()).toHaveLength(2);expect(trail.getSamples()[1]).toMatchObject({personId:'resident',runId:'run-a',revision:1,tick:2,minute:2,x:2,z:0,seed:42,connected:true});
 const copy=trail.getSamples();copy[0].x=99;expect(trail.getSamples()[0].x).toBe(1);
});
test('missing positions and skipped ticks create gaps; unsupported trips never invent positions',()=>{
 const trail=createJourneyTrail();trail.select('resident');trail.observe(frame(1));trail.observe(frame(2,{visibleAgents:[]}));trail.observe(frame(3));trail.observe(frame(5));expect(trail.getSamples().map(s=>s.connected)).toEqual([false,false,false]);
 const invalid=frame(6);invalid.visibleAgents[0].x=NaN;trail.observe(invalid);trail.observe(frame(7));expect(trail.getSamples().at(-1).connected).toBe(false);
 const unsupported=frame(8);unsupported.visibleAgents[0].trip.schemaVersion='unknown';trail.observe(unsupported);expect(trail.getSamples()).toEqual([]);trail.observe(null);expect(trail.getSamples()).toEqual([]);
});
test('trip, run, clock and person boundaries clear history; retention is bounded',()=>{
 const trail=createJourneyTrail();trail.select('resident');for(let i=1;i<=100;i++)trail.observe(frame(i));expect(trail.getSamples()).toHaveLength(31);expect(trail.getSamples()[0].connected).toBe(false);
 trail.observe(frame(50));expect(trail.getSamples()).toHaveLength(1);
 const next=frame(51);next.visibleAgents[0].trip.departureMinute=50;trail.observe(next);expect(trail.getSamples()).toHaveLength(1);
 trail.observe(frame(52,{runtime:{id:'other-run',revision:1,tick:52,stepMinutes:1}}));expect(trail.getSamples()).toHaveLength(1);
 trail.select('other');expect(trail.getSamples()).toEqual([]);trail.observe(frame(53));expect(trail.getSamples()).toEqual([]);
});

test('scene ribbon leaves gaps, reuses bounded geometry and disposes on teardown',async()=>{
 const THREE=await import('three'),{mountJourneyTrail}=await import('../world/population/journey-trail.js');
 // Minimal DOM double: geometry/control lifecycle test, not browser evidence.
 const doc={createElement(){return {ownerDocument:doc,children:[],dataset:{},style:{},append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}},setAttribute(k,v){this[k]=v;},remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}};}};
 const container=doc.createElement('section'),scene=new THREE.Scene(),view=mountJourneyTrail({container,scene,THREE});
 view.setActive(true);view.select('resident',frame(1));view.observe(frame(2));view.observe(frame(4));
 const group=scene.getObjectByName('selected-journey-trail'),line=group.children[0],points=group.children[1];
 expect(line.geometry.drawRange.count).toBe(2);expect(points.geometry.drawRange.count).toBe(3);
 const buffer=line.geometry.attributes.position;
 const panel=container.children[0],buttons=panel.children[2],output=panel.children[3];buttons.children[0].onclick();expect(output.textContent).toContain('Minute 1');expect(group.children[2].position.x).toBe(1);
 for(let tick=5;tick<100;tick++)view.observe(frame(tick));expect(line.geometry.attributes.position).toBe(buffer);expect(points.geometry.drawRange.count).toBeLessThanOrEqual(32);expect(buttons.children.length).toBeLessThanOrEqual(32);
 view.setActive(false);expect(group.visible).toBe(false);expect(points.geometry.drawRange.count).toBe(0);expect(buttons.children).toHaveLength(0);
 let disposed=false;line.geometry.addEventListener('dispose',()=>disposed=true);view.destroy();expect(scene.children).toHaveLength(0);expect(container.children).toHaveLength(0);expect(disposed).toBe(true);
});

test('mismatched clocks and future departures are unavailable',()=>{
 const trail=createJourneyTrail();trail.select('resident');trail.observe(frame(1));trail.observe(frame(2,{minute:200}));expect(trail.getSamples()).toEqual([]);
 const future=frame(3);future.visibleAgents[0].trip.departureMinute=4;trail.observe(future);expect(trail.getSamples()).toEqual([]);
 const changed=frame(4);changed.runtime.revision=2;trail.observe(changed);expect(trail.getSamples()[0].revision).toBe(2);expect(trail.getSamples()[0].connected).toBe(false);
});
