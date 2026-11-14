import {test,expect} from 'bun:test';
import {buildDocumentary} from '../world/future-machine/story/documentary.js';
const snapshot=month=>({month,state:{buildings:[{id:'b1'}]},events:month?[{id:'event-1',simulationTime:month,eventType:'PROJECT_COMPLETE',payload:{buildingId:'b1',projectId:'p1'}}]:[]});
const history={recipe:{seed:42},seed:42,modelVersion:'test',experimentId:'run',initialHash:'digest',baseline:[snapshot(0),snapshot(120)],plan:[snapshot(0),snapshot(120)]};
test('bounded deterministic edit preserves timestamps, arm-scoped sources, recipe and input',()=>{
 const before=JSON.stringify(history),edit=buildDocumentary(history);
 expect(edit.durationSeconds).toBe(60);expect(edit.cards.length).toBeLessThanOrEqual(6);
 expect(edit.cards[0].startSeconds).toBe(0);expect(edit.cards.at(-1).endSeconds).toBe(60);
 expect(edit.cards.filter(c=>c.moment).map(c=>c.moment.arm)).toEqual(['baseline','plan']);
 expect(edit.cards[1].moment.record.payload.buildingId).toBe('b1');
 expect(edit.cards[1].checkpoints.plan.buildings).toEqual(['b1']);
 expect(JSON.parse(JSON.stringify(edit)).recipe).toEqual(history.recipe);
 expect(buildDocumentary(structuredClone(history))).toEqual(edit);
 edit.recipe.seed=1;expect(JSON.stringify(history)).toBe(before);
});
test('unchanged run is quiet even with ordinary background events',()=>{
 const edit=buildDocumentary(history,[{month:0,available:true,entities:[]},{month:120,available:true,entities:[]}]);
 expect(edit.quiet).toBe(true);expect(edit.cards).toHaveLength(2);expect(edit.cards.every(c=>!c.moment&&c.interpretation.includes('quiet'))).toBe(true);
});
test('empty, missing paired checkpoints and missing inventory stay unavailable',()=>{
 expect(buildDocumentary({}).cards).toEqual([]);
 expect(buildDocumentary({baseline:[snapshot(0)],plan:[]}).durationSeconds).toBe(0);
 const edit=buildDocumentary({baseline:[{month:0}],plan:[{month:0}]},[{available:false}]);
 expect(edit.quiet).toBe(false);expect(edit.cards[0].checkpoints.plan.buildings).toBeNull();
});

test('native controls navigate rapidly without resources and disposal removes handlers',async()=>{
 const {renderDocumentary}=await import('../world/future-machine/story/documentary.js');
 let doc;
 class Node{
  constructor(tag){this.tag=tag;this.ownerDocument=doc;this.children=[];this.style={};this.attributes={};this.listeners=new Map();}
  append(child){this.children.push(child);}
  setAttribute(key,value){this.attributes[key]=value;}
  replaceChildren(child){this.children=[child];}
  addEventListener(key,value){this.listeners.set(key,value);}
  removeEventListener(key){this.listeners.delete(key);}
  remove(){this.removed=true;}
 }
 doc={createElement:tag=>new Node(tag)};
 const host=new Node('div'),edit=buildDocumentary(history),jumps=[];let exported;
 const dispose=renderDocumentary(host,edit,{onJump:stop=>jumps.push(stop),onExport:value=>exported=value});
 const all=node=>[node,...node.children.flatMap(all)],nodes=all(host),buttons=nodes.filter(n=>n.tag==='button');
 expect(buttons.every(n=>n.type==='button')).toBe(true);
 const jumpButtons=buttons.filter(n=>n.textContent.startsWith('Open documentary'));
 for(let i=0;i<40;i++)jumpButtons[i%jumpButtons.length].listeners.get('click')();
 expect(jumps.map(s=>s.month)).toEqual(Array.from({length:40},(_,i)=>edit.cards[i%edit.cards.length].month));
 buttons[0].listeners.get('click')();expect(exported).toBe(edit);
 expect(nodes.filter(n=>n.attributes.role==='img')).toHaveLength(edit.cards.length*2);
 dispose();expect(buttons.every(n=>n.listeners.size===0)).toBe(true);expect(host.children[0].removed).toBe(true);
});
