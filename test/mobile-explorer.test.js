import {test,expect} from 'bun:test';
import {joystickVector} from '../world/mobile-explorer.js';
test('joystick deadzone, finite input and diagonal speed are bounded',()=>{
 expect(joystickVector(3,2)).toEqual({x:0,y:0});
 expect(joystickVector(NaN,1)).toEqual({x:0,y:0});
 expect(joystickVector(20,0)).toEqual({x:20/38,y:0});
 const diagonal=joystickVector(200,-200);expect(Math.hypot(diagonal.x,diagonal.y)).toBeCloseTo(1);expect(diagonal.y).toBeLessThan(0);
});

import {mountMobileExplorer} from '../world/mobile-explorer.js';
import {createUIDocument} from './helpers/ui-dom.js';
// Extend the repository's small DOM with template parsing and pointer surfaces.
function setup(){
 const doc=createUIDocument(),proto=Object.getPrototypeOf(doc.body);
 Object.defineProperty(proto,'innerHTML',{configurable:true,set(html){
  this.replaceChildren();const stack=[this];
  for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('</')){stack.pop();continue;}
   if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const node=doc.createElement(tag);
    for(const match of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(match.index===1)continue;node.setAttribute(match[1],match[2]??'');if(match[1]==='value')node.value=match[2];}
    stack.at(-1).append(node);if(!['input','link'].includes(tag))stack.push(node);
   }else stack.at(-1)._text+=token;
  }
 }});
 Object.defineProperty(proto,'firstElementChild',{configurable:true,get(){return this.children[0];}});
 proto.getBoundingClientRect=()=>({left:8,top:400,width:244,height:170});proto.setPointerCapture=()=>{};
 proto.removeEventListener=function(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(v=>v!==fn);};
 function target(){const listeners={};return{listeners,addEventListener(type,fn){(listeners[type]??=[]).push(fn);},removeEventListener(type,fn){listeners[type]=(listeners[type]||[]).filter(v=>v!==fn);},fire(type,event={}){for(const fn of listeners[type]||[])fn(event);}};}
 const win=Object.assign(target(),{innerWidth:320,innerHeight:640,matchMedia:()=>({matches:true})});doc.defaultView=win;Object.assign(doc,target(),{hasFocus:()=>true,visibilityState:'visible'});
 const moves=[];let permitted=true,blocked=false,hits=false;
 const api=mountMobileExplorer({container:doc.body,onMove:value=>moves.push(value),onInspect:()=>hits,available:()=>permitted,blocked:()=>blocked});
 return {doc,win,api,moves,setPermitted:v=>permitted=v,setBlocked:v=>blocked=v,setHits:v=>hits=v,root:doc.getElementById('mobile-explorer')};
}
test('mounted input shares actions, caps time, resets on cancellation/blur/freeze and cleans up',async()=>{
 const s=setup(),stick=s.root.querySelector('[data-stick]');
 const start=()=>stick.dispatch('pointerdown',{pointerId:1,button:0,clientX:100,clientY:100,preventDefault(){}});
 const move=()=>stick.dispatch('pointermove',{pointerId:1,clientX:138,clientY:100,preventDefault(){}});
 await start();await move();s.api.update(0);s.api.update(5000);expect(s.moves).toHaveLength(1);expect(s.moves[0]).toMatchObject({x:1,y:0,dt:.05});
 await stick.dispatch('pointercancel',{pointerId:1});s.api.update(5050);expect(s.moves).toHaveLength(1);
 await start();await move();s.win.fire('blur');s.api.update(5100);expect(s.moves).toHaveLength(1);
 await start();await move();s.api.update(5200,{enabled:false});s.api.update(5250);expect(s.moves).toHaveLength(1);
 await stick.dispatch('keydown',{key:'ArrowLeft',preventDefault(){}});expect(s.moves.at(-1).x).toBe(-1);
 await s.root.querySelector('[data-zoom="1"]').click();expect(s.moves.at(-1).zoom).toBe(1);
 await s.root.querySelector('[data-inspect]').click();expect(s.root.querySelector('output').textContent).toContain('No inspectable');
 s.setHits(true);await s.root.querySelector('[data-inspect]').click();expect(s.root.querySelector('output').textContent).toContain('Inspecting');
 s.setPermitted(false);s.api.update(5300);expect(s.root.querySelector('button').disabled).toBe(true);const count=s.moves.length;await s.root.querySelector('[data-zoom="1"]').click();expect(s.moves).toHaveLength(count);
 s.setBlocked(true);s.api.update(5350);expect(s.root.hidden).toBe(true);
 s.api.destroy();expect(s.doc.getElementById('mobile-explorer')).toBe(null);expect(Object.values(s.win.listeners).flat()).toHaveLength(0);
});
test('hand, sensitivity, drag bounds, focus and hidden-page cancellation',async()=>{
 const s=setup(),settings=s.doc.getElementById('mobile-explorer-settings'),hand=settings.querySelector('select'),sensitivity=settings.querySelector('input[type="range"]'),stick=s.root.querySelector('[data-stick]');
 hand.value='left';await hand.dispatch('change');expect(s.root.style.left).toContain('safe-area-inset-left');expect(s.root.style.right).toBe('auto');
 sensitivity.value='2';await sensitivity.dispatch('input');await stick.dispatch('keydown',{key:'ArrowUp',preventDefault(){}});expect(s.moves.at(-1)).toMatchObject({y:-1,dt:.16});
 const handle=s.root.querySelector('[data-drag]');await handle.dispatch('pointerdown',{pointerId:2,button:0,clientX:10,clientY:410,preventDefault(){}});await handle.dispatch('pointermove',{pointerId:2,clientX:999,clientY:-999,preventDefault(){}});expect(s.root.style.left).toBe('68px');expect(s.root.style.top).toBe('8px');
 s.win.innerWidth=260;s.win.fire('resize');expect(s.root.style.left).toBe('8px');
 const count=s.moves.length;await stick.dispatch('pointerdown',{pointerId:3,button:0,clientX:0,clientY:0,preventDefault(){}});await stick.dispatch('pointermove',{pointerId:3,clientX:38,clientY:0,preventDefault(){}});
 s.doc.visibilityState='hidden';s.doc.fire('visibilitychange');s.api.update(0);s.doc.visibilityState='visible';s.api.update(50);expect(s.moves).toHaveLength(count);
 s.doc.hasFocus=()=>false;await stick.dispatch('keydown',{key:'ArrowUp',preventDefault(){}});expect(s.moves).toHaveLength(count);
 s.api.destroy();
});
