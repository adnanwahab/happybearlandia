import {test,expect} from 'bun:test';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {stateHash} from '../world/future-machine/data/core.js';
import {buildComic,comicDocument} from '../world/future-machine/story/comic.js';

export async function comicHistory(){
  const initial=initialForRecipe();
  function run(policy){let state=policy?addIntervention(initial,policy):structuredClone(initial);const engine=createEngine(),steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}
  return {experimentId:'city_comic_test',modelVersion:DEFAULT_RECIPE.modelVersion,seed:42,initialHash:await stateHash(initial),recipe:DEFAULT_RECIPE,provenance:{...initial.provenance,replay:'Recomputed from saved City manifest; not independently verified recorded checkpoints.'},baseline:run(null),plan:run(DEFAULT_RECIPE.intervention)};
}
test('real engine produces deterministic bounded dated panels and exact source metrics',async()=>{
  const history=await comicHistory(),before=await stateHash(history),a=buildComic(history),b=buildComic(history);
  expect(a).toEqual(b);expect(a.available).toBe(true);expect(a.panels).toHaveLength(6);
  expect(a.panels.map(p=>p.month)).toEqual([0,16,24,60,96,120]);
  const completion=a.panels[1];expect(completion.date).toBe('2027-05');
  expect(completion.arms[0].metrics.housingUnits).toBe(36);expect(completion.arms[1].metrics.housingUnits).toBe(60);
  expect(completion.arms[1].metrics.capitalSpending).toBe(1000000);
  expect(completion.arms[1].events.some(e=>e.eventType==='PROJECT_COMPLETE')).toBe(true);
  expect(completion.url).toContain('month=16');expect(completion.url).toContain('experiment=city_comic_test');
  expect(await stateHash(history)).toBe(before);
  const html=comicDocument(a);expect(html).toContain('<svg');expect(html).toContain('@media print');expect(html).toContain('Complete text alternative');expect(html).not.toContain('<script');
  console.log('SHE-782 receipt',JSON.stringify({version:a.version,identity:a.identity,months:a.panels.map(p=>({month:p.month,date:p.date,metrics:p.arms.map(a=>a.metrics)})),digest:await stateHash(a)}));
});
test('missing/denied/unpinned frames stay unavailable; zero is retained; markup escapes source data',async()=>{
  expect(buildComic(null).available).toBe(false);
  const history=await comicHistory();
  expect(buildComic({...history,initialHash:null}).available).toBe(false);
  expect(buildComic({...history,seed:99}).available).toBe(false);
  const sparse={...history,plan:history.plan.slice()};sparse.plan[24]=null;
  const comic=buildComic(sparse);expect(comic.panels.find(p=>p.month===24).arms[1].missing).toBe(true);
  expect(comic.panels[0].arms[0].metrics.capitalSpending).toBe(0);
  sparse.plan[60]={...sparse.plan[60],metrics:{},events:[{eventType:'<script>alert(1)</script>'}]};
  const html=comicDocument(buildComic(sparse));expect(html).toContain('Missing frame');expect(html).toContain('Homes: unavailable');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');
});

test('native recap action, missing state, local download, replacement and disposal',async()=>{
  const {mountComic}=await import('../world/future-machine/story/comic.js');
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.handlers=new Map();this.ownerDocument=doc;}
    append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}
    replaceChildren(...nodes){this.children=nodes;this.innerHTML='';}
    addEventListener(type,handler){this.handlers.set(type,handler);}removeEventListener(type){this.handlers.delete(type);}
    click(){downloads.push({href:this.href,name:this.download});}remove(){this.removed=true;}
  }
  const doc={createElement:tag=>new Element(tag)},downloads=[],container=new Element('div');let history=null;
  const view=mountComic(container,{getHistory:()=>history});const host=container.children[0],open=host.children[1],output=host.children[2];
  expect(open.tag).toBe('button');expect(open.type).toBe('button');open.handlers.get('click')();expect(output.innerHTML).toContain('Recap unavailable');expect(output.children).toHaveLength(0);
  history=await comicHistory();open.handlers.get('click')();expect(output.innerHTML).toContain('2027-05');
  output.children[0].onclick();expect(downloads).toHaveLength(1);expect(downloads[0].href).toStartWith('blob:');expect(downloads[0].name).toBe('future-comic.html');
  view.clear();expect(output.children).toHaveLength(0);expect(output.innerHTML).toBe('');
  view.dispose();expect(open.handlers.size).toBe(0);expect(host.removed).toBe(true);
});
