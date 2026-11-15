import {test,expect} from 'bun:test';
import {mountHouseMilestones} from '../world/house/milestones-ui.js';

// Minimal DOM harness exercises controller behavior; native focus/layout are
// covered by the separate Playwright suite, not claimed by this harness.
class Element {
 constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this.style={};this.value='';this.events={};this.text='';}
 append(n){this.children.push(n);n.parent=this;if(this.tag==='select'&&this.children.length===1)this.value='all';}
 set textContent(text){this.text=text;this.children=[];}
 get textContent(){return this.text+this.children.map(n=>n.textContent).join(' ');}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelector(){return null;}
 replaceChildren(){this.children=[];this.text='';}
 addEventListener(k,fn){this.events[k]=fn;}
 showModal(){this.open=true;}
 close(){this.open=false;this.events.close?.();}
 focus(){this.focused=true;}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
function harness(load){const doc={createElement:tag=>new Element(tag,doc)},root=new Element('main',doc);const ui=mountHouseMilestones(root,{experimentId:'saved001',householdId:'p-h0',load});return{root,ui,dialog:root.children[1],all:()=>{const nodes=[];function walk(n){nodes.push(n);n.children.forEach(walk);}walk(root);return nodes;}};}
const row={id:'job:1',category:'job',title:'Job found',tick:12,minute:12,checkpointId:'saved001',sourcePath:'model.events[0]',source:{id:'event1'},seekId:'saved001'};
test('UI filters intersect category and exact tick, retain source links and explain missing snapshots',async()=>{
 const f=harness(async()=>({rows:[row,{...row,id:'move:2',category:'moving-in',title:'Household moved',tick:4,minute:4,seekId:null}],notice:''}));await f.ui.open();
 expect(f.dialog.open).toBe(true);expect(f.dialog.textContent).toContain('Exact snapshot unavailable at tick 4');
 expect(f.all().find(n=>n.text==='Seek exact tick 12').href).toBe('/world?experiment=saved001');
 expect(f.all().find(n=>n.text==='Open source checkpoint').href).toBe('/api/world-experiments/saved001');
 const category=f.all().find(n=>n.tag==='select'),tick=f.all().find(n=>n.tag==='input');category.value='job';category.onchange();
 expect(f.dialog.textContent).not.toContain('Household moved');tick.value='4';tick.oninput();expect(f.dialog.textContent).toContain('No matching recorded milestones');
 category.value='moving-in';category.onchange();expect(f.dialog.textContent).toContain('Household moved');
 f.all().find(n=>n.text==='Close milestones').onclick();expect(f.dialog.open).toBe(false);expect(f.root.children[0].focused).toBe(true);f.ui.destroy();expect(f.root.children).toEqual([]);
});
test('failed reload clears previous results and changing filters cannot restore stale history',async()=>{
 let fail=false;const f=harness(async()=>{if(fail)throw Error('Checkpoint missing');return{rows:[row],notice:''};});await f.ui.open();f.dialog.close();fail=true;await f.ui.open();expect(f.dialog.textContent).toContain('Checkpoint missing');
 const category=f.all().find(n=>n.tag==='select');category.value='job';category.onchange();expect(f.dialog.textContent).not.toContain('Job found');f.ui.destroy();
});
test('closing an asynchronous read aborts it and prevents late content',async()=>{
 let complete,signal;const f=harness((_id,_house,options)=>{signal=options.signal;return new Promise(resolve=>complete=resolve);});const opening=f.ui.open();f.dialog.close();expect(signal.aborted).toBe(true);complete({rows:[row],notice:''});await opening;expect(f.dialog.textContent).not.toContain('Job found');f.ui.destroy();
});
