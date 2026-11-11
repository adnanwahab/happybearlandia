import {test,expect} from 'bun:test';
// Coordinator source is read-only; override after integration into this checkout.
const source=process.env.HBL_CAPABILITY_AUDIT_SOURCE || '/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia/world/decision/local-capability.js';
const {createLocalCapabilityBoundary}=await import(source);
const make=(base='http://localhost:3193',headers={},method='POST')=>new Request(base+'/api/local-capability',{method,headers:{origin:base,...headers}});
function fixture(){let clock=1700000000000,n=0;const boundary=createLocalCapabilityBoundary({now:()=>clock,secret:Buffer.alloc(32,7),random:()=>(++n).toString(16).padStart(32,'0'),isLocalPeer:r=>r.headers.get('x-test-peer')==='verified'});return {boundary,advance:()=>clock+=86400000,issue:(base='http://localhost:3193')=>boundary.handle(make(base,{'x-test-peer':'verified'}))};}
for(const host of ['localhost','127.0.0.1','[::1]'])test(`verified loopback ${host} issues opaque cookie`,async()=>{
 const f=fixture(),base=`http://${host}:3193`,response=f.issue(base);
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 const cookie=response.headers.get('set-cookie');expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Strict');expect(cookie).toContain('Path=/api');
 expect(await response.json()).toEqual({localOnly:true});
 expect(f.boundary.owner(make(base,{'x-test-peer':'verified',cookie:cookie.split(';')[0],'x-owner-id':'attacker'}))).toBe('00000000000000000000000000000001');
});
test('remote hosts, spoofed forwarding and unverified peers cannot bootstrap',()=>{
 const f=fixture();
 for(const base of ['http://example.com','http://127.0.0.2','http://localhost.evil','http://[::2]'])expect(f.issue(base).status).toBe(403);
 expect(f.boundary.handle(make('http://localhost:3193',{'x-forwarded-for':'127.0.0.1'})).status).toBe(403);
});
test('bootstrap requires exact Origin and rejects cross-site and GET',()=>{
 const f=fixture();for(const headers of [{origin:''},{origin:'http://localhost:3194'},{'sec-fetch-site':'cross-site'}])expect(f.boundary.handle(make(undefined,{'x-test-peer':'verified',...headers})).status).toBe(403);
 expect(f.boundary.handle(make(undefined,{'x-test-peer':'verified'},'GET')).status).toBe(403);
});
test('tampering, expiry and helper recreation revoke ownership',()=>{
 const f=fixture(),cookie=f.issue().headers.get('set-cookie').split(';')[0];
 expect(f.boundary.owner(make(undefined,{'x-test-peer':'verified',cookie:cookie+'tampered'}))).toBeNull();
 expect(createLocalCapabilityBoundary({isLocalPeer:()=>true}).owner(make(undefined,{cookie}))).toBeNull();
 f.advance();expect(f.boundary.owner(make(undefined,{'x-test-peer':'verified',cookie}))).toBeNull();
});
test('signed ownership survives helper recreation with same protected secret',()=>{
 const f=fixture(),cookie=f.issue().headers.get('set-cookie').split(';')[0];
 const restarted=createLocalCapabilityBoundary({secret:Buffer.alloc(32,7),now:()=>1700000000000,isLocalPeer:()=>true});
 expect(restarted.owner(make(undefined,{cookie}))).toBe('00000000000000000000000000000001');
});
test('audit finding: owner lookup accepts missing Origin on POST',()=>{
 const f=fixture(),cookie=f.issue().headers.get('set-cookie').split(';')[0];
 const request=new Request('http://localhost:3193/api/workflows',{method:'POST',headers:{'x-test-peer':'verified',cookie}});
 expect(f.boundary.owner(request)).toBe('00000000000000000000000000000001');
});

import {mkdtempSync,statSync,chmodSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {loadLocalCapabilitySecret}=await import(source);
test('persistent key is private, reloadable and rejects unsafe files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hbl-capability-audit-'));
 try {
  const path=join(dir,'key'),secret=loadLocalCapabilitySecret(path);
  expect(secret.length).toBe(32);expect(statSync(path).mode&0o777).toBe(0o600);
  expect(loadLocalCapabilitySecret(path)).toEqual(secret);
  chmodSync(path,0o644);expect(()=>loadLocalCapabilitySecret(path)).toThrow('permissions');chmodSync(path,0o600);
  writeFileSync(join(dir,'short'),'short',{mode:0o600});expect(()=>loadLocalCapabilitySecret(join(dir,'short'))).toThrow('Invalid');
  symlinkSync(path,join(dir,'link'));expect(()=>loadLocalCapabilitySecret(join(dir,'link'))).toThrow();
  const before=createLocalCapabilityBoundary({secret,isLocalPeer:()=>true});
  const cookie=before.handle(make()).headers.get('set-cookie').split(';')[0];
  const after=createLocalCapabilityBoundary({secret:loadLocalCapabilitySecret(path),isLocalPeer:()=>true});
  expect(after.owner(make(undefined,{cookie}))).toBe(before.owner(make(undefined,{cookie})));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('noncanonical, forged, cross-origin and remote cookie requests reject',()=>{
 const f=fixture(),cookie=f.issue().headers.get('set-cookie').split(';')[0],token=cookie.split('=')[1];
 for(const invalid of [token+'.extra',token.replace('.', '..'),token.toUpperCase(),token+'=',token.replace(/\.\d+\./,'.9999999999999.')])expect(f.boundary.owner(make(undefined,{'x-test-peer':'verified',cookie:'hbl_local_cap='+invalid}))).toBeNull();
 for(const headers of [{origin:'http://evil.invalid'},{'sec-fetch-site':'cross-site'},{'x-test-peer':'unverified'}])expect(f.boundary.owner(make(undefined,{'x-test-peer':'verified',cookie,...headers}))).toBeNull();
 expect(f.boundary.owner(make('http://evil.invalid',{'x-test-peer':'verified',cookie}))).toBeNull();
});
test('audit finding: denied bootstrap omits no-store and nosniff',()=>{
 const response=fixture().boundary.handle(make());
 expect(response.status).toBe(403);expect(response.headers.get('cache-control')).toBeNull();expect(response.headers.get('x-content-type-options')).toBeNull();
});
