import {test,expect} from 'bun:test';
import {createWatchPartyService,presentation} from '../world/future-machine/watch-party.js';
const view={month:16,landing:{version:1,mode:'plan',ghosts:false,camera:{x:0,z:0,zoom:1}}};
const digest='a'.repeat(64);
function client(service){return async(path,method='GET',body,capability)=>service.fetch(new Request('http://localhost/api/future-watch/'+path,{method,headers:{...(capability?{Authorization:'Bearer '+capability}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));}
test('presentation accepts only bounded display state and detached camera',()=>{
 const output=presentation(view);output.landing.camera.x=3;expect(view.landing.camera.x).toBe(0);
 for(const invalid of [{...view,month:-1},{...view,month:121},{...view,month:1.5},{...view,seed:1},{...view,landing:{...view.landing,camera:{x:0,z:0,zoom:100}}}])expect(()=>presentation(invalid)).toThrow();
});
test('disabled, missing, cross-origin and malformed requests fail explicitly',async()=>{
 expect((await client(createWatchPartyService())('rooms','POST',{receipt:digest,view})).status).toBe(503);
 const service=createWatchPartyService({enabled:true}),call=client(service);
 expect((await call('state')).status).toBe(404);
 expect((await call('rooms','POST',{receipt:'invalid',view})).status).toBe(400);
 expect((await call('rooms','POST',{receipt:digest,view,seed:1})).status).toBe(400);
 expect((await service.fetch(new Request('http://localhost/api/future-watch/rooms',{method:'POST',headers:{Origin:'https://evil.test'}}))).status).toBe(403);
 expect((await service.fetch(new Request('http://localhost/api/future-watch/rooms',{method:'POST',body:'x'.repeat(4097)}))).status).toBe(400);
});
test('private two-person snapshots reconnect without model state, host authority and expiry',async()=>{
 let time=0;const call=client(createWatchPartyService({enabled:true,now:()=>time,ttl:1000,maxRooms:1}));
 const created=await call('rooms','POST',{receipt:digest,view});expect(created.status).toBe(201);const {invite,host}=await created.json();expect(invite).not.toBe(host);
 expect((await call('rooms','POST',{receipt:digest,view})).status).toBe(503);
 const initial=await (await call('state','GET',null,invite)).json();expect(initial.receipt).toBe(digest);expect(initial.view).toEqual(view);expect(initial.host).toBeUndefined();
 expect((await call('state','POST',{...view,month:120},invite)).status).toBe(403);
 expect((await call('state','POST',{...view,month:120},host)).status).toBe(200);
 expect((await call('state','POST',view,host)).status).toBe(429);
 // A disconnected viewer reads the latest snapshot, never a delta or engine command.
 const recovered=await (await call('state','GET',null,invite)).json();expect(recovered.view.month).toBe(120);expect(recovered.revision).toBe(1);
 time=100;expect((await call('state','POST',{reaction:'wow'},invite)).status).toBe(200);
 expect((await (await call('state','GET',null,host)).json()).reactions).toEqual([{kind:'wow',at:100}]);
 time=200;expect((await call('state','POST',{reaction:'arbitrary text'},invite)).status).toBe(403);
 expect((await call('state','DELETE',null,invite)).status).toBe(405);
 time=1000;expect((await call('state','GET',null,host)).status).toBe(404);
 expect((await call('state','GET',null,invite)).status).toBe(404);
});
test('host ends the invitation and future reads cannot reopen it',async()=>{
 const call=client(createWatchPartyService({enabled:true}));const {host,invite}=await (await call('rooms','POST',{receipt:digest,view})).json();
 expect((await call('state','DELETE',null,host)).status).toBe(200);expect((await call('state','GET',null,invite)).status).toBe(404);
});
