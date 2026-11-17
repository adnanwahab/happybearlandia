import {test, expect} from 'bun:test';
import {createDiscoveryState, buildingEvidence} from '../world/discovery-fog.js';

test('opt-in, supported identity inspection and local reset', () => {
  const a=createDiscoveryState(['a','b']), b=createDiscoveryState(['a']);
  expect(a.masked('a')).toBe(false); a.enable(true);
  expect(a.masked('a')).toBe(true); expect(a.inspect('missing')).toBe(false);
  expect(a.masked('missing')).toBe(false); expect(a.inspect('a')).toBe(true);
  expect(a.masked('a')).toBe(false); expect(a.masked('b')).toBe(true);
  a.reset(); expect(a.masked('a')).toBe(true); a.enable(false);
  expect(a.masked('a')).toBe(false); expect(b.masked('a')).toBe(false);
});

test('evidence retains actual identities and zero area, reports absent fields without inventing records', () => {
  const buildings=[{id:'osm:1',name:'<unsafe>',kind:'home',area:0},{id:'synthetic:1',area:NaN},null];
  const before=structuredClone(buildings), rows=buildingEvidence(buildings,'osm');
  expect(rows).toHaveLength(2); expect(rows[0].id).toBe('osm:1');
  expect(rows[0].name).toBe('<unsafe>'); expect(rows[0].text).toContain('0 m²');
  expect(rows[1].text).toContain('Area unavailable');
  expect(rows[0].text).toContain('may be synthetic'); expect(buildings).toEqual(before);
  expect(buildingEvidence()).toEqual([]);
});

import {mountDiscoveryFog} from '../world/discovery-fog.js';
function dom() {
  const nodes=[], frames=new Map(); let clock=0, next=0;
  const win={performance:{now:()=>++clock},requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
  const doc={defaultView:win,createTextNode:text=>({textContent:text}),createElement:tag=>{
    const listeners=new Map();
    const node={tag,ownerDocument:doc,children:[],dataset:{},textContent:'',append(child){this.children.push(child);},setAttribute(){},remove(){this.removed=true;},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),fire:name=>listeners.get(name)?.()};nodes.push(node);return node;
  }};
  return {nodes,frames,container:doc.createElement('main'),flush(){while(frames.size){const jobs=[...frames];frames.clear();for(const [,fn]of jobs)fn(++clock);}}};
}
test('component keeps failure masked, retries successfully, preserves flat evidence and cancels repaint work', async()=>{
  const d=dom(); let fail=true,calls=0;
  const fog=mountDiscoveryFog({...d,buildings:[{id:'a',name:'Existing',area:12}],source:'fixture',onInspect:id=>{calls++;expect(id).toBe('a');if(fail)throw Error('unavailable');return true;}});
  const checkbox=d.nodes.find(n=>n.type==='checkbox'),card=d.nodes.find(n=>n.tag==='article'),button=d.nodes.find(n=>n.textContent==='Inspect Existing');
  checkbox.checked=true;checkbox.fire('change');expect(card.dataset.masked).toBe('true');
  await button.fire('click');expect(card.dataset.masked).toBe('true');
  expect(d.nodes.some(n=>n.textContent.startsWith('Could not inspect'))).toBe(true);
  fail=false;await button.fire('click');expect(card.dataset.masked).toBe('false');
  expect(d.nodes.find(n=>n.tag==='li').children[0].textContent).toContain('12 m²');
  const reset=d.nodes.find(n=>n.textContent==='Reset inspected places');reset.fire('click');expect(card.dataset.masked).toBe('true');
  fog.observe('unsupported');expect(card.dataset.masked).toBe('true');fog.observe('a');expect(card.dataset.masked).toBe('false');
  d.flush();expect(fog.getMetrics().lastFrameGapMs).toBeGreaterThan(0);
  reset.fire('click');expect(d.frames.size).toBe(1);fog.dispose();expect(d.frames.size).toBe(0);expect(fog.getMetrics().pendingFrame).toBe(false);
  await button.fire('click');expect(calls).toBe(2);
});
test('unsupported and unavailable inspector states stay truthful', async()=>{
  const d=dom(),fog=mountDiscoveryFog({...d,buildings:[]});
  expect(d.nodes.find(n=>n.type==='checkbox').disabled).toBe(true);
  expect(d.nodes.some(n=>n.textContent==='No supported building evidence is loaded.')).toBe(true);fog.dispose();
  const x=dom();mountDiscoveryFog({...x,buildings:[{id:'b'}],onInspect:()=>false});
  const checkbox=x.nodes.find(n=>n.type==='checkbox');checkbox.checked=true;checkbox.fire('change');
  await x.nodes.find(n=>n.textContent==='Inspect b').fire('click');expect(x.nodes.find(n=>n.tag==='article').dataset.masked).toBe('true');
});
test('reset and disposal invalidate late inspection completions', async()=>{
  const d=dom();let finish;
  const fog=mountDiscoveryFog({...d,buildings:[{id:'a'}],onInspect:()=>new Promise(resolve=>{finish=resolve;})});
  const checkbox=d.nodes.find(n=>n.type==='checkbox');checkbox.checked=true;checkbox.fire('change');
  const button=d.nodes.find(n=>n.textContent==='Inspect a'),pending=button.fire('click');
  d.nodes.find(n=>n.textContent==='Reset inspected places').fire('click');finish(true);await pending;
  expect(d.nodes.find(n=>n.tag==='article').dataset.masked).toBe('true');
  const late=button.fire('click');fog.dispose();finish(true);await late;expect(d.frames.size).toBe(0);
});
