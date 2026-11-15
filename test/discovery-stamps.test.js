import {test, expect} from 'bun:test';
import {STAMPS, STAMP_KEY, decodeStamps, createStampBook} from '../world/universe/discovery-stamps.js';
test('untrusted local records retain only unique authored stamp IDs', () => {
  for (const raw of ['{', '{}', 'null', '42']) expect([...decodeStamps(raw)]).toEqual([]);
  expect([...decodeStamps('["petal","petal","unknown",{},null]')]).toEqual(['petal']);
});
test('collect, reopen and reset leave unrelated storage untouched', () => {
  const data = new Map([['run','unchanged']]);
  const storage = {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const book = createStampBook(storage);
  book.collect('unknown'); expect(data.has(STAMP_KEY)).toBe(false);
  STAMPS.forEach(stamp=>book.collect(stamp.id)); book.collect('petal');
  expect(JSON.parse(data.get(STAMP_KEY))).toEqual(['petal','quotation']);
  expect(createStampBook(storage).has('petal')).toBe(true);
  book.reset(); expect(createStampBook(storage).has('petal')).toBe(false);
  expect(data.get('run')).toBe('unchanged');
});
test('denied reads, writes and reset keep session usable and report failure', () => {
  const fail=()=>{throw Error('denied')};
  const book=createStampBook({getItem:fail,setItem:fail,removeItem:fail});
  expect(book.persistent).toBe(false); book.collect('petal');
  expect(book.has('petal')).toBe(true); expect(book.persistent).toBe(false);
  book.reset(); expect(book.has('petal')).toBe(false); expect(book.persistent).toBe(false);
});

test('real UI module renders collection, discovers, resets and handles missing mounts', async () => {
  const {runInNewContext} = await import('node:vm');
  const source=(await Bun.file('world/universe/discovery-stamps-ui.js').text()).replace(/^import .*;\n/, '');
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};}
    append(...children){this.children.push(...children);}
    setAttribute(key,value){this[key]=value;}
    addEventListener(key,fn){this.events[key]=fn;}
  }
  const walk=node=>[node,...node.children.filter(x=>x instanceof Node).flatMap(walk)];
  const data=new Map();
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  function mount(mode, localStorage=storage){
    const host=new Node('section');host.dataset.discoveryStamp='petal';
    const doc={head:new Node('head'),createElement:tag=>new Node(tag),querySelector:selector=>mode==='none'?null:selector==='[data-stamp-album]'?(mode==='album'?host:null):(mode==='stamp'?host:null)};
    runInNewContext(source,{document:doc,window:{localStorage},STAMPS,createStampBook});
    return walk(host);
  }
  const nodes=mount('stamp');
  const collect=nodes.find(n=>n.tag==='button'&&n.textContent==='Collect A quiet petal');
  collect.events.click();expect(collect.disabled).toBe(true);
  expect(mount('album').some(n=>n.textContent==='A quiet petal: discovered. ')).toBe(true);
  nodes.find(n=>n.textContent==='Reset stamp progress').events.click();expect(collect.disabled).toBe(false);
  expect(mount('none')).toHaveLength(1);
  expect(mount('album',undefined).some(n=>n.role==='status')).toBe(true);
  const blocked=mount('stamp',{getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}});
  blocked.find(n=>n.textContent==='Collect A quiet petal').events.click();
  expect(blocked.find(n=>n.role==='status').textContent).toContain('Storage unavailable');
});
