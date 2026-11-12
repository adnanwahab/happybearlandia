import {test,expect} from 'bun:test';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
import {createCanvasStage,canvasRows,canvasPoint,canvasViewports,hitTestCanvas,fitCanvasCamera} from '../world/future-machine/scene/canvas-stage.js';
const state=(ids,month=0)=>({month,buildings:ids.map(id=>({id,floors:2})),projects:[]});
const projection=()=>createSpatialMapping().frame(state(['a'],12),state(['a','b'],12));
const diff={available:true,entities:[{collection:'buildings',id:'b',kind:'added'}]};
function fixture(){
 const handlers=new Map();let removed=false, fills=0;
 const context=new Proxy({},{get:(_,name)=>name==='fill'?()=>fills++:()=>{},set:()=>true});
 const canvas={style:{},setAttribute(){},getContext:()=>context,addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n),getBoundingClientRect:()=>({left:0,top:0,width:800,height:400}),focus(){},setPointerCapture(){},remove(){removed=true;}};
 const container={clientWidth:800,clientHeight:400,ownerDocument:{createElement:()=>canvas},append(){}};
 return {canvas,container,handlers,get removed(){return removed;},get fills(){return fills;},emit(name,event={}){handlers.get(name)?.({preventDefault(){},...event,type:name});}};
}
test('pure projection helpers preserve exact identities and recorded month',()=>{
 const p=projection(),before=JSON.stringify(p);const rows=canvasRows(p,diff,'baseline');
 expect(rows.map(r=>[r.id,r.ghost])).toEqual([['a',false],['b',true]]);
 expect(canvasRows(p,diff,'plan','difference').map(r=>r.id)).toEqual(['b']);
 expect(canvasRows(p,{available:false},'plan','difference')).toEqual([]);
 expect(JSON.stringify(p)).toBe(before);expect(p.month).toBe(12);
});
test('hit testing uses the same shared camera in both halves and ignores ghosts',()=>{
 const p=projection(),camera={x:10,z:0,zoom:3},views=canvasViewports(800,400,'split');
 for(const view of views){const rows=canvasRows(p,diff,view.arm),a=rows.find(r=>r.id==='a'),point=canvasPoint(a.x,a.z,camera,view);expect(hitTestCanvas(rows,point.x,point.y,camera,view)?.id).toBe('a');}
 const row=canvasRows(p,diff,'baseline').find(r=>r.id==='b'),point=canvasPoint(row.x,row.z,camera,views[0]);expect(hitTestCanvas([row],point.x,point.y,camera,views[0])).toBe(null);
 expect(hitTestCanvas([],900,200,camera,views[0])).toBe(null);
});
test('fit handles empty data and sourced footprints, mode is bounded',()=>{
 expect(fitCanvasCamera(null,800,400)).toEqual({x:0,z:0,zoom:1});
 expect(fitCanvasCamera(projection(),800,400).zoom).toBeGreaterThan(0);
 expect(()=>canvasViewports(800,400,'invalid')).toThrow();
 const row={id:'poly',collection:'buildings',polygon:[[0,0],[10,0],[0,10]]};
 expect(hitTestCanvas([row],202,202,{x:0,z:0,zoom:1},{x:0,width:400,height:400})?.id).toBe('poly');
 expect(hitTestCanvas([row],209,209,{x:0,z:0,zoom:1},{x:0,width:400,height:400})).toBe(null);
});
test('stage preserves camera across time/mode and synchronously draws with no motion loop',()=>{
 const f=fixture(),stage=createCanvasStage(f.container);stage.update(projection(),diff);expect(f.fills).toBeGreaterThan(0);
 stage.setCamera({x:10,z:20,zoom:2});stage.setMode('difference');stage.setGhosts(false);
 const p=projection();p.month=120;stage.update(p,diff);expect(stage.getCamera()).toEqual({x:10,z:20,zoom:2});expect(stage.getStats().month).toBe(120);expect(stage.getStats().animationFrames).toBe(0);expect(stage.getStats().objects).toBe(1);
 expect(()=>stage.setCamera({x:0,z:NaN,zoom:1})).toThrow();expect(()=>stage.setMode('bad')).toThrow();
 expect(stage.focus({collection:'buildings',id:'unknown'})).toBe(false);expect(stage.focus({collection:'buildings',id:'b'})).toBe(true);
 stage.update(null,null);expect(stage.getStats().objects).toBe(0);stage.dispose();
});
test('click reports exact IDs and arm, dragging and pinch update one camera, disposal removes resources',()=>{
 const f=fixture(),selections=[],changes=[],stage=createCanvasStage(f.container,{onSelect:e=>selections.push(e),onCameraChange:c=>changes.push(c)});stage.update(projection(),diff);stage.setCamera({x:0,z:0,zoom:2});
 f.emit('pointerdown',{pointerId:1,clientX:648,clientY:200});f.emit('pointerup',{pointerId:1,clientX:648,clientY:200});expect(selections).toEqual([{collection:'buildings',id:'b',arm:'plan'}]);
 f.emit('pointerdown',{pointerId:1,clientX:200,clientY:200});f.emit('pointermove',{pointerId:1,clientX:220,clientY:200});f.emit('pointerup',{pointerId:1,clientX:220,clientY:200});expect(stage.getCamera().x).toBe(-10);expect(selections.length).toBe(1);
 f.emit('pointerdown',{pointerId:1,clientX:200,clientY:200});f.emit('pointerdown',{pointerId:2,clientX:300,clientY:200});f.emit('pointermove',{pointerId:2,clientX:400,clientY:200});expect(stage.getCamera().zoom).toBe(4);f.emit('pointercancel',{pointerId:1,clientX:200,clientY:200});f.emit('pointercancel',{pointerId:2,clientX:400,clientY:200});
 f.emit('keydown',{key:'ArrowRight'});f.emit('wheel',{deltaY:-100});expect(changes.length).toBeGreaterThan(2);
 stage.dispose();stage.dispose();expect(f.handlers.size).toBe(0);expect(f.removed).toBe(true);expect(f.canvas.width).toBe(0);expect(stage.getStats().objects).toBe(0);expect(stage.focus({collection:'buildings',id:'a'})).toBe(false);
});

