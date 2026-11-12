import {test,expect} from 'bun:test';
import {createCanvas2DStage} from '../world/future-machine/fallback/index.js';
function fixture(noContext=false) {
 const nodes=[];const handlers=new Map();const drawing={fail:false};
 const doc={createElement(tag){const node={tag,children:[],style:{},clientWidth:390,clientHeight:400,setAttribute(){},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},remove(){this.removed=true;},getContext:()=>noContext?null:new Proxy({},{get:()=>()=>{if(drawing.fail)throw new Error('Drawing failed');},set:()=>true}),addEventListener:(key,fn)=>handlers.set(key,fn),removeEventListener:key=>handlers.delete(key)};node.ownerDocument=doc;nodes.push(node);return node;}};
 return {container:doc.createElement('main'),nodes,handlers,drawing};
}
const snapshot=(month,ids)=>({state:{month,buildings:ids.map(id=>({id})),projects:[]},metrics:{homes:ids.length,rent:null},events:[]});
test('snapshot adapter retains real IDs, metrics, recorded month and camera rendering without mutation',()=>{
 const f=fixture(),selected=[],stage=createCanvas2DStage(f.container,{onSelect:e=>selected.push(e)});
 const frame={month:16,baseline:snapshot(16,['a']),plan:snapshot(16,['a','b'])};const before=JSON.stringify(frame);
 stage.update(frame,{available:true,entities:[{collection:'buildings',id:'b',kind:'added'}]});
 expect(stage.getStats().backend).toBe('canvas2d');expect(stage.getStats().month).toBe(16);
 expect(f.nodes.some(n=>n.textContent==='homes: 2 · rent: unavailable')).toBe(true);
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
 expect(stage.getStats().error).toBe('Scenes require matched City months');
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
