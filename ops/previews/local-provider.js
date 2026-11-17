import {spawn} from 'node:child_process';
import {createServer, Agent, request as httpRequest} from 'node:http';
import {Duplex} from 'node:stream';
import {mkdir, rm, stat, readdir} from 'node:fs/promises';
import {platform,totalmem} from 'node:os';
import {readFile} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE=dirname(fileURLToPath(import.meta.url));
export const RUNTIME_IMAGE='oven/bun:1@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d';
const OWNER='hbl-version-preview.v1';
const RELAY=`const s=require('net').connect(3000,'127.0.0.1');process.stdin.pipe(s);s.pipe(process.stdout);s.on('error',()=>process.exit(1));process.stdin.on('end',()=>s.end());`;
const CSP="default-src 'self' data: blob: https://cdn.jsdelivr.net https://unpkg.com https://esm.sh; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://unpkg.com https://esm.sh; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
export function validateLocalJob(job){
 if(!job||job.repository!=='adnanwahab/happybearlandia'||!/^p?[a-f0-9]{16,64}$/.test(job.id)||!/^([a-f0-9]{40})$/.test(job.sha)||!['/','/world'].includes(job.launchPath||'/'))throw new Error('Invalid immutable local preview identity');
 return 'hbl-preview-'+job.id;
}
export function runtimeArguments(job,image=RUNTIME_IMAGE){
 const name=validateLocalJob(job);
 if(!/^[-a-zA-Z0-9./:]+@sha256:[0-9a-f]{64}$/.test(image))throw new Error('Preview runtime must be digest pinned');
 return ['create','--name',name,'--label',`hbl.preview.owner=${OWNER}`,'--label',`hbl.preview.id=${job.id}`,'--label',`hbl.preview.sha=${job.sha}`,'--network','none','--user','1000:1000','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','2g','--cpus','1','--pids-limit','128','--ulimit','nofile=1024:1024','--log-driver','local','--log-opt','max-size=2m','--log-opt','max-file=1','--tmpfs','/app:rw,nosuid,nodev,size=768m,uid=1000,gid=1000','--tmpfs','/payload:rw,nosuid,nodev,noexec,size=768m,uid=1000,gid=1000','--tmpfs','/tmp:rw,nosuid,nodev,size=128m,uid=1000,gid=1000','--workdir','/app','--entrypoint','/bin/sleep',image,'infinity'];
}
export class LocalProvider{
 constructor({stateDir,runtimeImage=RUNTIME_IMAGE,command,sourcePrepare,startupTimeoutMs=180000}={}){
  if(!stateDir)throw new Error('Private preview stateDir required');
  this.stateDir=stateDir;this.runtimeImage=runtimeImage;this.command=command||this.run.bind(this);this.sourcePrepare=sourcePrepare;this.startupTimeoutMs=startupTimeoutMs;this.gateways=new Map();
 }
 async run(args,{timeout=300000}={}){
  return await new Promise((resolve,reject)=>{
   const child=spawn(args[0],args.slice(1),{env:{PATH:process.env.PATH,HOME:process.env.HOME,DOCKER_HOST:process.env.DOCKER_HOST},stdio:['ignore','pipe','pipe']});let output='',error='';
   const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Preview operation timed out; owned resource retained for reconciliation'));},timeout);
   child.stdout.on('data',b=>{if(output.length<65536)output+=b;});child.stderr.on('data',b=>{if(error.length<4096)error+=b;});
   child.on('error',()=>{clearTimeout(timer);reject(new Error('Docker or trusted preview transport unavailable. Install/start Docker Desktop; no host fallback.'));});
   child.on('close',code=>{clearTimeout(timer);code===0?resolve(output.trim()):reject(new Error('Isolated preview operation failed; inspect bounded local runner logs (no host fallback).'));});
  });
 }
 async metadata(job){
  const name=validateLocalJob(job);let list;
  // Listing (rather than failed inspect) distinguishes absence from daemon failure.
  try{list=JSON.parse(await this.command(['docker','container','ls','-a','--filter','name=^/'+name+'$','--format','json']));}catch(error){
   const rows=await this.command(['docker','container','ls','-a','--filter','name=^/'+name+'$','--format','{{json .}}']);
   if(!rows.trim())return null;
   list=JSON.parse(rows.split('\n')[0]);
  }
  if(!list?.ID)return null;
  const rows=JSON.parse(await this.command(['docker','inspect',name]));const value=rows[0];
  if(value.Config?.Labels?.['hbl.preview.owner']!==OWNER||value.Config?.Labels?.['hbl.preview.id']!==job.id||value.Config?.Labels?.['hbl.preview.sha']!==job.sha||value.HostConfig?.NetworkMode!=='none'||value.HostConfig?.Privileged||!value.HostConfig?.ReadonlyRootfs||value.Config?.User!=='1000:1000'||value.Config?.Image!==this.runtimeImage||!value.HostConfig?.CapDrop?.includes('ALL')||!value.HostConfig?.SecurityOpt?.includes('no-new-privileges:true')||value.HostConfig?.Memory!==2*1024**3||value.HostConfig?.PidsLimit!==128||value.Mounts?.some(m=>m.Type==='bind'))throw new Error('Retained resource ownership/isolation mismatch; refusing takeover');
  return value;
 }
 relay(name){
  const child=spawn('docker',['exec','-i',name,'/usr/local/bin/bun','-e',RELAY],{env:{PATH:process.env.PATH,HOME:process.env.HOME,DOCKER_HOST:process.env.DOCKER_HOST},stdio:['pipe','pipe','ignore']});
  const stream=Duplex.from({readable:child.stdout,writable:child.stdin});
  child.on('error',error=>stream.destroy(error));child.on('close',()=>stream.destroy());stream.on('close',()=>child.kill('SIGTERM'));return stream;
 }
 async gateway(job){
  if(this.gateways.has(job.id))return this.gateways.get(job.id);
  const name=validateLocalJob(job),hostname=job.id+'.localhost',sockets=new Set();let connections=0;
  const permitted=req=>req.headers.host===hostname+':'+server.address().port;
  const cleanHeaders=req=>{const h={...req.headers,host:'127.0.0.1:3000'};for(const k of ['authorization','cookie','proxy-authorization','forwarded','x-forwarded-host','x-forwarded-for'])delete h[k];return h;};
  const server=createServer((req,res)=>{
   if(!permitted(req)){res.writeHead(421);res.end('Preview origin mismatch');return;}
   if(req.url==='/__hbl_preview'&&req.method==='GET'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({sha:job.sha,repository:job.repository,recipe:'bun-network-none.v1'}));return;}
   if(++connections>64){connections--;res.writeHead(429);res.end();return;}
   const agent=new Agent({keepAlive:false});agent.createConnection=()=>this.relay(name);
   const upstream=httpRequest({host:'preview.invalid',port:3000,method:req.method,path:req.url,headers:cleanHeaders(req),agent},response=>{
    const headers={...response.headers,'content-security-policy':CSP,'referrer-policy':'no-referrer','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'};
    delete headers['set-cookie'];delete headers['access-control-allow-origin'];
    res.writeHead(response.statusCode,headers);response.pipe(res);
   });
   upstream.setTimeout(30000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Preview backend unavailable');});req.pipe(upstream);res.on('close',()=>{connections--;upstream.destroy();});
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  server.on('upgrade',(req,socket,head)=>{
   if(!permitted(req)||connections>=64||req.headers.origin!==`http://${hostname}:${server.address().port}`){socket.destroy();return;}
   connections++;const relay=this.relay(name);const headers=cleanHeaders(req);relay.write(`${req.method} ${req.url} HTTP/1.1\r\n`+Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(head.length)relay.write(head);socket.pipe(relay).pipe(socket);socket.on('close',()=>{connections--;relay.destroy();});relay.on('error',()=>socket.destroy());
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(job.gatewayPort||0,'127.0.0.1',resolve);});
  const result={server,sockets,url:`http://${hostname}:${server.address().port}`,port:server.address().port};this.gateways.set(job.id,result);return result;
 }
 async inspect(job){
  const meta=await this.metadata(job);if(!meta)return{ready:false,missing:true};
  const result={resourceId:meta.Id,ready:false};if(!meta.State.Running)return result;
  let revision;try{revision=JSON.parse(await this.command(['docker','exec',validateLocalJob(job),'/bin/cat','/app/.preview-revision.json']));}catch{return result;}if(revision.sha!==job.sha||revision.repository!==job.repository||revision.recipe!=='bun-network-none.v1')throw new Error('Guest revision proof mismatch');
  const gateway=await this.gateway(job);const paths=['/api/ready',job.launchPath||'/'];
  for(const path of paths){
   try{const response=await fetch(`http://127.0.0.1:${gateway.port}${path}`,{headers:{host:job.id+'.localhost:'+gateway.port},signal:AbortSignal.timeout(10000),redirect:'manual'});if(response.status!==200)return result;const value=await response.text();if(path==='/api/ready'){let status;try{status=JSON.parse(value);}catch{return result;}if(status.status!=='ready'||status.buildId!==job.sha)return result;}else if(!/<(?:html|!doctype)/i.test(value))return result;}catch{return result;}
  }
  return {...result,ready:true,url:gateway.url+(job.launchPath||'/'),gatewayPort:gateway.port,sha:job.sha};
 }
 async reconcile(job){return this.inspect(job);}
 async hostAdmission(){
  const output=await this.command(['/bin/df','-Pk',this.stateDir]);const row=output.trim().split('\n').at(-1).trim().split(/\s+/);if(Number(row[3])*1024<3*1024**3)throw new Error('Preview held: at least3GiB host disk required');
  if(platform()==='darwin'){
   const pressure=await this.command(['/usr/sbin/sysctl','-n','kern.memorystatus_vm_pressure_level']);const memory=await this.command(['/usr/bin/memory_pressure','-Q']);const percent=memory.match(/System-wide memory free percentage:\s*([0-9]+)%/);
   if(pressure.trim()!=='1'||!percent||totalmem()*Number(percent[1])/100<2*1024**3)throw new Error('Preview held: normal macOS pressure and at least2GiB estimated headroom required');
  }else if(platform()==='linux'){const text=await readFile('/proc/meminfo','utf8');const available=text.match(/^MemAvailable:\s*(\d+) kB/m);if(!available||Number(available[1])*1024<2*1024**3)throw new Error('Preview held: at least2GiB available host RAM required');}else throw new Error('Preview host resource policy unavailable');
 }
 async cacheBudget(){
  let bytes=0;for(const entry of await readdir(this.stateDir,{withFileTypes:true})){if(entry.isDirectory()&&/^[a-f0-9]{32}$/.test(entry.name)){try{bytes+=(await stat(join(this.stateDir,entry.name,'bundle.tar'))).size;}catch(e){if(e.code!=='ENOENT')throw e;}}}if(bytes>1024**3)throw new Error('Preview cache budget1GiB exceeded; clean owned expired previews');
 }
 async start(job){
  await mkdir(this.stateDir,{recursive:true,mode:0o700});
  const name=validateLocalJob(job);let meta=await this.metadata(job);
  if(!meta){
   await this.hostAdmission();await this.cacheBudget();
   await this.command(['docker','image','inspect',this.runtimeImage]).catch(()=>this.command(['docker','pull',this.runtimeImage]));
   const directory=join(this.stateDir,job.id);await mkdir(directory,{recursive:true,mode:0o700});const bundle=join(directory,'bundle.tar');
   if(this.sourcePrepare)await this.sourcePrepare(job,bundle);else await this.command(['/usr/bin/python3',join(HERE,'source.py'),job.sha,bundle],{timeout:600000});
   await this.cacheBudget();if((await stat(bundle)).size>800*1024*1024)throw new Error('Preview source cache budget exceeded');
   await this.command(['docker',...runtimeArguments(job,this.runtimeImage)]);await this.command(['docker','start',name]);
   await this.command(['docker','cp',bundle,name+':/payload/bundle.tar']);await this.command(['docker','cp',join(HERE,'guest-entry.js'),name+':/payload/guest-entry.js']);
   await this.command(['docker','exec','-d','-e','HBL_BUILD_ID='+job.sha,name,'/usr/local/bin/bun','/payload/guest-entry.js']);
   await rm(bundle,{force:true});
  }else {
   if(!meta.State.Running){if(meta.State.Status==='created')await this.command(['docker','start',name]);else throw new Error('Retained preview stopped; explicit retry/cleanup required');}
   // Interrupted transfer/start resumes in the same owned container. The trusted
   // entry's exclusive /tmp lock ensures at most one selected-server launch.
   const bundle=join(this.stateDir,job.id,'bundle.tar');
   try{await stat(bundle);await this.command(['docker','cp',bundle,name+':/payload/bundle.tar']);await this.command(['docker','cp',join(HERE,'guest-entry.js'),name+':/payload/guest-entry.js']);await this.command(['docker','exec','-d','-e','HBL_BUILD_ID='+job.sha,name,'/usr/local/bin/bun','/payload/guest-entry.js']);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const until=Date.now()+this.startupTimeoutMs;
  while(Date.now()<until){const value=await this.inspect(job);if(value.ready)return value;await new Promise(r=>setTimeout(r,1000));}
  throw new Error('Preview startup/readiness timed out; owned resource retained for explicit recovery');
 }
 async stop(job){const meta=await this.metadata(job);if(meta)await this.command(['docker','rm','-f',validateLocalJob(job)]);const g=this.gateways.get(job.id);if(g){for(const socket of g.sockets||[])socket.destroy();g.server.closeAllConnections();g.server.close();this.gateways.delete(job.id);}await rm(join(this.stateDir,job.id),{recursive:true,force:true});return{stopped:true};}
 close(){for(const g of this.gateways.values()){for(const socket of g.sockets||[])socket.destroy();g.server.closeAllConnections();g.server.close();}this.gateways.clear();}
}
