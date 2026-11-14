import {test,expect} from 'bun:test';
import {rankScreenTargets} from '../world/render/magnetic-picking.js';
const rect={left:0,top:0,right:390,bottom:844};
test('nearest visible hit wins independently of ID, with explicit near ties',()=>{
 const input={x:100,y:100,rect,hitAt:(x,y)=>Math.abs(y-100)<1?(Math.abs(x-108)<1?{key:'z',label:'Near'}:Math.abs(x-116)<1?{key:'a',label:'Far'}:null):null};
 const before=JSON.stringify(input.rect);const result=rankScreenTargets(input);
 expect(result.ranked.map(x=>x.key)).toEqual(['z','a']);expect(result.choices).toHaveLength(1);expect(JSON.stringify(rect)).toBe(before);
 const ties=rankScreenTargets({...input,hitAt:(x,y)=>Math.abs(y-100)<1&&Math.abs(Math.abs(x-100)-8)<1?{key:x<100?'left':'right'}:null});expect(ties.choices).toHaveLength(2);
});
test('hidden targets, off-canvas rays and outside-radius entities cannot steal a pick',()=>{
 let calls=0;const result=rankScreenTargets({x:0,y:0,rect,hitAt:(x,y)=>{calls++;expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);return{key:'hidden',visible:false};}});expect(result.ranked).toEqual([]);expect(calls).toBeLessThanOrEqual(49);
});
test('exact visible geometry takes priority over expanded targets',()=>{
 const result=rankScreenTargets({x:100,y:100,rect,hitAt:(x,y)=>({key:x===100&&y===100?'exact':'near'})});expect(result.choices.map(h=>h.key)).toEqual(['exact']);
});

test('ray hits from hidden ancestry and invisible materials are excluded',async()=>{
 const {isRenderedHit}=await import('../world/render/magnetic-picking.js');
 expect(isRenderedHit({object:{visible:true,parent:{visible:false}}})).toBe(false);
 expect(isRenderedHit({object:{material:{visible:false}}})).toBe(false);
 expect(isRenderedHit({object:{material:{transparent:true,opacity:0}}})).toBe(false);
 expect(isRenderedHit({object:{visible:true,material:{visible:true,opacity:1}}})).toBe(true);
});
