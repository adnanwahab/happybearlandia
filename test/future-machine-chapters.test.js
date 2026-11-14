import {test,expect} from 'bun:test';
import {buildChapters} from '../world/future-machine/ui/chapters.js';
const event=(id,type,month)=>({id,eventType:type,simulationTime:month,dependencies:['parent'],payload:{projectId:'p1'}});
test('chapters are deterministic, immutable, arm scoped and confined to exact event times',()=>{
 const history={baseline:[{month:16,events:[event('same','PROJECT_COMPLETE',16)]},{month:0,events:[]}],plan:[{month:16,events:[event('same','PROJECT_COMPLETE',16),event('x','OTHER',16)]}]};
 const before=JSON.stringify(history),result=buildChapters(history);
 expect(result.chapters.map(x=>x.month)).toEqual([16,16]);expect(result.chapters[0].evidence.map(x=>x.future)).toEqual(['a','b']);expect(result.chapters[0].evidence[0].dependencies).toEqual(['parent']);
 expect(buildChapters({...history,baseline:[...history.baseline].reverse(),plan:[{month:16,events:[...history.plan[0].events].reverse()}]})).toEqual(result);expect(JSON.stringify(history)).toBe(before);
});
test('empty, unavailable, invalid identities and mismatched clocks',()=>{
 expect(buildChapters(null).status).toBe('unavailable');expect(buildChapters({baseline:[],plan:[]}).status).toBe('empty');
 expect(buildChapters({baseline:[{month:0,events:[event('x','PROJECT_COMPLETE',16)]}],plan:[]}).chapters).toEqual([]);
 expect(()=>buildChapters({baseline:[{month:0},{month:0}],plan:[]})).toThrow();
 expect(()=>buildChapters({baseline:[{month:0,events:[event('x','OTHER',0),event('x','OTHER',0)]}],plan:[]})).toThrow();
});
test('bounded editorial ranking retains later completion above routine events',()=>{
 const result=buildChapters({baseline:Array.from({length:40},(_,month)=>({month,events:[event(String(month),month===39?'PROJECT_COMPLETE':'OTHER',month)]})),plan:[]});
 expect(result.chapters.length).toBe(24);expect(result.chapters.at(-1).month).toBe(39);
});
test('component activation, keyboard navigation, empty state and listener disposal',async()=>{
 const {createChapters}=await import('../world/future-machine/ui/chapters.js');
 class Element{
  constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.style={};this.listeners={};}
  setAttribute(){} append(...nodes){this.children.push(...nodes);} remove(){this.removed=true;}
  addEventListener(key,fn){this.listeners[key]=fn;} removeEventListener(key){delete this.listeners[key];}
  querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
  focus(){this.ownerDocument.activeElement=this;}
 }
 const doc={createElement(tag){return new Element(tag,this);}},container=new Element('div',doc),jumps=[];
 const view=createChapters(container,{history:{baseline:[{month:16,events:[event('x','PROJECT_COMPLETE',16),event('y','OTHER',16)]}],plan:[]},onJump:chapter=>jumps.push(chapter.month)});
 const section=container.children[0],list=section.children[2],buttons=list.querySelectorAll('button');
 buttons[0].listeners.click();expect(jumps).toEqual([16]);let prevented=false;list.listeners.keydown({target:buttons[0],key:'End',preventDefault(){prevented=true;}});expect(doc.activeElement).toBe(buttons[1]);expect(prevented).toBe(true);
 list.listeners.keydown({target:buttons[1],key:'ArrowLeft',preventDefault(){}});expect(doc.activeElement).toBe(buttons[0]);view.dispose();expect(buttons[0].listeners.click).toBeUndefined();expect(section.removed).toBe(true);
 const empty=new Element('div',doc);createChapters(empty,{history:{baseline:[],plan:[]}});expect(empty.children[0].children[1].textContent).toContain('No discoveries inferred');expect(empty.querySelectorAll('button')).toEqual([]);
});
