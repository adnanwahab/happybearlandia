// Optional trusted local metadata transport, using the operator's existing gh login.
// No token extraction and no command or repository supplied by browser input.
import {spawn} from 'node:child_process';
export async function ghRead(url,options={}) {
 const parsed=new URL(url);
 if(parsed.origin!=='https://api.github.com'||!parsed.pathname.startsWith('/repos/adnanwahab/happybearlandia/pulls'))throw Error('Unsupported metadata endpoint');
 const args=['api',parsed.pathname+parsed.search,'--method','GET','--include'];
 for(const key of ['Accept','X-GitHub-Api-Version','If-None-Match'])if(options.headers?.[key])args.push('--header',key+': '+options.headers[key]);
 return new Promise((resolve,reject)=>{
  const child=spawn('gh',args,{env:{PATH:process.env.PATH,HOME:process.env.HOME},stdio:['ignore','pipe','pipe']});let output='';let stopped=false;
  const fail=()=>{if(stopped)return;stopped=true;clearTimeout(timer);child.kill('SIGTERM');reject(Error('Authenticated GitHub metadata transport unavailable'));};
  const timer=setTimeout(fail,10000);child.stderr.on('data',()=>{});child.on('error',fail);child.stdout.on('data',b=>{output+=b;if(output.length>4*1024*1024)fail();});
  child.on('close',()=>{if(stopped)return;stopped=true;clearTimeout(timer);try{const separator=output.search(/\r?\n\r?\n/);if(separator<0)throw Error();const head=output.slice(0,separator).split(/\r?\n/),status=Number(head.shift().split(' ')[1]),headers=new Headers();for(const line of head){const i=line.indexOf(':');if(i>0)headers.append(line.slice(0,i),line.slice(i+1).trim());}const body=output.slice(separator).replace(/^\r?\n\r?\n/,'');resolve(new Response([204,304].includes(status)?null:body,{status,headers}));}catch{reject(Error('Invalid GitHub metadata transport response'));}});
 });
}
