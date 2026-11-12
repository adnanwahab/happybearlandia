import {test, expect} from 'bun:test';
import {createExperimentsHandler} from '../world/experiments-api.js';
import {MAX_EXPERIMENT_BYTES, validateExperimentInput} from '../world/experiment-input.js';
const request = body => new Request('http://local/api/world/experiments', {method:'POST', body:JSON.stringify(body)});
const plan = {proposalIds:['t_bus']};
test('malformed public inputs fail before any provider or simulation work', async () => {
  let calls = 0;
  const handle = createExperimentsHandler({fetchPlan:async()=>{calls++;},getArea:async()=>{calls++;},runner:async()=>{calls++;}});
  const invalid = [null, [], true, 'scenario', ...['seeds','years','maxPeople'].flatMap(field => ['2','NaN','Infinity',null,true,[],{}].map(value => ({...plan,[field]:value}))),
    {...plan,baseSeed:{}}, {...plan,baseSeed:'x'.repeat(65)}, {...plan,baseSeed:''},
    {...plan,location:{lat:'20',lng:10}}, {...plan,location:{lat:86,lng:0}},
    {...plan,checkpoints:[1,'2']}, {...plan,checkpoints:[11]}, {...plan,checkpoints:Array(12).fill(1)},
    {...plan,procedural:'true'}, {proposalIds:[{}]}, {proposalIds:Array(101).fill('t_bus')},
    {plan:{kind:'planspec',version:2,planId:'p',actions:[]}},
    ...['NaN',-1,1e7].map(costB=>({plan:{items:[{id:'t_bus',costB}]}})),
    ...['2',-1,11].map(startYear=>({plan:{kind:'planspec',version:1,planId:'p',actions:[{proposalId:'t_bus',startYear}]}}))];
  for (const input of invalid) {
    const response = await handle(request(input));
    expect(response.status).toBe(400);
    expect((await response.json()).error.length).toBeGreaterThan(0);
  }
  expect(calls).toBe(0);
  expect((await (await handle(new Request('http://local/api/world/experiments'))).json()).experiments).toEqual([]);
});
test('streamed body size is enforced without trusting content-length', async()=>{
  const handle=createExperimentsHandler();
  const response=await handle(new Request('http://local/api/world/experiments',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(' '.repeat(MAX_EXPERIMENT_BYTES+1)));c.close();}}),duplex:'half'}));
  expect(response.status).toBe(413);
  expect((await response.json()).error).toContain('64 KiB');
  expect((await handle(new Request('http://local/api/world/experiments',{method:'POST',body:'{'}))).status).toBe(400);
});
test('finite numeric extremes keep existing clamps and missing fields keep defaults',async()=>{
  const handle=createExperimentsHandler({runner:async()=>({meta:{}})});
  const response=await handle(request({...plan,seeds:Number.MAX_VALUE,years:0,maxPeople:9999,baseSeed:'0',procedural:true}));
  expect(response.status).toBe(202);
  const {params}=await response.json();
  expect(params).toMatchObject({seeds:32,years:5,maxPeople:300,baseSeed:'0'});
  const defaults=await(await handle(request(plan))).json();
  expect(defaults.params).toMatchObject({seeds:8,years:5,maxPeople:120,baseSeed:'hbl'});
});
test('direct non-JSON numeric values cannot bypass validation',()=>{
  for(const field of ['seeds','years','maxPeople']) for(const value of [NaN,Infinity,-Infinity]) expect(()=>validateExperimentInput({...plan,[field]:value})).toThrow(field);
});

test('import validation follows the fields consumed by the plan compiler', async()=>{
  let calls=0;
  const handle=createExperimentsHandler({runner:async()=>{calls++;return {meta:{}};}});
  const action={proposalId:'t_bus',startYear:1};
  const invalid=[
    {kind:'planspec',version:1,planId:'p'},
    {kind:'planspec',version:1,planId:'p',actions:[{...action,costB:'Infinity',proposal:{id:'t_bus',costB:1}}]},
    {kind:'planspec',version:1,planId:'p',actions:[{...action,proposalId:{},proposal:{id:'t_bus'}}]},
    {items:[{id:'t_bus',proposal:[]}]},
    {items:[{id:'t_bus',proposal:{title:{}}}]},
    {package:[]},
  ];
  for(const imported of invalid) {
    const response=await handle(request({plan:imported}));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('plan');
  }
  expect(calls).toBe(0);
  const provider=createExperimentsHandler({fetchPlan:async()=>({packages:[{name:'Bad',items:[{id:'t_bus',costB:'NaN'}]}]}),runner:async()=>{calls++;}});
  expect((await provider(request({package:'Bad'}))).status).toBe(400);
  expect(calls).toBe(0);
});

test('numeric boundary matrix preserves finite floor/default/clamp behavior',async()=>{
  const handle=createExperimentsHandler({runner:async()=>({meta:{}})});
  for(const [field,def,max] of [['seeds',8,32],['years',5,10],['maxPeople',120,300]]) {
    for(const value of [-Number.MAX_VALUE,-1,0,0.99,1,1.99,max,max+1,Number.MAX_VALUE]) {
      const response=await handle(request({...plan,[field]:value}));
      expect(response.status).toBe(202);
      expect((await response.json()).params[field]).toBe(value<1?def:Math.min(max,Math.floor(value)));
    }
  }
});
