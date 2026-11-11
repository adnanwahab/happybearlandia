import {test,expect} from 'bun:test';
import {createLocalCapabilityBoundary} from '../world/decision/local-capability.js';
test('local capability requires peer, origin, and server-issued cookie',()=>{
 const make=(url='http://localhost:3000/api/local-capability',headers={})=>new Request(url,{method:'POST',headers:{origin:'http://localhost:3000',...headers}});
 const denied=createLocalCapabilityBoundary();expect(denied.handle(make()).status).toBe(403);
 const auth=createLocalCapabilityBoundary({isLocalPeer:()=>true});expect(auth.handle(make(undefined,{origin:'https://evil.test'})).status).toBe(403);
 const response=auth.handle(make());expect(response.status).toBe(200);const cookie=response.headers.get('set-cookie').split(';')[0];expect(auth.owner(make(undefined,{cookie}))).toBeTruthy();expect(auth.owner(make(undefined,{cookie:'hbl_local_cap=invented'}))).toBeNull();expect(auth.owner(make('http://example.test/api/local-capability',{cookie}))).toBeNull();
});
test('protected persisted key preserves capability owner on restart',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');const {loadLocalCapabilitySecret}=await import('../world/decision/local-capability.js');
 const dir=await mkdtemp(join(tmpdir(),'local-cap-'));try{const path=join(dir,'key');const first=createLocalCapabilityBoundary({secret:loadLocalCapabilitySecret(path),isLocalPeer:()=>true});const request=new Request('http://localhost/api/local-capability',{method:'POST',headers:{origin:'http://localhost'}});const cookie=first.handle(request).headers.get('set-cookie').split(';')[0];const withCookie=new Request(request,{headers:{origin:'http://localhost',cookie}});const second=createLocalCapabilityBoundary({secret:loadLocalCapabilitySecret(path),isLocalPeer:()=>true});expect(second.owner(withCookie)).toBe(first.owner(withCookie));expect(second.owner(withCookie)).toBeTruthy();}finally{await rm(dir,{recursive:true,force:true});}
});
