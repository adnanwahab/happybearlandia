import {test,expect} from 'bun:test';
import {createDistrictArrival} from '../world/district-title.js';
import {deriveLivingContext} from '../world/population/world-view.js';
const context={id:'run',districts:[{id:'west',name:'West',bounds:{minX:-100,maxX:0,minZ:-100,maxZ:100}},{id:'east',name:'East',bounds:{minX:0,maxX:100,minZ:-100,maxZ:100}}]};
test('stable arrival, hysteresis, jitter, outside geometry and re-entry',()=>{
 const state=createDistrictArrival();const at=(x,now)=>state.update({context,point:{x,z:0},now});
 expect(at(-20,0)).toBeNull();expect(at(-20,700)?.id).toBe('west');
 for(let i=0;i<20;i++)expect(at(i%2?1:-1,800+i*800)).toBeNull();
 expect(at(30,20000)).toBeNull();expect(at(-20,20300)).toBeNull();expect(at(30,21000)).toBeNull();expect(at(30,21700)?.id).toBe('east');
 expect(at(300,23000)).toBeNull();expect(at(30,24000)).toBeNull();expect(at(-30,25000)).toBeNull();expect(at(-30,25700)?.id).toBe('west');
});
test('missing and invalid mappings never invent titles',()=>{
 const state=createDistrictArrival();for(const context of [null,{id:'empty',districts:[]},{id:'bad',districts:[{id:'x',name:'x',bounds:{}}]}])for(const now of [0,1000])expect(state.update({context,point:{x:0,z:0},now})).toBeNull();
});
test('uses exact living partition names and bounds without mutating source',()=>{
 const town={seedKey:'fixture',source:'osm',buildings:[{id:1,center:[-50,-50]},{id:2,center:[50,50]}]};const before=JSON.stringify(town),context=deriveLivingContext(town),copy=JSON.stringify(context),state=createDistrictArrival();
 const point={x:context.districts[0].x,z:context.districts[0].z};state.update({context,point,now:0});expect(state.update({context,point,now:700})).toBe(context.districts[0]);expect(JSON.stringify(context)).toBe(copy);expect(JSON.stringify(town)).toBe(before);
});
test('mounted card captures modeled time, expires, clears unsupported frames and disposes',async()=>{
 const {mountDistrictTitle}=await import('../world/district-title.js');
 const doc={createElement(tag){return {tag,hidden:false,children:[],attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},remove(){this.removed=true;}};}};
 const container={ownerDocument:doc,children:[],append(...nodes){this.children.push(...nodes);}};
 let frame={context,minute:360};const title=mountDistrictTitle({container,getFrame:()=>frame,getPoint:()=>({x:-30,z:0})}),root=container.children[1];
 title.update(0);expect(root.hidden).toBe(true);title.update(700);expect(root.hidden).toBe(false);expect(root.children[0].textContent).toBe('West');expect(root.children[1].textContent).toContain('Modeled day 1 · 06:00');expect(root.attributes['aria-live']).toBe('polite');
 frame.minute=999;title.update(800);expect(root.children[1].textContent).toContain('06:00');title.update(5200);expect(root.hidden).toBe(true);
 frame=null;title.update(5300);expect(root.children).toEqual([]);title.destroy();expect(root.removed).toBe(true);expect(container.children[0].removed).toBe(true);
});
