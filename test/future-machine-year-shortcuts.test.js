import {test,expect} from 'bun:test';
import {bindYearShortcuts} from '../world/future-machine/ui/year-shortcuts.js';
function fixture(){
 const host=new EventTarget(),doc={},canvas={tagName:'CANVAS',ownerDocument:doc};doc.activeElement=canvas;
 let state={status:'ready',month:0},diffs=[],missing=0;
 const dispose=bindYearShortcuts(host,{getState:()=>state,getDiffs:()=>diffs,onMonth:month=>state.month=month,onMissing:()=>missing++});
 function press(key,props={}){const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'target',{value:canvas});Object.assign(event,{key,...props});host.dispatchEvent(event);return event.defaultPrevented;}
 return {state,doc,canvas,press,dispose,setDiffs:value=>diffs=value,get missing(){return missing;}};
}
test('year steps clamp to the recorded horizon; earliest available divergence includes month zero',()=>{
 const f=fixture();expect(f.press('PageUp')).toBe(true);expect(f.state.month).toBe(12);
 f.state.month=115;f.press('PageUp');expect(f.state.month).toBe(120);
 f.state.month=5;f.press('PageDown');expect(f.state.month).toBe(0);
 f.setDiffs([{month:0,available:false,changedCount:4},{month:1,changedCount:1},{month:16,changedCount:9}]);f.press('d');expect(f.state.month).toBe(1);
 f.setDiffs([{month:0,changedCount:1}]);f.press('d');expect(f.state.month).toBe(0);
 f.setDiffs([]);f.press('d');expect(f.missing).toBe(1);expect(f.state.month).toBe(0);
});
test('focus, editing, modifiers, composition, camera keys, loading and disposal are respected',()=>{
 const f=fixture();
 for(const property of ['altKey','ctrlKey','metaKey','shiftKey','isComposing'])expect(f.press('PageUp',{[property]:true})).toBe(false);
 expect(f.press('ArrowRight')).toBe(false);
 f.canvas.tagName='INPUT';expect(f.press('PageUp')).toBe(false);f.canvas.tagName='CANVAS';
 f.doc.activeElement={};expect(f.press('PageUp')).toBe(false);f.doc.activeElement=f.canvas;
 f.state.status='loading';expect(f.press('PageUp')).toBe(false);f.state.status='ready';
 expect(f.state.month).toBe(0);f.dispose();expect(f.press('PageUp')).toBe(false);
});


test('failed initial preview cannot seek future months while retained completed history remains navigable',()=>{
 const f=fixture();f.state.status='error';f.state.frame={month:0};f.state.preview=true;
 expect(f.press('PageUp')).toBe(false);expect(f.state.month).toBe(0);
 f.state.preview=false;expect(f.press('PageUp')).toBe(true);expect(f.state.month).toBe(12);f.dispose();
});
