import {test,expect} from 'bun:test';
import {sceneReceipt} from '../world/render/photo-mode.js';
test('receipt does not manufacture run facts or disclose URL metadata',()=>{
 const receipt=sceneReceipt('webgl',false);
 expect(receipt).toContain('run ID / seed / modeled date / source unavailable');
 expect(receipt).not.toContain('cosmetic');
 expect(receipt).not.toContain('http');
 expect(sceneReceipt('canvas2d',true)).toContain('low-fidelity projected bounds');
 expect(sceneReceipt('canvas2d',true)).toContain('golden-hour cosmetic filter');
});

import * as THREE from 'three';
import {mountPhotoMode} from '../world/render/photo-mode.js';

// Minimal DOM harness exercises lifecycle and capture scheduling without a server.
function harness(){
 const previous=new Map(),listeners=new Map(),outputs=[],downloads=[];
 function replace(key,value){previous.set(key,globalThis[key]);globalThis[key]=value;}
 let doc;
 class Element {
  constructor(tag){this.tag=tag;this.dataset={};this.style={};this.children=[];this.checked=false;this.disabled=false;this.isConnected=true;}
  set innerHTML(html){this.children=[];for(const match of html.matchAll(/<(input|button|p)\b([^>]*)>/g)){const el=new Element(match[1]);for(const attr of match[2].matchAll(/data-([a-z-]+)(?:="([^"]*)")?/g))el.dataset[attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attr[2]||'';if(match[2].includes('role="status"'))el.role='status';this.children.push(el);}}
  setAttribute(){}
  querySelector(selector){return this.querySelectorAll(selector)[0];}
  querySelectorAll(selector){return this.children.filter(el=>selector==='button,input'?['button','input'].includes(el.tag):selector==='[role=status]'?el.role==='status':Object.keys(el.dataset).some(key=>'[data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']'===selector));}
  append(...children){this.children.push(...children);}
  remove(){this.isConnected=false;}
  focus(){doc.activeElement=this;}
  click(){if(this.tag==='a')downloads.push(this.download);else this.onclick?.();}
 }
 const classes=new Set(),body=new Element('body');body.classList={add:x=>classes.add(x),remove:x=>classes.delete(x)};
 doc={body,activeElement:new Element('button'),createElement(tag){const el=new Element(tag);if(tag==='canvas'){const ctx={filter:'',drawImage(){},fillRect(){},fillText(){},measureText:t=>({width:t.length*6})};el.getContext=()=>ctx;el.toBlob=callback=>{el.callback=callback;};outputs.push(el);}return el;}};
 replace('document',doc);replace('addEventListener',(type,fn)=>listeners.set(type,fn));replace('removeEventListener',(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);});
 const canvas={addEventListener(){},removeEventListener(){},style:{filter:'contrast(1.1)'},width:4000,height:2000},camera=new THREE.PerspectiveCamera();camera.position.set(50,60,70);const controls={target:new THREE.Vector3(1,2,3),enableDamping:true,update(){}};
 const api=mountPhotoMode({canvas,camera,controls,mode:'canvas2d'}),panel=body.children.at(-1),field=selector=>panel.querySelector(selector);
 return {api,panel,field,canvas,camera,controls,doc,outputs,downloads,listeners,classes,cleanup(){api.destroy();for(const [key,value]of previous)globalThis[key]=value;}};
}
test('repeated entry/exit restores camera, filter, damping, focus and optional label defaults',()=>{
 const h=harness();try{const start=h.camera.position.clone(),target=h.controls.target.clone(),focus=h.doc.activeElement;
 for(let i=0;i<12;i++){h.api.enter();h.api.enter();expect(h.api.active).toBe(true);expect(h.controls.enableDamping).toBe(false);h.field('[data-pan]').click();h.field('[data-zoom]').click();h.field('[data-golden]').checked=true;h.field('[data-golden]').onchange();h.field('[data-receipt]').checked=true;h.api.exit();expect(h.camera.position.equals(start)).toBe(true);expect(h.controls.target.equals(target)).toBe(true);expect(h.canvas.style.filter).toBe('contrast(1.1)');expect(h.doc.activeElement).toBe(focus);expect(h.classes.size).toBe(0);h.api.enter();expect(h.field('[data-receipt]').checked).toBe(false);h.api.exit();}
 expect(h.controls.enableDamping).toBe(true);
 }finally{h.cleanup();}
});
test('capture failures and empty scene recover; next-frame export is bounded and late callback is cancelled',()=>{
 const h=harness();try{
 h.api.enter();h.canvas.width=0;h.field('[data-save]').click();h.api.afterFrame();expect(h.field('[role=status]').textContent).toContain('Scene is empty');expect(h.field('[data-save]').disabled).toBe(false);
 h.canvas.width=4000;h.field('[data-save]').click();h.api.afterFrame();expect(h.outputs.at(-1).width).toBe(2048);expect(h.outputs.at(-1).height).toBe(1024);h.outputs.at(-1).callback(null);expect(h.field('[role=status]').textContent).toContain('unavailable');expect(h.field('[data-save]').disabled).toBe(false);
 h.field('[data-save]').click();h.api.afterFrame();const late=h.outputs.at(-1).callback;h.api.exit();h.api.enter();late(new Blob(['late']));expect(h.downloads).toEqual([]);expect(h.field('[data-save]').disabled).toBe(false);
 h.field('[data-save]').click();h.api.afterFrame();h.outputs.at(-1).callback(new Blob(['png']));expect(h.downloads).toEqual(['world-postcard.png']);
 h.field('[data-save]').click();h.api.destroy();h.api.afterFrame();expect(h.listeners.size).toBe(0);expect(h.classes.size).toBe(0);expect(h.panel.isConnected).toBe(false);h.api.destroy();
 }finally{h.cleanup();}
});
test('Escape exits and Tab wraps within photo controls',()=>{
 const h=harness();try{h.api.enter();const inputs=h.panel.querySelectorAll('button,input'),key=h.listeners.get('keydown');let prevented=false;h.doc.activeElement=inputs.at(-1);key({key:'Tab',preventDefault(){prevented=true;}});expect(prevented).toBe(true);expect(h.doc.activeElement).toBe(inputs[0]);key({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});expect(h.api.active).toBe(false);
 }finally{h.cleanup();}
});
