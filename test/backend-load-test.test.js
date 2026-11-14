import {test,expect} from 'bun:test';
import {runLoad,validateTarget,summarize,recipe} from '../ops/backend-load-test.mjs';
import {VERSION as recipeVersion} from '../world/city/contracts.js';
const config={origin:'https://hbl-staging.example.com',approvedOrigin:'https://hbl-staging.example.com',environment:'staging',app:'hbl-staging',buildSha:'a'.repeat(40),disposableData:true,concurrencyPrerequisite:'SHE-42 verified'};
const replayRecord=id=>({identity:{experimentId:id,scenarioId:'baseline',runIndex:0,runId:'baseline-0'},verification:{status:'matched'},state:{version:recipeVersion,seed:45,month:2},steps:[{},{}]});
test('dry run sends zero requests and pins synthetic recipe',async()=>{
  const result=await runLoad(config,{fetchImpl:()=>{throw Error('network forbidden');}});
  expect(result.dryRun).toBe(true);expect(result.plan.recipe.city.seed).toBe(45);expect(result.plan.recipe).toEqual(recipe);
});
test('rejects production, credentials, paths and missing prerequisite before network',()=>{
  for(const origin of ['https://happybearlandia.fly.dev','http://hbl-staging.example.com','https://user@hbl-staging.example.com','https://hbl-staging.example.com/path','https://hbl-staging.example.com?secret=x'])expect(()=>validateTarget({...config,origin})).toThrow();
  for(const field of ['approvedOrigin','buildSha','app','disposableData','concurrencyPrerequisite','environment'])expect(()=>validateTarget({...config,[field]:null})).toThrow();
});
test('bounded representative journeys, creation identities and replay contract',async()=>{
  let creates=0,replays=0;const paths=[];
  const result=await runLoad(config,{execute:true,fetchImpl:async(url,options)=>{
    const path=new URL(url).pathname;paths.push(path);
    if(path==='/api/ready')return Response.json({status:'ready',buildId:config.buildSha});expect(options.redirect).toBe('error');expect(options.credentials).toBe('omit');
    if(path==='/api/city-experiments'){creates++;expect(JSON.parse(options.body)).toEqual(recipe);return Response.json({id:`city_${creates}`},{status:202});}
    if(path.endsWith('/replay')){replays++;expect(JSON.parse(options.body)).toEqual({runIndex:0,scenarioId:'baseline'});return Response.json(replayRecord(path.split('/')[3]));}
    if(path.startsWith('/api/'))return Response.json({status:'complete'});
    return new Response('asset');
  }});
  expect(result.ok).toBe(true);expect(creates).toBe(4);expect(replays).toBe(4);expect(paths).toHaveLength(21);expect(result.saturation.clientPeakInFlight).toBeLessThanOrEqual(2);expect(result.saturation.serverCpu).toBeNull();
});
test('overload stops immediately without retries or writes',async()=>{
  let calls=0;const result=await runLoad(config,{execute:true,fetchImpl:async()=>{calls++;return new Response('',{status:429});}});
  expect(result.ok).toBe(false);expect(calls).toBe(1);expect(result.summary.ready.overloadResponses).toBe(1);expect(result.summary.ready.errorRate).toBe(1);
});
test('oversized responses fail closed',async()=>{
  const result=await runLoad(config,{execute:true,fetchImpl:async()=>new Response(new Uint8Array(2097153))});expect(result.ok).toBe(false);
});
test('nearest-rank latency and error counts',()=>{
  expect(summarize([1,2,3,4,100].map((ms,i)=>({kind:'asset',ms,ok:i!==4,status:i===4?503:200}))).asset).toEqual({requests:5,p50Ms:3,p95Ms:100,errors:1,errorRate:.2,overloadResponses:1});
});

