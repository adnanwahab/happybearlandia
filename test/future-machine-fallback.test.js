import {test,expect} from 'bun:test';
import {createCanvas2DStage} from '../world/future-machine/fallback/index.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {compareFrame} from '../world/future-machine/diff/index.js';
function fixture(noContext=false) {
 const nodes=[];const handlers=new Map();const drawing={fail:false};
 const doc={createElement(tag){const node={tag,children:[],style:{},clientWidth:390,clientHeight:400,setAttribute(){},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},remove(){this.removed=true;},getContext:()=>noContext?null:new Proxy({},{get:()=>()=>{if(drawing.fail)throw new Error('Drawing failed');},set:()=>true}),addEventListener:(key,fn)=>handlers.set(key,fn),removeEventListener:key=>handlers.delete(key)};node.ownerDocument=doc;nodes.push(node);return node;}};
 return {container:doc.createElement('main'),nodes,handlers,drawing};
}
const snapshot=(month,ids)=>({month,state:{month,buildings:ids.map(id=>({id})),projects:[]},metrics:{homes:ids.length,rent:null},events:[]});
test('snapshot adapter retains real IDs, metrics, recorded month and camera rendering without mutation',()=>{
 const f=fixture(),selected=[],stage=createCanvas2DStage(f.container,{onSelect:e=>selected.push(e)});
 const frame={month:16,baseline:snapshot(16,['a']),plan:snapshot(16,['a','b'])};const before=JSON.stringify(frame);
 stage.update(frame,{available:true,entities:[{collection:'buildings',id:'b',kind:'added'}]});
 expect(stage.getStats().backend).toBe('canvas2d');expect(stage.getStats().month).toBe(16);
 expect(f.nodes.some(n=>n.textContent?.includes('homes: 2 · rent: unavailable'))).toBe(true);
 f.nodes.findLast(n=>n.textContent==='buildings: b · added').onclick();expect(selected).toEqual([{collection:'buildings',id:'b',arm:'plan'}]);
 expect(stage.focus({collection:'buildings',id:'b'})).toBe(true);expect(JSON.stringify(frame)).toBe(before);
 stage.update(null,null);expect(stage.getStats().objects).toBe(0);stage.dispose();stage.dispose();expect(f.handlers.size).toBe(0);
});
test('failed Canvas context preserves accessible exact inventory and reports missing measurements',()=>{
 const f=fixture(true),stage=createCanvas2DStage(f.container);
 stage.update({month:0,baseline:snapshot(0,['same']),plan:snapshot(0,['same'])},null);
 expect(stage.getStats().backend).toBe('inventory-fallback');expect(stage.getStats().error).toBe('Canvas2D unavailable');
 expect(f.nodes.filter(n=>n.textContent==='buildings: same')).toHaveLength(2);
 stage.setMode('baseline');expect(()=>stage.setMode('wrong')).toThrow();stage.dispose();expect(stage.focus({id:'same'})).toBe(false);
});

test('drawing failure releases Canvas and retains exact metrics, events and selectable inventory',()=>{
 const f=fixture(),selected=[],stage=createCanvas2DStage(f.container,{onSelect:e=>selected.push(e)});
 const frame={month:0,baseline:snapshot(0,['a']),plan:snapshot(0,['a'])};
 frame.plan.events=[{id:'recorded-event',month:0}];stage.update(frame,null);
 f.drawing.fail=true;
 expect(()=>stage.setMode('plan')).not.toThrow();
 expect(stage.getStats().backend).toBe('inventory-fallback');
 expect(stage.getStats().error).toBe('Drawing failed');expect(f.handlers.size).toBe(0);
 expect(f.nodes.some(n=>n.textContent?.includes('recorded-event'))).toBe(true);
 f.nodes.findLast(n=>n.textContent==='buildings: a').onclick();
 expect(selected).toEqual([{collection:'buildings',id:'a',arm:'plan'}]);
 stage.dispose();
});
test('malformed matched data is explicit and empty metrics remain unavailable',()=>{
 const f=fixture(),stage=createCanvas2DStage(f.container);
 const frame={month:0,baseline:snapshot(0,['a']),plan:snapshot(1,['b'])};
 frame.plan.metrics={};expect(()=>stage.update(frame,null)).not.toThrow();
 expect(stage.getStats().backend).toBe('inventory-fallback');
 expect(stage.getStats().error).toBe('Snapshot month does not match frame');
 expect(f.nodes.some(n=>n.textContent==='Metrics unavailable')).toBe(true);stage.dispose();
});
test('difference inventory filters unchanged identities and camera persists across recorded months',()=>{
 const f=fixture(),stage=createCanvas2DStage(f.container);
 const diff={available:true,entities:[{collection:'buildings',id:'b',kind:'added'}]};
 stage.update({month:16,baseline:snapshot(16,['a']),plan:snapshot(16,['a','b'])},diff);
 stage.focus({collection:'buildings',id:'b'});const camera=stage.getCamera();
 stage.update({month:17,baseline:snapshot(17,['a']),plan:snapshot(17,['a','b'])},diff);
 expect(stage.getCamera()).toEqual(camera);stage.setMode('difference');
 const inventory=f.container.children[0].children[2];
 const buttons=inventory.children.flatMap(n=>n.children).filter(n=>n.tag==='button');
 expect(buttons.map(n=>n.textContent)).toEqual(['buildings: b · added']);stage.dispose();
});


test('real seed-42 snapshots preserve Month 0/16 evidence and unavailable measurements',()=>{
 const initial=initialForRecipe(),engine=createEngine();
 const baseline=normalizeReplay(initial,engine.run(initial,120));
 const plan=normalizeReplay(initial,engine.run(addIntervention(initial,DEFAULT_RECIPE.intervention),120));
 const f=fixture(),stage=createCanvas2DStage(f.container);
 try{
  for(const month of [0,16]){
   const frame={month,baseline:baseline[month],plan:plan[month]},before=JSON.stringify(frame),diff=compareFrame(frame);
   stage.update(frame,diff);
   expect(stage.getStats()).toMatchObject({backend:'canvas2d',month,animationFrames:0});
   expect(JSON.stringify(frame)).toBe(before);expect(diff.metrics.housingUnits.delta).toBe(month===0?0:24);
   expect(f.nodes.some(n=>n.textContent?.includes(`housingUnits: ${plan[month].metrics.housingUnits} homes`))).toBe(true);
  }
  stage.setMode('difference');stage.setGhosts(false);
  expect(stage.focus({collection:'buildings',id:'building-project-policy-1-0'})).toBe(true);
  expect(stage.focus({collection:'buildings',id:'invented'})).toBe(false);
  stage.update({month:0,baseline:{month:0,state:initial,metrics:{housingUnits:0}},plan:null},{available:false});
  expect(stage.getStats().objects).toBe(0);
  expect(f.nodes.some(n=>n.textContent?.includes('housingUnits: 0 homes'))).toBe(true);
  expect(f.nodes.some(n=>n.textContent?.includes('meanRent: unavailable USD/month'))).toBe(true);
  stage.update({month:1,baseline:{month:0,state:initial},plan:null});
  expect(stage.getStats().error).toBe('Snapshot month does not match frame');
  expect(stage.getStats().backend).toBe('inventory-fallback');
 }finally{stage.dispose();}
 expect(f.handlers.size).toBe(0);
},15000);
