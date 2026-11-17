import {test,expect} from 'bun:test';
import {mountGroundWish} from '../world/buildings/ground-wish.js';
class Target extends EventTarget {
  style={};hidden=false;value='';removed=false;
  focus(){this.focused=true} remove(){this.removed=true}
  querySelector(selector){return selector==='textarea'?this.text:this.cancel}
}
function setup(resolveGround=()=>({x:12,z:34})){
  const win=new Target();win.innerWidth=800;win.innerHeight=600;
  const form=new Target();form.text=new Target();form.cancel=new Target();
  const doc={defaultView:win,createElement:()=>form},container={ownerDocument:doc,append(){}};
  const canvas=new Target(),wishes=[];
  const api=mountGroundWish({canvas,container,resolveGround,onWish:wish=>wishes.push(wish)});
  return {canvas,win,form,wishes,api};
}
function fire(target,type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:100,clientY:100,...props});target.dispatchEvent(e);return e}
test('right click captures chosen ground, requires review, Escape and destruction never submit',()=>{
  const {canvas,form,win,wishes,api}=setup();
  expect(fire(canvas,'contextmenu').defaultPrevented).toBe(true);expect(form.hidden).toBe(false);expect(wishes).toEqual([]);
  form.text.value='Build 310 homes';fire(form,'submit');expect(wishes).toEqual([{prompt:'Build 310 homes',location:{x:12,z:34}}]);expect(form.hidden).toBe(true);
  fire(canvas,'contextmenu');fire(win,'keydown',{key:'Escape'});expect(form.hidden).toBe(true);expect(wishes).toHaveLength(1);
  api.destroy();expect(form.removed).toBe(true);fire(canvas,'contextmenu');expect(form.hidden).toBe(true);
});
test('occupied ground leaves context gesture alone and cannot submit',()=>{const {canvas,form,wishes,api}=setup(()=>null);expect(fire(canvas,'contextmenu').defaultPrevented).toBe(false);form.text.value='Build homes';fire(form,'submit');expect(wishes).toEqual([]);api.destroy()});
test('long press opens draft, movement and pointer cancellation cancel the timer',async()=>{
 const {canvas,form,wishes,api}=setup();
 fire(canvas,'pointerdown',{pointerType:'touch',pointerId:1});fire(canvas,'pointermove',{pointerId:1,clientX:120});await Bun.sleep(620);expect(form.hidden).toBe(true);
 fire(canvas,'pointerdown',{pointerType:'touch',pointerId:1});fire(canvas,'pointercancel');await Bun.sleep(620);expect(form.hidden).toBe(true);
 fire(canvas,'pointerdown',{pointerType:'touch',pointerId:1});await Bun.sleep(620);expect(form.hidden).toBe(false);expect(fire(canvas,'pointerup').defaultPrevented).toBe(true);expect(wishes).toEqual([]);api.destroy();
});