test('wrong serving build prevents all workload requests',async()=>{
  let calls=0;
  const result=await runLoad(config,{execute:true,fetchImpl:async()=>{calls++;return Response.json({status:'ready',buildId:'b'.repeat(40)});}});
  expect(calls).toBe(1);expect(result.ok).toBe(false);expect(result.summary.ready.errors).toBe(1);
});
test('malformed creation is counted as an error and never retried',async()=>{
  let creates=0;
  const result=await runLoad(config,{execute:true,fetchImpl:async(url)=>{
    const path=new URL(url).pathname;
    if(path==='/api/ready')return Response.json({status:'ready',buildId:config.buildSha});
    if(path==='/api/city-experiments'){creates++;return Response.json({id:'invalid'},{status:202});}
    return new Response('ok');
  }});
  expect(result.ok).toBe(false);expect(creates).toBeLessThanOrEqual(2);expect(result.summary.create.errorRate).toBe(1);
});

test('real server civic handler accepts recipe and replays disposable saved runs',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {createServerCivicApiHandler}=await import('../world/server-civic-api.js');
  const root=await mkdtemp(join(tmpdir(),'hbl-load-contract-'));
  const handler=createServerCivicApiHandler({cityRoot:root});
  try {
    const result=await runLoad(config,{execute:true,fetchImpl:async(url,options)=>{
      const path=new URL(url).pathname;
      if(path==='/api/ready')return Response.json({status:'ready',buildId:config.buildSha});
      if(path.startsWith('/api/'))return handler(new Request(url,options));
      return new Response(Bun.file(path==='/'?'index.html':path.slice(1)));
    }});
    expect(result.ok).toBe(true);
    expect(result.summary.create.requests).toBe(4);
    expect(result.summary.replay.requests).toBe(4);
    expect(result.samples.every(sample=>sample.ok)).toBe(true);
  } finally {await rm(root,{recursive:true,force:true});}
},15000);

test('local staging requires explicit opt-in and a literal loopback address with port',()=>{
  expect(validateTarget({...config,origin:'http://127.0.0.1:43123',approvedOrigin:'http://127.0.0.1:43123',localStaging:true})).toBe('http://127.0.0.1:43123');
  for(const origin of ['http://127.0.0.1:43123','http://localhost:43123','http://192.168.1.1:43123','http://staging.example.com:43123','http://127.0.0.1']) {
    expect(()=>validateTarget({...config,origin,approvedOrigin:origin,localStaging:origin!=='http://127.0.0.1:43123'})).toThrow();
  }
});

test('HTTP 200 replay must match the requested saved experiment, verification and seeded horizon',async()=>{
  const corruptions=[
    record=>{delete record.identity;},
    record=>{record.identity.experimentId='city_other';},
    record=>{record.identity.scenarioId='other';},
    record=>{record.identity.runIndex=1;},
    record=>{record.identity.runId='baseline-1';},
    record=>{record.verification.status='unavailable';},
    record=>{record.state.version='obsolete';},
    record=>{record.state.seed=46;},
    record=>{record.state.month=1;},
    record=>{record.steps=[];},
  ];
  for(const corrupt of corruptions) {
    let creates=0,replays=0;
    const result=await runLoad(config,{execute:true,fetchImpl:async(url)=>{
      const path=new URL(url).pathname;
      if(path==='/api/ready')return Response.json({status:'ready',buildId:config.buildSha});
      if(path==='/api/city-experiments')return Response.json({id:`city_${++creates}`},{status:202});
      if(path.endsWith('/replay')){replays++;const record=replayRecord(path.split('/')[3]);corrupt(record);return Response.json(record);}
      if(path.startsWith('/api/'))return Response.json({status:'complete'});
      return new Response('ok');
    }});
    expect(result.ok).toBe(false);
    expect(result.summary.replay.errorRate).toBe(1);
    expect(result.summary.replay.overloadResponses).toBe(0);
    expect(creates).toBe(2);expect(replays).toBeLessThanOrEqual(2);
  }
},15000);
