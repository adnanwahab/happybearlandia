import {test,expect} from 'bun:test';
import {BOOKMARK_KEY,readBookmarks,saveBookmarks,bookmarkScene} from '../world/future-machine/bookmarks.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
const row=month=>({label:`Scene ${month}`,recipe:structuredClone(DEFAULT_RECIPE),experimentId:'city_test',month,checkpoint:`monthly-city:${month}`,entity:{collection:'buildings',id:'building-d1',arm:'plan'}});
test('three detached named scenes retain exact run, month and entity; remove all is scoped',()=>{
 const values=new Map([['unrelated','keep']]);const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 expect(readBookmarks(storage)).toEqual([]);const rows=[row(0),row(16),row(120)];saveBookmarks(storage,rows);rows[0].recipe.seed++;
 for(const saved of readBookmarks(storage)){expect(saved.recipe).toEqual(DEFAULT_RECIPE);const history={experimentId:saved.experimentId,recipe:saved.recipe,baseline:[],plan:[]};for(const arm of ['baseline','plan'])history[arm][saved.month]={month:saved.month,state:{buildings:[{id:'building-d1'}]}};expect(()=>bookmarkScene(history,saved)).not.toThrow();history.plan[saved.month].state.buildings=[];expect(()=>bookmarkScene(history,saved)).toThrow('entity unavailable');}
 values.delete(BOOKMARK_KEY);expect(readBookmarks(storage)).toEqual([]);expect(values.get('unrelated')).toBe('keep');
});
test('corrupt, incompatible, missing-run and invalid checkpoints fail explicitly',()=>{
 for(const raw of ['{','{}',JSON.stringify([{...row(16),checkpoint:'invented'}]),JSON.stringify([{...row(16),experimentId:null}]),JSON.stringify([{...row(16),recipe:{...DEFAULT_RECIPE,modelVersion:'expired'}}])])expect(()=>readBookmarks({getItem:()=>raw})).toThrow('corrupt or expired');
 expect(()=>saveBookmarks({setItem(){throw new Error('denied');}},[row(16)])).toThrow('denied');
 expect(()=>bookmarkScene({experimentId:'city_other'},row(16))).toThrow('identity');
});

import {mountBookmarks} from '../world/future-machine/ui/bookmarks.js';
test('component saves, opens, exports, removes and recovers corrupt storage',async()=>{
 const doc={createElement(tag){return {tag,ownerDocument:doc,children:[],value:'',setAttribute(){},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)]);},remove(){}};}};
 const container=doc.createElement('main'),data=new Map();let opened,exported;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context=row(16);delete context.label;
 const view=mountBookmarks(container,{storage,getContext:()=>context,onOpen:r=>{opened=r;},onExport:r=>{exported=r;}});
 const root=container.children[0],buttons=()=>root.querySelectorAll('button'),click=async name=>buttons().find(b=>b.textContent===name).onclick();
 root.children.find(n=>n.tag==='input').value='My scene';await click('Save event bookmark');
 await click('Reopen My scene · Month 16');expect(opened.entity.id).toBe('building-d1');
 await click('Export recipes and bookmarks');expect(exported.bookmarks).toHaveLength(1);
 await click('Remove My scene');expect(readBookmarks(storage)).toEqual([]);
 storage.setItem(BOOKMARK_KEY,'{');view.dispose();const broken=mountBookmarks(container,{storage,getContext:()=>context,onOpen(){},onExport(){}});
 const brokenRoot=container.children.at(-1);expect(brokenRoot.children.find(n=>n.tag==='p'&&n.textContent?.includes('corrupt'))).toBeDefined();
 await brokenRoot.querySelectorAll('button').find(b=>b.textContent==='Remove all bookmarks').onclick();expect(storage.getItem(BOOKMARK_KEY)).toBeNull();broken.dispose();
});
