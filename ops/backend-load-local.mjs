// Disposable full application entry point. No inherited secrets or .env files.
import {mkdtemp, readdir, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runLoad} from './backend-load-test.mjs';
const source=resolve(import.meta.dir,'..');
const root=await mkdtemp(join(tmpdir(),'hbl-local-staging-'));
const sha= (await new Response(Bun.spawn(['git','rev-parse','HEAD'],{cwd:source,stdout:'pipe'}).stdout).text()).trim();
let child;
try {
  // Relative application files resolve normally; default hidden stores stay disposable.
  for(const name of await readdir(source))if(!name.startsWith('.'))await symlink(join(source,name),join(root,name));
  child=Bun.spawn([process.execPath,'--no-env-file',join(source,'server.js')],{
    cwd:root,env:{PATH:process.env.PATH,PORT:'0',HBL_BIND_HOST:'127.0.0.1',HBL_BUILD_ID:sha,
      HBL_WORLD_DB_PATH:join(root,'.stores/world.sqlite'),HBL_CITY_DATA_DIR:join(root,'.stores/city'),
      HBL_REALITY_SHARE_DB_PATH:join(root,'.stores/shares.sqlite'),HBL_JOURNAL_ROOT:join(root,'.stores/journals'),
      DECISION_STORE_DIR:join(root,'.stores/decision')},stdout:'pipe',stderr:'inherit'});
  const deadline=AbortSignal.timeout(20000);
  const reader=child.stdout.getReader();let output='',origin;
  while(!origin){
    const part=await Promise.race([reader.read(),new Promise((_,reject)=>deadline.addEventListener('abort',()=>reject(Error('Server startup timeout')),{once:true}))]);
    if(part.done)throw Error('Server exited before listening');
    output+=new TextDecoder().decode(part.value);
    const match=output.match(/running at http:\/\/localhost:(\d+)/);
    if(match)origin=`http://127.0.0.1:${match[1]}`;
  }
  const result=await runLoad({origin,approvedOrigin:origin,localStaging:true,environment:'staging',app:'disposable-loopback',buildSha:sha,disposableData:true,concurrencyPrerequisite:'SHE-42 verified'},{execute:true});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
} finally {
  if(child){child.kill();await child.exited;}
  await rm(root,{recursive:true,force:true});
}
