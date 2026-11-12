import {fstatSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {PreviewStore} from './store.js';
import {GitHubMetadata} from './github.js';
import {createRunnerHandler} from './api.js';
export class PreviewRunner {
  constructor({store,provider,now=Date.now,owner=randomUUID(),startupMs=15*60000,idleMs=20*60000,lifetimeMs=60*60000}={}) {Object.assign(this,{store,provider,now,owner,startupMs,idleMs,lifetimeMs});this.busy=false;}
  async tick() {
    if(this.busy||!this.store.lock(this.owner))return;this.busy=true;
    const heartbeat=setInterval(()=>this.store.lock(this.owner),5000);
    try {
      for(let job of this.store.all()) {
        if(job.state==='expired')continue;
        if(job.cleanupPending){try{await this.provider.stop(job);this.store.update(job,{cleanupPending:false});}catch{}continue;}
        const expired=job.stopRequested||this.now()-job.createdAt>this.lifetimeMs||job.state==='ready'&&this.now()-job.lastUsedAt>this.idleMs;
        if(expired) {await this.provider.stop(job);this.store.update(job,{state:'expired',url:null,error:null});continue;}
        if(job.state==='ready') {
          const status=await this.provider.inspect(job);
          if(!status.ready)this.store.update(job,{state:'failed',url:null,error:'Preview stopped or readiness was lost. Explicit retry required.'});
          continue;
        }
        if(['failed','unavailable'].includes(job.state))continue;
        if(job.state!=='queued'&&this.now()-(job.preparationStartedAt||job.updatedAt)>this.startupMs){await this.provider.stop(job);this.store.update(job,{state:'failed',error:'Preparation timed out. Explicit retry required.'});continue;}
        if(this.store.all().filter(j=>j.state==='ready'||j.cleanupPending).length>=this.store.maxActive)continue;
        try {
          job=this.store.update(job,{state:'starting',attempt:job.attempt+1,preparationStartedAt:job.preparationStartedAt||this.now()});
          const result=await this.provider.start(job);
          job=this.store.update(job,{...result,state:'starting'});
          const status=await this.provider.inspect(job);
          if(status.ready)this.store.update(job,{...status,state:'ready',lastUsedAt:this.now(),error:null});
        } catch {
          let cleanupPending=false;try{await this.provider.stop(job);}catch{cleanupPending=true;}
          this.store.update(job,{cleanupPending,state:'failed',url:null,error:'Isolated preparation failed. Check Docker/runtime availability, source limits and trusted runner diagnostics; explicit retry required.'});
        }
        break; // one preparation per tick, never unbounded parallel builds
      }
    } finally{clearInterval(heartbeat);this.busy=false;}
  }
}
if(import.meta.main) {
  const lockFD=Number(process.env.HBL_PREVIEW_LOCK_FD);
  if(!Number.isInteger(lockFD)||lockFD<3)throw new Error('Start via python3 ops/previews/run-host.py to hold the single-host process lock');
  fstatSync(lockFD); // inherited descriptor remains open for the runner lifetime
  const stateDir=process.env.HBL_PREVIEW_STATE_DIR;
  const token=process.env.HBL_PREVIEW_RUNNER_TOKEN;
  if(!stateDir||!token||token.length<32)throw new Error('Configure an absolute private HBL_PREVIEW_STATE_DIR and >=32-character runner token');
  if(resolve(stateDir)!==stateDir)throw new Error('State directory must be absolute');
  const store=new PreviewStore(join(stateDir,'jobs.sqlite'));
  const directoryInfo=(await import('node:fs')).statSync(stateDir);if((directoryInfo.mode&0o777)!==0o700)throw new Error('Private state directory must be mode0700');
  const providerName=process.env.HBL_PREVIEW_PROVIDER||'local';
  let provider;
  if(providerName==='local'){const {LocalProvider}=await import('./local-provider.js');provider=new LocalProvider({stateDir});}
  else if(providerName==='fly'){const {FlyProvider}=await import('./fly-provider.js');const path=join(stateDir,'fly-config.json');const info=(await import('node:fs')).lstatSync(path);if(info.isSymbolicLink()||(info.mode&0o077))throw new Error('Fly configuration must be a private mode0600 regular file');provider=new FlyProvider({config:{...JSON.parse(await Bun.file(path).text()),stateDir}});}
  else throw new Error('Unsupported preview provider');
  const runner=new PreviewRunner({store,provider});
  const server=Bun.serve({hostname:'127.0.0.1',port:Number(process.env.HBL_PREVIEW_RUNNER_PORT||4399),fetch:createRunnerHandler({store,metadata:new GitHubMetadata(),token})});
  console.log(`Trusted preview runner listening on ${server.url.origin}; no guest credentials or production mounts`);
  let ending=false;
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{ending=true;server.stop();});
  while(!ending){try{await runner.tick();}catch{console.warn('Preview reconciliation held; owned jobs/resources retained for next retry.');}await Bun.sleep(2000);}
}
