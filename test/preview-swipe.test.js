import {test, expect} from 'bun:test';
import {swipeStep, mountPreviewSwipe} from '../tools/preview-swipe.js';
test('bounded intentional horizontal threshold', () => {
  expect(swipeStep(-1000, 0, 320)).toBe(1);
  expect(swipeStep(80, 0, 320)).toBe(-1);
  for (const [x,y] of [[30,0],[80,90],[0,100],[64,60]]) expect(swipeStep(x,y,320)).toBe(0);
  expect(swipeStep(-64,0,320)).toBe(1);
});
function fixture({interactive=false, control=false, reduced=false}={}) {
  const listeners={},classes=new Set(),styles=new Map(),moves=[];
  let captured=false;
  const card={offsetWidth:320,classList:{contains:()=>interactive},style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)}};
  const rail={addEventListener:(type,fn)=>listeners[type]=fn,classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},setPointerCapture:()=>captured=true,hasPointerCapture:()=>captured,releasePointerCapture:()=>captured=false};
  const cancel=mountPreviewSwipe(rail,{getIndex:()=>2,go:index=>moves.push(index),reduced:()=>reduced});
  const event=(x,y=0,id=1)=>({clientX:x,clientY:y,pointerId:id,isPrimary:true,button:0,target:{closest:selector=>selector==='.gallery-card'?card:control?{}:null}});
  return {listeners,event,moves,styles,cancel};
}
test('one sibling, pointer isolation, click suppression and cleanup',()=>{
  const f=fixture();f.listeners.pointerdown(f.event(200));f.listeners.pointermove(f.event(-800,0,2));expect(f.styles.size).toBe(0);
  f.listeners.pointermove(f.event(-800));expect(f.styles.get('--drag-x')).toBe('-100px');
  f.listeners.pointerup(f.event(-800));expect(f.moves).toEqual([3]);expect(f.styles.size).toBe(0);
  let blocked=false;f.listeners.click({detail:1,preventDefault(){blocked=true;},stopImmediatePropagation(){}});expect(blocked).toBe(true);
});
test('vertical, controls, interactive previews and taps do not navigate',()=>{
  for(const options of [{},{control:true},{interactive:true}]){
    const f=fixture(options);f.listeners.pointerdown(f.event(200));f.listeners.pointermove(f.event(198,100));f.listeners.pointerup(f.event(198,100));expect(f.moves).toEqual([]);
  }
});
test('cancellation and multitouch snap back; reduced motion has no drag transform',()=>{
  for(const kind of ['pointercancel','lostpointercapture','cancel','multitouch']){
    const f=fixture({reduced:true});f.listeners.pointerdown(f.event(200));f.listeners.pointermove(f.event(0));expect(f.styles.size).toBe(0);
    if(kind==='cancel')f.cancel();else if(kind==='multitouch')f.listeners.pointerdown(f.event(0,0,2));else f.listeners[kind](f.event(0));
    expect(f.moves).toEqual([2]);
  }
});

test('horizontal gestures on interactive cards and controls remain owner gestures',()=>{
  for(const options of [{control:true},{interactive:true}]) {
    const f=fixture(options);f.listeners.pointerdown(f.event(200));f.listeners.pointermove(f.event(0));f.listeners.pointerup(f.event(0));expect(f.moves).toEqual([]);expect(f.styles.size).toBe(0);
  }
});
