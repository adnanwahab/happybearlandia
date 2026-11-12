import {test,expect} from 'bun:test';
import {createStage} from '../world/future-machine/scene/index.js';

// DOM/Canvas adapter: exercises the real paired stage, without a browser or GPU.
function fixture(contextAvailable=true){
  const nodes=[];
  const doc={createElement(tag){
    const handlers=new Map();
    const node={tag,ownerDocument:doc,dataset:{},style:{},clientWidth:800,clientHeight:400,
      children:[],setAttribute(){},append(...items){this.children.push(...items);},before(){},
      replaceChildren(...items){this.children=items;},remove(){},addEventListener(n,f){handlers.set(n,f);},removeEventListener(n){handlers.delete(n);},
      getContext(){return contextAvailable?new Proxy({},{get:()=>()=>{},set:()=>true}):null;},
      emit(n,event){handlers.get(n)?.({preventDefault(){},...event});}};
    nodes.push(node);return node;
  }};
  return {container:doc.createElement('div'),nodes};
}
const frame=month=>({month,baseline:{state:{month,buildings:[{id:'a',floors:2},{id:'b',floors:3}],projects:[]}},plan:{state:{month,buildings:[{id:'a',floors:2},{id:'b',floors:3}],projects:[]}}});

test('paired stage saves a detached pose, restores after navigation, replaces and disposes bookmarks',async()=>{
  const original=globalThis.location;globalThis.location={search:'?renderer=canvas2d'};
  const f=fixture();let interactions=0;
  const stage=createStage(f.container,{onCameraInteraction:()=>interactions++});
  try{
    expect(stage.saveCameraBookmark()).toBe(false);expect(stage.restoreCameraBookmark()).toBe(false);
    stage.update(frame(0),{entities:[]});expect(await stage.whenReady()).toEqual({backend:'canvas2d'});
    const canvas=f.nodes.find(n=>n.tag==='canvas');
    canvas.emit('keydown',{key:'ArrowRight'});canvas.emit('wheel',{deltaY:-100});
    const saved=stage.getCamera();expect(stage.saveCameraBookmark()).toBe(true);
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
    expect(interactions).toBe(6);
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
