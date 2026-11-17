/** Own one OS-assigned loopback server and disposable stores for temporal checks. */
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,createWriteStream,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const artifacts=resolve(process.env.HBL_TEMPORAL_ARTIFACT_DIR||join(root,'test-results/temporal-recovery'));
const store=mkdtempSync(join(tmpdir(),'hbl-temporal-recovery-'));
mkdirSync(artifacts,{recursive:true});
const log=createWriteStream(join(artifacts,'server.log'));
const server=spawn(process.env.HBL_BUN_EXECUTABLE||'bun',['--no-env-file','server.js'],{
 cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:'0',HBL_BIND_HOST:'127.0.0.1',
  HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),
  HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),HBL_TEMPORAL_DB_PATH:join(store,'history.sqlite'),
  DECISION_STORE_DIR:join(store,'decision'),HBL_JOURNAL_ROOT:join(store,'journals'),
  HBL_DETECTIVE_ROOT:join(store,'detective'),HBL_PATCH_VOTE_DB_PATH:join(store,'patch-votes.sqlite'),
  HBL_PLAYER_FEEDBACK_DIR:join(store,'feedback'),
 },
});
server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});
const serverExit=new Promise(resolve=>server.once('exit',resolve));
let runner=null,runnerExited=false,cleaning=null;
async function cleanup(){
 if(cleaning)return cleaning;
 cleaning=(async()=>{
  if(runner&&!runnerExited&&runner.exitCode===null&&runner.signalCode===null){runner.kill('SIGTERM');await new Promise(resolve=>runner.once('exit',resolve));}
  if(server.exitCode===null&&server.signalCode===null){server.kill('SIGTERM');const killed=setTimeout(()=>server.kill('SIGKILL'),3000);await serverExit;clearTimeout(killed);}
  await new Promise(resolve=>log.end(resolve));rmSync(store,{recursive:true,force:true});
 })();return cleaning;
}
for(const [signal,code]of [['SIGINT',130],['SIGTERM',143]])process.once(signal,()=>{void cleanup().finally(()=>process.exit(code));});
try{
 const port=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(Error('Temporal server did not announce its OS-assigned port; inspect server.log.')),15000);
  server.once('error',error=>{clearTimeout(timer);reject(error);});server.once('exit',()=>{clearTimeout(timer);reject(Error('Temporal server exited before readiness; inspect server.log.'));});
  server.stdout.on('data',chunk=>{output=(output+chunk).slice(-65536);const match=output.match(/HappyBearLandia running at http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
 });
 const baseURL=`http://127.0.0.1:${port}`;
 const response=await fetch(baseURL+'/api/health',{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error(`Temporal server health failed (HTTP ${response.status}); inspect server.log.`);
 writeFileSync(join(artifacts,'run.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baseURL,store,publicHistoricalSourceTested:false},null,2));
 runner=spawn('node',[join(root,'node_modules/@playwright/test/cli.js'),'test','--config',join(root,'test/temporal-recovery.browser.config.js'),...process.argv.slice(2)],{
  cwd:root,stdio:'inherit',env:{...process.env,HBL_TEMPORAL_VERIFY_URL:baseURL,HBL_TEMPORAL_ARTIFACT_DIR:artifacts},
 });
 process.exitCode=await new Promise((resolve,reject)=>{runner.once('error',reject);runner.once('exit',code=>{runnerExited=true;resolve(code??1);});});
}finally{await cleanup();}
