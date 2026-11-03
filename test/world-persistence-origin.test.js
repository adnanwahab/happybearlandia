import {test,expect} from 'bun:test';
import {assertWorldWriteOrigin,createWorldPersistenceHandler} from '../world/experiments/persistence-api.js';
import {encodeCheckpointGraph} from '../world/population/checkpoint.js';
import {POPULATION_VERSION} from '../world/population/contracts.js';
const app='happybearlandia',https='https://happybearlandia.fly.dev',http='http://happybearlandia.fly.dev';
const request=(url=http,headers={})=>new Request(url+'/api/world-experiments',{method:'POST',headers});
const check=(req,trustedFlyAppName=app)=>assertWorldWriteOrigin(req,{trustedFlyAppName});
test('configured Fly app accepts its browser HTTPS origin through the TLS proxy',()=>{
 for(const header of ['x-forwarded-proto','fly-forwarded-proto'])expect(()=>check(request(http,{origin:https,referer:https+'/world/house','sec-fetch-site':'same-origin',[header]:'https'}))).not.toThrow();
 expect(()=>check(request(https,{origin:https}))).not.toThrow();
});
test('forwarded headers cannot grant another host, origin, or local server trust',()=>{
 const cases=[request(http,{origin:'https://evil.example','x-forwarded-proto':'https'}),request('http://evil.example',{origin:https,'x-forwarded-proto':'https','x-forwarded-host':'happybearlandia.fly.dev'}),request('http://localhost:3000',{origin:'https://localhost:3000','x-forwarded-proto':'https'}),request(http,{origin:https,'x-forwarded-proto':'https,http'}),request(http,{origin:https,'x-forwarded-proto':'http'}),request(http,{origin:https}),request(http,{origin:https,'fly-forwarded-proto':'https','x-forwarded-proto':'http'}),request(http+':3000',{origin:https,'x-forwarded-proto':'https'})];
 for(const req of cases)expect(()=>check(req)).toThrow('same origin');
 expect(()=>check(request(http,{origin:https,'x-forwarded-proto':'https'}),'')).toThrow('same origin');
});
test('opaque origins, foreign or malformed referers, and cross-site writes stay blocked',()=>{
 for(const headers of [{origin:'null'},{origin:'https://evil.example'},{referer:'https://evil.example/world'},{referer:'null'},{origin:https,referer:'https://evil.example'},{'sec-fetch-site':'cross-site'}])expect(()=>check(request(http,{'x-forwarded-proto':'https',...headers}))).toThrow('same origin');
});
test('localhost keeps exact protocol, hostname and port checks and native clients remain compatible',()=>{
 const local='http://localhost:3000';
 expect(()=>check(request(local,{origin:local,referer:local+'/world'}),'')).not.toThrow();
 expect(()=>check(request(local), '')).not.toThrow();
 for(const origin of ['http://localhost:3001','http://127.0.0.1:3000','https://localhost:3000','null'])expect(()=>check(request(local,{origin}), '')).toThrow('same origin');
});
test('all persistence write endpoints use the same proxy-aware origin policy',async()=>{
 const handler=createWorldPersistenceHandler({dbPath:':memory:',trustedFlyAppName:app,idFactory:()=> 'FlyOrigin001'}),save={schemaVersion:'world-experiment-save.v1',label:'Proxy origin regression',mode:'living',checkpoint:{schemaVersion:'population-checkpoint.v1',modelVersion:POPULATION_VERSION,encoding:'typed-graph.v1',state:encodeCheckpointGraph({})},view:{origin:{lat:29,lng:-95}},geometry:{area:{buildings:[],roads:[]}}};
 try{
  const response=await handler(new Request(http+'/api/world-experiments',{method:'POST',headers:{origin:https,'x-forwarded-proto':'https','content-type':'application/json'},body:JSON.stringify(save)}));expect(response.status).toBe(201);
  for(const [path,method] of [['/api/world-experiments','POST'],['/api/world-experiments/FlyOrigin001/fork','POST'],['/api/world-experiments/FlyOrigin001/house-session/actual-h0','PUT'],['/api/world-homes/home_00000000000000000000','DELETE'],['/api/world-homes/home_00000000000000000000/restore','POST'],['/api/world-homes/home_00000000000000000000','PATCH']]){
   const evil=await handler(new Request(http+path,{method,headers:{origin:'https://evil.example','x-forwarded-proto':'https'}}));expect(evil.status).toBe(403);
   const same=await handler(new Request(http+path,{method,headers:{origin:https,'x-forwarded-proto':'https','content-type':'application/json'},body:method==='DELETE'?undefined:'{}'}));expect(same.status).not.toBe(403);
  }
 }finally{handler.close();}
});
