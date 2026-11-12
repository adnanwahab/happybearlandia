import {test,expect} from 'bun:test';
import {LocalProvider,runtimeArguments,validateLocalJob,RUNTIME_IMAGE} from '../ops/previews/local-provider.js';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const job={id:'0123456789abcdef',sha:'a'.repeat(40),repository:'adnanwahab/happybearlandia',launchPath:'/'};
test('exact job, pinned runtime and network-none resource boundaries',()=>{
 const args=runtimeArguments(job);expect(args).toContain('none');expect(args).toContain('--read-only');expect(args).toContain('ALL');expect(args).toContain('1000:1000');expect(args).toContain(RUNTIME_IMAGE);expect(args).not.toContain('--privileged');expect(args).not.toContain('-v');expect(args).not.toContain('-p');expect(args).not.toContain('--env-file');
 for(const value of [{...job,sha:'main'},{...job,id:'../../main'},{...job,repository:'evil/repo'},{...job,launchPath:'http://localhost'}])expect(()=>validateLocalJob(value)).toThrow();
 expect(()=>runtimeArguments(job,'oven/bun:latest')).toThrow();
});
test('metadata absence is not ready and never provisions on GET/reconcile',async()=>{
 const calls=[];const provider=new LocalProvider({stateDir:'/tmp/test-only',command:async args=>{calls.push(args);return '';}});
 expect(await provider.reconcile(job)).toEqual({ready:false,missing:true});expect(calls.every(a=>a.includes('ls'))).toBe(true);
});
test('unknown retained ownership fails closed without taking over',async()=>{
 const provider=new LocalProvider({stateDir:'/tmp/test-only',command:async args=>args.includes('ls')?JSON.stringify({ID:'foreign'}):JSON.stringify([{Config:{Labels:{}},HostConfig:{NetworkMode:'none'}}])});
 expect(provider.inspect(job)).rejects.toThrow('ownership');
});
test('archive transport rejects traversal, links and duplicate members',async()=>{
 const program=`import importlib.util,io,tarfile\nspec=importlib.util.spec_from_file_location('source','ops/previews/source.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)\nfor kind in ['traversal','symlink','hardlink','duplicate']:\n b=io.BytesIO()\n with tarfile.open(fileobj=b,mode='w:gz') as t:\n  i=tarfile.TarInfo('prefix/../../escape' if kind=='traversal' else 'prefix/file');i.size=1\n  if kind=='symlink':i.type=tarfile.SYMTYPE;i.linkname='/etc/passwd'\n  if kind=='hardlink':i.type=tarfile.LNKTYPE;i.linkname='/etc/passwd'\n  t.addfile(i,io.BytesIO(b'x') if i.isfile() else None)\n  if kind=='duplicate':t.addfile(i,io.BytesIO(b'x'))\n try:s.safe_members(b.getvalue());raise AssertionError(kind)\n except s.Invalid:pass\nprint('archive safety passed')`;
 const r=spawnSync('/usr/bin/python3',['-c',program],{cwd:import.meta.dir+'/..',encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});expect(r.status).toBe(0);expect(r.stdout).toContain('archive safety passed');
});
test('JSONC trailing commas parser does not evaluate input',()=>{
 const program=`import importlib.util\np=importlib.util.spec_from_file_location('s','ops/previews/source.py');s=importlib.util.module_from_spec(p);p.loader.exec_module(s)\nassert s.jsonc('{"value":",}","arr":[1,],}')=={'value':',}','arr':[1]}\ntry:s.jsonc('__import__("os").system("false")');raise AssertionError()\nexcept ValueError:pass`;
 const r=spawnSync('/usr/bin/python3',['-c',program],{cwd:import.meta.dir+'/..',encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});expect(r.status).toBe(0);
});
test('gateway enforces unique origin, strips credentials and proxies application HTML',async()=>{
 const {createServer}=await import('node:http');const {connect}=await import('node:net');let seen;
 const upstream=createServer((req,res)=>{seen=req.headers;res.writeHead(200,{'content-type':'text/html','set-cookie':'token=guest; Domain=localhost'});res.end('<!doctype html><title>Selected app</title>');});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const provider=new LocalProvider({stateDir:'/tmp/test-only'});provider.relay=()=>connect(upstream.address().port,'127.0.0.1');
 try{const gate=await provider.gateway(job);const wrong=await fetch('http://127.0.0.1:'+gate.port);expect(wrong.status).toBe(421);
 const good=await fetch('http://127.0.0.1:'+gate.port,{headers:{Host:job.id+'.localhost:'+gate.port,Authorization:'Bearer do-not-forward',Cookie:'host=private'}});expect(good.status).toBe(200);expect(await good.text()).toContain('Selected app');expect(good.headers.get('set-cookie')).toBeNull();expect(good.headers.get('content-security-policy')).toContain("connect-src 'self'");expect(seen.authorization).toBeUndefined();expect(seen.cookie).toBeUndefined();
 }finally{provider.close();upstream.closeAllConnections();upstream.close();}
});
test('revision readiness cannot be satisfied by a different guest SHA',async()=>{
 const metadata={Id:'fixture',Config:{Labels:{'hbl.preview.owner':'hbl-version-preview.v1','hbl.preview.id':job.id,'hbl.preview.sha':job.sha},User:'1000:1000',Image:RUNTIME_IMAGE},HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,CapDrop:['ALL'],SecurityOpt:['no-new-privileges:true'],Memory:2*1024**3,PidsLimit:128},State:{Running:true},Mounts:[]};
 const provider=new LocalProvider({stateDir:'/tmp/test-only',command:async args=>args.includes('ls')?JSON.stringify({ID:'fixture'}):args.includes('inspect')?JSON.stringify([metadata]):JSON.stringify({sha:'b'.repeat(40),repository:job.repository,recipe:'bun-network-none.v1'})});
 expect(provider.inspect(job)).rejects.toThrow('revision proof mismatch');
});
