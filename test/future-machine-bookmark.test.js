import {test,expect} from 'bun:test';
import {createStage} from '../world/future-machine/scene/index.js';

// DOM/Canvas adapter: exercises the real paired stage, without a browser or GPU.
function fixture(contextAvailable=true){
  const nodes=[];
  const doc={defaultView:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})},createElement(tag){
    const handlers=new Map();
    const node={tag,ownerDocument:doc,dataset:{},style:{},clientWidth:800,clientHeight:400,
      children:[],setAttribute(){},append(...items){this.children.push(...items);},insertBefore(item,before){const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,item);},before(){},
      replaceChildren(...items){this.children=items;},remove(){},addEventListener(n,f){handlers.set(n,f);},removeEventListener(n){handlers.delete(n);},
      getContext(){return contextAvailable?new Proxy({},{get:()=>()=>{},set:()=>true}):null;},
      emit(n,event){handlers.get(n)?.({preventDefault(){},...event});}};
    nodes.push(node);return node;
  }};
  return {container:doc.createElement('div'),nodes};
}
const frame=month=>({month,baseline:{month,state:{month,buildings:[{id:'a',floors:2},{id:'b',floors:3}],projects:[]}},plan:{month,state:{month,buildings:[{id:'a',floors:2},{id:'b',floors:3}],projects:[]}}});

test('paired stage saves a detached pose, restores after navigation, replaces and disposes bookmarks',async()=>{
  const original=globalThis.location;globalThis.location={search:'?renderer=canvas2d'};
  const f=fixture();let interactions=0;
  const stage=createStage(f.container,{onCameraInteraction:()=>interactions++});
  try{
    expect(stage.getStats().backend).toBe('pending');
    expect(stage.saveCameraBookmark()).toBe(false);expect(stage.restoreCameraBookmark()).toBe(false);
    stage.update(frame(0),{entities:[]});expect(await stage.whenReady()).toEqual({backend:'canvas2d'});
    const canvas=f.nodes.find(n=>n.tag==='canvas');
    canvas.emit('keydown',{key:'ArrowRight'});canvas.emit('wheel',{deltaY:-100});
    const saved=stage.getCamera();expect(stage.setCamera(saved)).toBe(true);expect(stage.setCamera({position:[1,2,3],target:[0,0,0]})).toBe(false);expect(stage.setCamera({x:NaN,z:0,zoom:1})).toBe(false);expect(stage.getCamera()).toEqual(saved);expect(stage.saveCameraBookmark()).toBe(true);
    saved.x+=999; // consumer snapshots must not mutate the saved bookmark
    expect(stage.focus({collection:'buildings',id:'b'})).toBe(true);
    stage.update(frame(120),{entities:[]});stage.setMode('plan');
    expect(stage.restoreCameraBookmark()).toBe(true);expect(stage.getCamera()).toEqual({...saved,x:saved.x-999});
    stage.setMode('split');expect(stage.restoreCameraBookmark()).toBe(true);
    expect(stage.getCamera()).toEqual({...saved,x:saved.x-999});
    stage.focus({collection:'buildings',id:'a'});const replacement=stage.getCamera();stage.saveCameraBookmark();
    stage.resetCamera();stage.restoreCameraBookmark();expect(stage.getCamera()).toEqual(replacement);
    stage.update(null,null);expect(stage.restoreCameraBookmark()).toBe(false);expect(stage.saveCameraBookmark()).toBe(false);
    stage.update(frame(0),{entities:[]});expect(stage.restoreCameraBookmark()).toBe(true);
    expect(interactions).toBe(8); // two gestures plus six explicit bookmark actions
    stage.dispose();expect(stage.restoreCameraBookmark()).toBe(false);expect(stage.saveCameraBookmark()).toBe(false);
    const fresh=createStage(f.container);fresh.update(frame(0),{entities:[]});await fresh.whenReady();expect(fresh.restoreCameraBookmark()).toBe(false);fresh.dispose();
  }finally{stage.dispose();globalThis.location=original;}
});

test('inventory-only fallback cannot save or restore a camera',async()=>{
  const original=globalThis.location;globalThis.location={search:'?renderer=canvas2d'};
  const stage=createStage(fixture(false).container);
  try{stage.update(frame(0),{entities:[]});expect(await stage.whenReady()).toEqual({backend:'inventory-fallback'});expect(stage.saveCameraBookmark()).toBe(false);expect(stage.restoreCameraBookmark()).toBe(false);}
  finally{stage.dispose();globalThis.location=original;}
});

test('curtain component coalesces pointer and range input, preserves camera and disables missing/mismatched frames',async()=>{
 const original={location:globalThis.location,raf:globalThis.requestAnimationFrame,caf:globalThis.cancelAnimationFrame};
 globalThis.location={search:'?renderer=canvas2d'};let queued=null,requests=0;
 globalThis.requestAnimationFrame=fn=>{queued=fn;requests++;return requests;};globalThis.cancelAnimationFrame=()=>{queued=null;};
 const f=fixture(),stage=createStage(f.container);
 try{
  const toggle=f.nodes.find(n=>n.textContent==='Aligned curtain'),slider=f.nodes.find(n=>n.tag==='input'),seam=f.nodes.find(n=>n.style.cssText?.includes('cursor:ew-resize'));
  stage.update(frame(0),{entities:[]});await stage.whenReady();expect(toggle.disabled).toBe(false);
  toggle.onclick();expect(stage.getStats().curtain).toBe(true);expect(slider.hidden).toBe(false);
  const pose=stage.getCamera();slider.value='25';slider.oninput();slider.value='75';slider.oninput();expect(requests).toBe(1);queued();queued=null;
  expect(stage.getStats().curtainPosition).toBe(.75);expect(stage.getCamera()).toEqual(pose);
  const views=f.nodes.find(n=>n.children.includes(seam));views.getBoundingClientRect=()=>({left:0,width:800});
  seam.onpointerdown({pointerId:7,pointerType:'touch',preventDefault(){},stopPropagation(){}});
  seam.onpointermove({pointerId:7,clientX:160});queued();queued=null;seam.onpointercancel();
  expect(stage.getStats().curtainPosition).toBe(.2);expect(stage.getCamera()).toEqual(pose);
  stage.setMode('plan');expect(toggle.disabled).toBe(true);expect(stage.getStats().curtain).toBe(false);expect(slider.hidden).toBe(true);
  stage.setMode('split');toggle.onclick();stage.update(null,null);expect(toggle.disabled).toBe(true);expect(slider.hidden).toBe(true);
  const unsupported=frame(0);unsupported.plan.state.buildings[0].geometry={type:'MultiPolygon',coordinates:[]};
  stage.update(unsupported,{entities:[]});expect(toggle.disabled).toBe(true);
  stage.update(frame(0),{entities:[]});toggle.onclick();slider.oninput();stage.dispose();expect(queued).toBeNull();expect(slider.oninput).toBeNull();
 }finally{stage.dispose();globalThis.location=original.location;globalThis.requestAnimationFrame=original.raf;globalThis.cancelAnimationFrame=original.caf;}
});
