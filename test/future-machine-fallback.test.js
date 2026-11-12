import {test, expect} from 'bun:test';
import {createCanvas2DStage} from '../world/future-machine/fallback/index.js';
import {initialForRecipe, normalizeReplay} from '../world/future-machine/data/index.js';
import {createEngine, addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {compareFrame} from '../world/future-machine/diff/index.js';

function fixture(contextAvailable = true) {
  const nodes = [];
  const doc = {createElement(tag) {
    const node = {tag, style:{}, children:[], handlers:new Map(), clientWidth:390, clientHeight:320,
      ownerDocument:doc, setAttribute(){}, append(...children){this.children.push(...children);},
      remove(){this.removed=true;}, addEventListener(name, fn){this.handlers.set(name,fn);},
      removeEventListener(name){this.handlers.delete(name);},
      getContext:()=>contextAvailable ? new Proxy({}, {get:()=>()=>{}, set:()=>true}) : null};
    nodes.push(node);return node;
  }};
  return {container:doc.createElement('div'), nodes};
}
function history(intervention) {
  const initial = initialForRecipe();
  let state = intervention ? addIntervention(initial, intervention) : structuredClone(initial);
  const engine=createEngine(), steps=[];
  for(let month=0;month<120;month++){const step=engine.step(state);steps.push(step);state=step.state;}
  return normalizeReplay(initial,{steps});
}
test('Snapshot interface renders seed 42 model inventory at month 0 and 16 without mutating evidence',()=>{
  const baseline=history(null), plan=history(DEFAULT_RECIPE.intervention);
  const f=fixture(), stage=createCanvas2DStage(f.container);
  for(const month of [0,16]) {
    const frame={month,baseline:baseline[month],plan:plan[month]}, before=JSON.stringify(frame);
    const diff=compareFrame(frame);stage.update(frame,diff);
    expect(stage.getStats().backend).toBe('canvas2d');
    expect(stage.getStats().month).toBe(month);
    expect(stage.getStats().animationFrames).toBe(0);
    expect(JSON.stringify(frame)).toBe(before);
    expect(diff.metrics.housingUnits.delta).toBe(month===0?0:24);
    expect(f.nodes.find(n=>n.tag==='p').textContent).toContain(`housingUnits: ${plan[month].metrics.housingUnits} homes`);
  }
  stage.setMode('difference');stage.setGhosts(false);
  expect(stage.focus({collection:'buildings',id:'building-project-policy-1-0'})).toBe(true);
  expect(stage.focus({collection:'buildings',id:'invented'})).toBe(false);
  stage.dispose();stage.dispose();
  expect(stage.getStats().objects).toBe(0);
  expect(f.nodes.find(n=>n.tag==='canvas').handlers.size).toBe(0);
});
test('missing snapshots and metrics remain unavailable, mismatched clocks are rejected',()=>{
  const f=fixture(), stage=createCanvas2DStage(f.container), state=initialForRecipe();
  stage.update({month:0,baseline:{month:0,state,metrics:{housingUnits:0}},plan:null},{available:false});
  const status=f.nodes.find(n=>n.tag==='p');
  expect(status.textContent).toContain('plan: snapshot unavailable');
  expect(status.textContent).toContain('housingUnits: 0 homes');
  expect(status.textContent).toContain('meanRent: unavailable USD/month');
  expect(stage.getStats().objects).toBe(0);
  expect(()=>stage.update({month:1,baseline:{month:0,state},plan:null})).toThrow('month mismatch');
  stage.update(null);expect(status.textContent).toContain('snapshots unavailable');stage.dispose();
});
test('failed context creation removes the adapter and propagates startup failure',()=>{
  const f=fixture(false);expect(()=>createCanvas2DStage(f.container)).toThrow('Canvas2D unavailable');
  expect(f.nodes.find(n=>n.tag==='section').removed).toBe(true);
  expect(f.nodes.find(n=>n.tag==='canvas').removed).toBe(true);
});
