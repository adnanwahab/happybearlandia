import {test, expect} from 'bun:test';
import {decomposeRent, renderRentDecomposition} from '../world/future-machine/rent-decomposition.js';
import {initialForRecipe, normalizeReplay} from '../world/future-machine/data/index.js';
import {createEngine, addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';

function pair(seed=42, intervention=DEFAULT_RECIPE.intervention) {
  const initial=initialForRecipe({...DEFAULT_RECIPE, seed});
  const baseline=normalizeReplay(initial,createEngine().run(initial,120));
  const plan=normalizeReplay(initial,createEngine().run(intervention?addIntervention(initial,intervention):initial,120));
  return baseline.map((a,i)=>({baseline:a,plan:plan[i]}));
}
test('all 121 matched months reconcile for seed 42 and another seed, without mutating records',()=>{
  for(const seed of [42,7]) {
    const frames=pair(seed), before=JSON.stringify(frames);
    for(const frame of frames) {
      const r=decomposeRent(frame);
      expect(r.status).toBe('available');
      expect(Math.abs(r.price+r.composition-r.delta)).toBeLessThanOrEqual(1e-6);
    }
    expect(decomposeRent(frames[0])).toMatchObject({price:0,composition:0,newCount:0,existingCount:36,denominator:36});
    if(seed===42) {
      const end=decomposeRent(frames[120]);
      expect(end).toMatchObject({newCount:24,existingCount:36,denominator:60});
      expect(end.delta).toBeCloseTo(-740.769,3);
    }
    expect(JSON.stringify(frames)).toBe(before);
  }
});
test('matched control has zero components throughout',()=>{
  for(const frame of pair(42,null)) expect(decomposeRent(frame)).toMatchObject({price:0,composition:0,delta:0,newCount:0});
});
test('missing observations, mismatched time, unknown inventory and stale metrics are unavailable',()=>{
  expect(decomposeRent(null).status).toBe('unavailable');
  const frame=pair()[120];
  for(const mutate of [f=>f.plan.state.month--,f=>f.plan.state.seed++,f=>f.plan.metrics.meanRent=null,f=>f.plan.state.units[0].rent=null,f=>f.plan.state.projects=[],f=>f.plan.metrics.meanRent++,f=>f.plan.state.units.shift()]) {
    const copy=structuredClone(frame);mutate(copy);
    expect(decomposeRent(copy).status).toBe('unavailable');
  }
});

test('rendered bar exposes signed opposing components, denominator, zero and unavailable states',()=>{
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};this.ownerDocument=doc;}
    append(node){this.children.push(node);}
    setAttribute(key,value){this.attributes[key]=value;}
  }
  const doc={createElement:tag=>new Element(tag)}, host=new Element('div');
  renderRentDecomposition(host,{status:'available',month:16,price:-20,composition:10,delta:-10,existingCount:2,newCount:1,denominator:3});
  const root=host.children[0], bar=root.children.find(n=>n.className==='fm-rent-stack');
  expect(bar.attributes.role).toBe('img');
  expect(bar.attributes['aria-label']).toContain('composition effect: 10.000000 USD/month');
  expect(parseFloat(bar.children[0].style.width)).toBeCloseTo(200/3);
  expect(root.children.some(n=>n.textContent?.includes('denominator: 3'))).toBe(true);
  renderRentDecomposition(host,{status:'available',month:0,price:0,composition:0,delta:0,existingCount:2,newCount:0,denominator:2});
  expect(host.children[1].children.find(n=>n.className==='fm-rent-stack').children[0].style.width).toBe('50%');
  renderRentDecomposition(host,{status:'unavailable',reason:'Missing snapshots.'});
  expect(host.children[2].children[1].textContent).toBe('Decomposition unavailable: Missing snapshots.');
});
