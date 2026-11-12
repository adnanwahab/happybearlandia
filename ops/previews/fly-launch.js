// Trusted supervisor: bind the separate-UID ingress before selected code starts.
const options={stdout:'inherit',stderr:'inherit'};
const proxy=Bun.spawn(['setpriv','--clear-groups','--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--no-new-privs','/usr/local/bin/bun','/opt/hbl-preview-proxy.js'],options);
let listening=false;
for(let n=0;n<50;n++){
 if(proxy.exitCode!==null)break;
 try{const response=await fetch('http://127.0.0.1:3000/__hbl_gateway',{signal:AbortSignal.timeout(500)});if(response.ok){listening=true;break;}}catch{}
 await Bun.sleep(100);
}
if(!listening){proxy.kill();process.exit(1);}
const app=Bun.spawn(['setpriv','--reuid=1000','--regid=1000','--clear-groups','--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--no-new-privs','/usr/local/bin/bun','/app/server.js'],{...options,cwd:'/app',env:{...process.env,PORT:'3001'}});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{app.kill();proxy.kill();});
await Promise.race([proxy.exited,app.exited]);app.kill();proxy.kill();process.exit(1);
