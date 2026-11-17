import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {mountNeighborhoodWhatIf} from '../world/what-if/panel.js';

// Minimal DOM records actual panel listeners; it does not emulate browser layout.
function fixture(){
 const nodes=new Map();
 const make=()=>({children:[],dataset:{},style:{},handlers:{},attributes:{},value:'',hidden:false,disabled:false,textContent:'',
  append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn);},removeEventListener(k,fn){this.handlers[k]=this.handlers[k]?.filter(f=>f!==fn);},
  focus(){},remove(){},querySelector(key){if(!nodes.has(key))nodes.set(key,make());return nodes.get(key);},querySelectorAll(){return [];},
  emit(type,event={}){for(const fn of this.handlers[type]||[])fn({preventDefault(){},...event});}});
 const doc=make();doc.createElement=()=>{const e=make();e.ownerDocument=doc;return e;};doc.getElementById=()=>null;
 const container=doc.createElement('main'),canvas=make(),scene=new THREE.Scene(),controls={target:new THREE.Vector3(0,0,0),update(){}};
 const context={bounds:{minX:-100,maxX:100,minZ:-80,maxZ:80}};
 const panel=mountNeighborhoodWhatIf({container,scene,camera:new THREE.PerspectiveCamera(),controls,renderer:{domElement:canvas},THREE,getContext:()=>context});
 const $=key=>nodes.get(key);$('[data-kind]').value='park';
 container.children[0].emit('click');
 return {$,doc,canvas,scene,context,panel};
}
test('actual panel form fallback accepts boundary, rejects stale proposal, switches supported picker and clears',()=>{
 const {$,doc,scene,panel}=fixture();
 expect($('[data-constraints]').textContent).toContain('E -100 to 100');
 $('[data-pin-x]').value='100';$('[data-pin-z]').value='80';$('[data-pin-form]').emit('submit');
 expect($('[data-run]').disabled).toBe(false);expect($('[data-location]').textContent).toContain('Proposed park');
 $('[data-kind]').value='housing';$('[data-kind]').emit('change');expect($('[data-assumption]').textContent).toContain('5%');
 $('[data-pin-x]').value='100.01';$('[data-pin-x]').emit('input');expect($('[data-run]').disabled).toBe(true);
 $('[data-pin-form]').emit('submit');expect($('[data-status]').textContent).toContain('inside');
 expect(scene.children[0].children[1].children).toHaveLength(0);expect($('[data-run]').disabled).toBe(true);
 $('[data-center]').emit('click');expect($('[data-run]').disabled).toBe(false);
 $('[data-clear]').emit('click');expect($('[data-run]').disabled).toBe(true);
 $('[data-place]').emit('click');doc.emit('keydown',{key:'Escape'});expect($('[data-place]').attributes['aria-pressed']).toBe('false');
 panel.destroy();expect(scene.children).toHaveLength(0);
});
test('actual panel rejects missing geometry and empty coordinates without a worker',()=>{
 const {$,context,panel}=fixture();
 $('[data-pin-form]').emit('submit');expect($('[data-status]').textContent).toContain('location');expect($('[data-run]').disabled).toBe(true);
 $('[data-center]').emit('click');expect($('[data-run]').disabled).toBe(false);
 context.bounds.minX=100;
 $('[data-run]').emit('click');expect($('[data-status]').textContent).toContain('geometry');expect($('[data-run]').disabled).toBe(true);
 panel.destroy();
});
