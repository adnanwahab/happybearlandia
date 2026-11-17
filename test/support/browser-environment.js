import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const allocatedPorts=new Set();
const ownedEnvironments=new Set();
export const BROWSER_CONTEXT_ENV='HBL_BROWSER_TEST_ENVIRONMENTS';
const allocateScript=`
const net=require('node:net');
const input=JSON.parse(process.argv[1]);let attempts=0;
function allocate(){
 const server=net.createServer();
 server.once('error',error=>{console.error(error.code||error.message);process.exitCode=1;});
 server.listen({host:'127.0.0.1',port:input.port,exclusive:true},()=>{
  const port=server.address().port;
  server.close(()=>{if(input.exclude.includes(port)&&!input.port){if(++attempts<16)return allocate();console.error('Could not allocate a distinct loopback port');process.exitCode=1;return;}process.stdout.write(String(port));});
 });
}
allocate();`;

export function validateBrowserPort(value,label='Browser test port'){
 if(value===undefined)return 0;
 if(typeof value!=='string'||!/^\d+$/.test(value)||Number(value)>65535)throw new Error(`${label} must be an integer between 0 and 65535 (0 allocates a port).`);
 return Number(value);
}

/** OS allocation, never a guessed random range or bind-all listener.
 * Playwright needs the URL before spawning its webServer. The probe must close
 * before that child binds; a competing process in this small handoff window
 * causes startup to fail, never reuse an unrelated app. */
export function allocateBrowserPort(value,{label='Browser test port',exclude=[]}={}){
 const requested=validateBrowserPort(value,label);
 if(requested&&exclude.map(Number).includes(requested))throw new Error(`${label} duplicates another server port (${requested}).`);
 const result=spawnSync(process.execPath,['-e',allocateScript,JSON.stringify({port:requested,exclude:exclude.map(Number)})],{encoding:'utf8',timeout:10000});
 if(result.error||result.status!==0||!/^\d+$/.test(result.stdout||''))throw new Error(`${label} could not bind to 127.0.0.1${requested?':'+requested:''}: ${result.error?.message||(result.stderr||'allocation failed').trim()}`);
 const port=String(Number(result.stdout));allocatedPorts.add(Number(port));return port;
}

function environmentPaths(port,store){return{PORT:port,HBL_BIND_HOST:'127.0.0.1',
 HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),
 HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),HBL_JOURNAL_ROOT:join(store,'journals'),
 DECISION_STORE_DIR:join(store,'decision'),HBL_DETECTIVE_ROOT:join(store,'detective'),
 HBL_PATCH_VOTE_DB_PATH:join(store,'patch-votes.sqlite'),HBL_TEMPORAL_DB_PATH:join(store,'history.sqlite'),HBL_PLAYER_FEEDBACK_DIR:join(store,'player-feedback')};}

/** All paths belong to this invocation, never the developer's saved worlds.
 * Playwright reloads configs in workers. globalSetup explicitly passes the
 * main process descriptors to them; imports never change process.env. */
export function createBrowserEnvironment({name,portEnv='HBL_PLAYWRIGHT_PORT',env=process.env}={}){
 if(typeof name!=='string'||!/^[-a-z0-9]+$/i.test(name))throw new Error('Browser environment needs a simple suite name.');
 if(env.TEST_WORKER_INDEX!==undefined&&env[BROWSER_CONTEXT_ENV]){
  const context=JSON.parse(env[BROWSER_CONTEXT_ENV]);
  const descriptor=context?.environments?.find(item=>item.name===name&&item.portEnv===portEnv);
  if(context.version!==1||!descriptor)throw new Error(`Browser worker environment was not configured for ${name}.`);
  validateBrowserPort(descriptor.port,portEnv);
  return{...descriptor,baseURL:`http://127.0.0.1:${descriptor.port}`,serverEnv:environmentPaths(descriptor.port,descriptor.store),descriptor,dispose(){}};
 }
 const port=allocateBrowserPort(env[portEnv],{label:portEnv,exclude:[...allocatedPorts]});
 const store=mkdtempSync(join(tmpdir(),`hbl-browser-${name}-`));
 const descriptor={name,portEnv,port,store};
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;allocatedPorts.delete(Number(port));ownedEnvironments.delete(dispose);process.removeListener('exit',dispose);rmSync(store,{recursive:true,force:true});};
 ownedEnvironments.add(dispose);process.once('exit',dispose);
 return{port,baseURL:`http://127.0.0.1:${port}`,store,serverEnv:environmentPaths(port,store),descriptor,dispose};
}

export function disposeBrowserEnvironments(){for(const dispose of [...ownedEnvironments])dispose();}
