import {test,expect} from 'bun:test';
import {createLawBehaviorHandler,lawBehaviorReceipt,allowedLawBehaviorOrigin,LAW_BEHAVIOR_RECEIPT_VERSION} from '../world/laws/behavior-api.js';
import {isSimulationSubmission,createSimulationAdmission} from '../ops/security/simulation-admission.js';
import {getLaw} from '../world/laws/catalog.js';
const endpoint='http://127.0.0.1:3000/api/law-behavior';
const body={lawId:83,seed:42,population:24,implementationStrength:0.5};
const request=(input=body,origin='https://civic-synthesis.fly.dev')=>new Request(endpoint,{
  method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(input)
});
const fakeResult={
  status:'completed',supported:true,engine:'population',
  manifest:{seed:42,population:24,implementationStrength:0.5,modelVersion:'synthetic-test',pairedInitialState:true,secret:'PRIVATE'},
  baseline:{timeline:[{minute:0,metrics:{trips:0,privateMetric:555},actors:[
    {id:'test-p0',label:'Resident 1',mode:'walk',x:0,z:1,privateJournal:'PRIVATE_RECORD'}]}]},
  selected:{timeline:[{minute:0,metrics:{trips:0,privateMetric:600},actors:[
    {id:'test-p0',label:'Resident 1',mode:'bus',x:1,z:2,privateJournal:'PRIVATE_RECORD'}]}]}
};

test('read-only receipt sends only model outputs; never underlying private or unsupported fields',async()=>{
  const calls=[],handler=createLawBehaviorHandler({compare:async opts=>{calls.push(opts);return fakeResult;}});
  const response=await handler(request()),receipt=await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe('https://civic-synthesis.fly.dev');
  expect(receipt.schemaVersion).toBe(LAW_BEHAVIOR_RECEIPT_VERSION);
  expect(receipt.status).toBe('completed');
  expect(receipt.frames[0].baseline).toMatchObject({metrics:{trips:0},actors:[{id:'test-p0',mode:'walk'}]});
  expect(receipt.frames[0].edited.actors[0].mode).toBe('bus');
  expect(JSON.stringify(receipt)).not.toContain('PRIVATE_RECORD');
  expect(JSON.stringify(receipt)).not.toContain('privateMetric');
  expect(JSON.stringify(receipt)).not.toContain('secret');
  expect(calls[0]).toMatchObject({lawId:83,seed:42,population:24,implementationStrength:.5,minutes:720});
  expect(calls[0]).not.toHaveProperty('worldContext');
},60000);

test('cross-origin CORS deny-by-default, preflight, and bounded inputs',async()=>{
  const handler=createLawBehaviorHandler({compare:async()=>fakeResult});
  expect(allowedLawBehaviorOrigin('https://civic-synthesis.fly.dev')).toBe(true);
  expect(allowedLawBehaviorOrigin('https://dear-congress.fly.dev')).toBe(true);
  expect(allowedLawBehaviorOrigin('http://localhost:3100')).toBe(true);
  for(const value of ['https://evil.example','https://civic-synthesis.fly.dev.evil.example','null','https://localhost:3100'])
    expect(allowedLawBehaviorOrigin(value)).toBe(false);
  expect((await handler(request(body,'https://evil.example'))).status).toBe(403);
  const options=await handler(new Request(endpoint,{method:'OPTIONS',headers:{origin:'https://civic-synthesis.fly.dev'}}));
  expect(options.status).toBe(204);
  expect(options.headers.get('access-control-allow-methods')).toContain('POST');
  expect((await handler(new Request(endpoint,{method:'GET'}))).status).toBe(405);
  for(const bad of [
    {...body,lawId:10},{...body,lawId:101},{...body,seed:-1},{...body,seed:1.5},
    {...body,population:100000},{...body,implementationStrength:1.1},{...body,implementationStrength:'0.5'},
    {...body,lawId:21,implementationStrength:0.5},{...body,lawId:31,implementationStrength:0.5}
  ])expect((await handler(request(bad))).status).toBeGreaterThanOrEqual(400);
  expect((await handler(request({...body,overlong:'a'.repeat(1100)}))).status).toBe(413);
});

test('unsupported laws contain no invented outcome frames',()=>{
  const law=getLaw(31);
  const receipt=lawBehaviorReceipt({status:'mechanism-unavailable',reason:'No reviewed engine.'},law);
  expect(receipt.status).toBe('mechanism-unavailable');
  expect(receipt.frames).toEqual([]);
  expect(receipt.manifest).toBeNull();
  expect(receipt.reason).toContain('No reviewed engine');
});

test('admission shares one request budget with expensive simulation endpoints',()=>{
  const admit=createSimulationAdmission({perClient:1,total:2});
  const first=request({...body,implementationStrength:1});
  expect(isSimulationSubmission(first)).toBe(true);
  expect(admit(first,'127.0.0.1')).toBeNull();
  expect(admit(request(body),'127.0.0.1')?.status).toBe(429);
});

test('global active comparison cap prevents unbounded concurrent work',async()=>{
  let release;
  const pending=new Promise(resolve=>release=resolve);
  const handler=createLawBehaviorHandler({maxConcurrent:1,compare:async()=>{await pending;return fakeResult;}});
  const first=handler(request());
  // First call yields while reading the short JSON body; giving it a turn ensures it takes the semaphore.
  await new Promise(resolve=>setTimeout(resolve,0));
  const blocked=await handler(request());
  expect(blocked.status).toBe(503);
  expect(blocked.headers.get('retry-after')).toBe('5');
  release();
  expect((await first).status).toBe(200);
});

test('actual bounded model endpoint emits genuine paired checkpoints',async()=>{
  const handler=createLawBehaviorHandler();
  const response=await handler(request({...body,population:8,implementationStrength:0.5}));
  expect(response.status).toBe(200);
  const data=await response.json();
  expect(data.status).toBe('completed');
  expect(data.frames.length).toBeGreaterThan(1);
  expect(data.frames[0].time).toBe(0);
  expect(data.frames.at(-1).time).toBe(720);
  expect(data.frames[0].baseline.actors[0].id).toBe(data.frames[0].edited.actors[0].id);
  expect(data.manifest.seed).toBe(42);
  expect(data.manifest.implementationStrength).toBe(.5);
},60000);