test('cancel, lost capture, right click and distant release never select or poison camera',()=>{
 const f=fixture(),selections=[],stage=createCanvasStage(f.container,{onSelect:e=>selections.push(e)});stage.update(projection(),diff);stage.setCamera({x:0,z:0,zoom:2});
 for(const end of ['pointercancel','lostpointercapture']){f.emit('pointerdown',{pointerId:1,clientX:648,clientY:200});f.emit(end,{pointerId:1,clientX:648,clientY:200});f.emit('pointerup',{pointerId:1,clientX:648,clientY:200});}
 f.emit('pointerdown',{pointerId:1,clientX:600,clientY:200});f.emit('pointerup',{pointerId:1,clientX:648,clientY:200});
 f.emit('pointerdown',{pointerId:1,button:2,clientX:648,clientY:200});f.emit('pointerup',{pointerId:1,clientX:648,clientY:200});
 expect(selections).toEqual([]);f.emit('wheel',{deltaY:NaN});expect(stage.getCamera()).toEqual({x:0,z:0,zoom:2});
 f.emit('pointerdown',{pointerId:1,clientX:648,clientY:200});stage.update(projection(),diff);f.emit('pointerup',{pointerId:1,clientX:648,clientY:200});expect(selections).toEqual([]);stage.dispose();
});
test('missing projections and invalid layout dimensions remain finite with bounded keyboard zoom',()=>{
 const f=fixture();f.container.clientWidth=Infinity;f.container.clientHeight=NaN;const stage=createCanvasStage(f.container);stage.update({a:[]},diff);expect(stage.getStats().objects).toBe(0);stage.update(projection(),diff);
 expect(Object.values(stage.getCamera()).every(Number.isFinite)).toBe(true);for(let i=0;i<100;i++)f.emit('keydown',{key:'+'});expect(stage.getCamera().zoom).toBe(32);for(let i=0;i<100;i++)f.emit('keydown',{key:'-'});expect(stage.getCamera().zoom).toBe(.02);
 f.canvas.getBoundingClientRect=()=>({left:0,top:0,width:0,height:0});f.emit('pointerdown',{pointerId:1,clientX:10,clientY:10});f.emit('pointermove',{pointerId:1,clientX:40,clientY:40});expect(Object.values(stage.getCamera()).every(Number.isFinite)).toBe(true);
 expect(canvasViewports(Infinity,-1,'split')[0].width).toBe(320);expect(Object.values(fitCanvasCamera(projection(),NaN,Infinity)).every(Number.isFinite)).toBe(true);stage.dispose();
});
test('context and initial draw exceptions release every owned node and listener',()=>{
 for(const getContext of [()=>null,()=>{throw Error('context denied');},()=>({setTransform(){throw Error('draw denied');}})]){
  const f=fixture();f.canvas.getContext=getContext;expect(()=>createCanvasStage(f.container)).toThrow();expect(f.removed).toBe(true);expect(f.handlers.size).toBe(0);
 }
});
