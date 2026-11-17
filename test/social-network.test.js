import {test, expect} from 'bun:test';
import {projectSocialNetwork} from '../world/relationships/network.js';
import {createSocialWorld, populationSocial} from '../world/relationships/model.js';
import {createPopulationModel,serializePopulation,restorePopulation} from '../world/population/model.js';
const people = ['a','b','c','d','alone'];
const getPerson = id => people.includes(id) ? {id, name:'PRIVATE NAME'} : null;
const ties = {ab:{a:'a',b:'b',memories:[{text:'PRIVATE MEMORY'}]},bc:{a:'b',b:'c'},ca:{a:'c',b:'a'},cd:{a:'c',b:'d'}};
const project = options => projectSocialNetwork({ties, rootId:'a', getPerson,...options});
test('depth, cycle closing, isolates, invalid entries and privacy', () => {
  expect(project({depth:0}).edges).toEqual([]);
  expect(project({depth:1}).nodes.map(n=>n.id)).toEqual(['a','b','c']);
  expect(project({depth:1}).edges.map(e=>e.id).sort()).toEqual(['ab','bc','ca']);
  expect(project({depth:2}).nodes.map(n=>n.id)).toEqual(['a','b','c','d']);
  expect(project({rootId:'alone'}).nodes).toHaveLength(1);
  expect(project({rootId:'alone'}).edges).toEqual([]);
  const result=project({ties:{...ties,bad:{a:'a',b:'missing'},self:{a:'a',b:'a'},nil:null}});
  expect(result.omittedInvalid).toBe(3);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  for(const edge of result.edges)expect(ties[edge.id]).toMatchObject({a:edge.from,b:edge.to});
});
test('strict bounded options, stable traversal, no ledger mutation',()=>{
  const before=structuredClone(ties);
  for(const depth of [-1,4,1.5,NaN])expect(()=>project({depth})).toThrow();
  expect(()=>project({rootId:'missing'})).toThrow();
  const bounded=project({maxNodes:2,maxEdges:1});
  expect(bounded.nodes).toHaveLength(2);expect(bounded.edges).toHaveLength(1);expect(bounded.truncated).toBe(true);
  expect(project({ties:Object.fromEntries(Object.entries(ties).reverse())})).toEqual(project({}));
  expect(ties).toEqual(before);
});
test('seeded backstory never becomes a ledger edge',()=>{
  const model=createPopulationModel({population:40,seed:42});
  const social=populationSocial(model).inspect(0);
  expect(social.relationships.length).toBeGreaterThan(0);
  expect(social.network.edges).toEqual([]);expect(social.network.nodes).toHaveLength(1);
});
test('actual Population encounters preserve IDs and provenance through restore',()=>{
  const model=createPopulationModel({population:40,seed:42});
  const social=populationSocial(model), a=social.inspect(0), b=a.nearby[0];
  const result=social.interact(0,b.id,'talk').social.network;
  expect(result.edges).toHaveLength(1);
  expect(result.provenance).toMatchObject({runId:model.prefix,modelVersion:model.modelVersion,seed:42,minute:model.minute,synthetic:true});
  expect(populationSocial(restorePopulation(serializePopulation(model))).inspect(0).network).toEqual(result);
  const repeat=createPopulationModel({population:40,seed:42});
  expect(populationSocial(repeat).interact(0,b.id,'talk').social.network).toEqual(result);
});
test('generic social inspector uses only exact persisted endpoint IDs',()=>{
  const state={ties:{...ties}};
  const social=createSocialWorld({count:0,getPerson,state});
  expect(social.inspect('a').network.edges.map(e=>e.id).sort()).toEqual(Object.keys(ties).sort());
});
test('depth boundary excludes further ledger neighbors and dense budgets remain closed',()=>{
  const ids=Array.from({length:90},(_,i)=>String(i));
  const getPerson=id=>ids.includes(id)?{id}:null;
  const chain=Object.fromEntries(ids.slice(1).map((id,i)=>[`edge-${i}`,{a:String(i),b:id}]));
  const result=projectSocialNetwork({ties:chain,rootId:'0',getPerson,depth:3});
  expect(result.nodes.map(n=>n.id)).toEqual(['0','1','2','3']);
  expect(result.edges).toHaveLength(3);expect(result.truncated).toBe(false);
  const dense={};for(let i=0;i<90;i++)for(let j=i+1;j<90;j++)dense[`${i}-${j}`]={a:String(i),b:String(j)};
  const bounded=projectSocialNetwork({ties:dense,rootId:'0',getPerson});
  expect(bounded.nodes.length).toBeLessThanOrEqual(80);expect(bounded.edges).toHaveLength(160);expect(bounded.truncated).toBe(true);
  const visible=new Set(bounded.nodes.map(n=>n.id));
  for(const edge of bounded.edges){expect(visible.has(edge.from)).toBe(true);expect(visible.has(edge.to)).toBe(true);}
});
test('Population aliases cannot masquerade as canonical ledger identities',()=>{
  const getPerson=id=>['a','alias'].includes(id)?{id:'a'}:{id};
  expect(projectSocialNetwork({rootId:'a',getPerson,ties:{bad:{a:'a',b:'alias'}}}).omittedInvalid).toBe(1);
  expect(()=>projectSocialNetwork({rootId:'alias',getPerson})).toThrow();
});
