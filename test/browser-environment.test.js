import {test,expect} from 'bun:test';
import {createServer} from 'node:net';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createBrowserEnvironment,allocateBrowserPort,validateBrowserPort,BROWSER_CONTEXT_ENV} from './support/browser-environment.js';

test('port overrides reject malformed or out-of-range values before allocation',()=>{
 for(const value of ['', ' ', '-1', '65536', '3.5', '12oops', '1e4', 3000])expect(()=>validateBrowserPort(value,'HBL_TEST_PORT')).toThrow('HBL_TEST_PORT');
 expect(validateBrowserPort(undefined)).toBe(0);expect(validateBrowserPort('0')).toBe(0);expect(validateBrowserPort('65535')).toBe(65535);
});
test('OS allocated environments have separate ports and stores without changing parent env',()=>{
 const before={...process.env};const a=createBrowserEnvironment({name:'one',env:{}}),b=createBrowserEnvironment({name:'two',env:{}});
 try{expect(a.port).not.toBe(b.port);expect(a.store).not.toBe(b.store);expect(a.baseURL).toBe(`http://127.0.0.1:${a.port}`);expect(a.serverEnv.HBL_BIND_HOST).toBe('127.0.0.1');
  for(const [key,value]of Object.entries(a.serverEnv))if(key.endsWith('_PATH')||key.endsWith('_DIR')||key.endsWith('_ROOT'))expect(value.startsWith(a.store+'/')).toBe(true);
  expect(process.env).toEqual(before);expect(existsSync(a.store)).toBe(true);
 }finally{a.dispose();a.dispose();b.dispose();}expect(existsSync(a.store)).toBe(false);expect(existsSync(b.store)).toBe(false);
});
test('explicit available port is preserved and occupied port gives a collision diagnostic',async()=>{
 const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=String(server.address().port);
 try{expect(()=>allocateBrowserPort(port,{label:'HBL_EXPLICIT_PORT'})).toThrow('HBL_EXPLICIT_PORT could not bind to 127.0.0.1:'+port);expect(()=>allocateBrowserPort(port,{exclude:[port]})).toThrow('duplicates another server port');}finally{await new Promise(resolve=>server.close(resolve));}
 const app=createBrowserEnvironment({name:'explicit',portEnv:'HBL_EXPLICIT_PORT',env:{HBL_EXPLICIT_PORT:port}});try{expect(app.port).toBe(port);}finally{app.dispose();}
});
test('worker borrows the exact configured environment without probing or owning its directory',()=>{
 const owner=createBrowserEnvironment({name:'worker',env:{}});
 try{const worker=createBrowserEnvironment({name:'worker',env:{TEST_WORKER_INDEX:'0',[BROWSER_CONTEXT_ENV]:JSON.stringify({version:1,environments:[owner.descriptor]})}});expect(worker.baseURL).toBe(owner.baseURL);expect(worker.serverEnv).toEqual(owner.serverEnv);worker.dispose();expect(existsSync(owner.store)).toBe(true);}finally{owner.dispose();}
});

function runFixture(id,root){
 return new Promise((resolve,reject)=>{
  const report=join(root,id+'.json'),env={...process.env,HBL_BROWSER_ISOLATION_ID:id,HBL_BROWSER_ISOLATION_REPORT:report,HBL_BROWSER_ISOLATION_ARTIFACTS:join(root,id)};
  for(const key of ['HBL_PLAYWRIGHT_PORT','TEST_WORKER_INDEX',BROWSER_CONTEXT_ENV])delete env[key];
  const child=spawn('node',['node_modules/@playwright/test/cli.js','test','--config','test/browser-isolation.fixture.config.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>log+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(JSON.parse(readFileSync(report,'utf8'))):reject(new Error('Isolation Playwright fixture failed: '+log)));
 });
}
test('concurrent Playwright processes discover their own URL, write separate SQLite stores and clean up',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hbl-browser-isolation-results-'));
 try{const [a,b]=await Promise.all([runFixture('alpha',root),runFixture('beta',root)]);expect(a.port).not.toBe(b.port);expect(a.worldDb).not.toBe(b.worldDb);expect(a.guestDb).not.toBe(b.guestDb);expect(a.guestCount).toBe(1);expect(b.guestCount).toBe(1);expect(a.id).toBe('alpha');expect(b.id).toBe('beta');expect(existsSync(a.store)).toBe(false);expect(existsSync(b.store)).toBe(false);}finally{rmSync(root,{recursive:true,force:true});}
},60000);

function inspectConfig(path,overrides={}){
 const env={...process.env,...overrides};for(const key of ['TEST_WORKER_INDEX',BROWSER_CONTEXT_ENV])delete env[key];
 const script=`const config=(await import(process.argv[1])).default;console.log(JSON.stringify({use:config.use,servers:Array.isArray(config.webServer)?config.webServer:[config.webServer],metadata:config.metadata,setup:config.globalSetup}));`;
 const result=spawnSync(process.execPath,['--no-env-file','-e',script,path],{cwd:process.cwd(),env,encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);return JSON.parse(result.stdout);
}
test('migrated configs keep explicit overrides, server URL discovery, loopback and isolated paths aligned',()=>{
 for(const [path,key]of [['./test/first-run.browser.config.js','HBL_PLAYWRIGHT_PORT'],['./test/plan-choices.browser.config.mjs','HBL_PLAN_TEST_PORT'],['./test/future-machine.browser.config.js','HBL_FM_PORT'],['./test/startup-smoke.config.js','HBL_STARTUP_SMOKE_PORT'],['./playwright.config.js','HBL_PLAYWRIGHT_PORT']]){
  const port=allocateBrowserPort(),config=inspectConfig(path,{[key]:port,HBL_PLAYWRIGHT_PARTY_PORT:'0'});
  expect(new URL(config.use.baseURL).port).toBe(port);expect(config.servers[0].env.PORT).toBe(port);expect(config.setup).toContain('browser-global-setup.js');
  for(const server of config.servers){expect(server.reuseExistingServer).toBe(false);expect(server.command).toContain('--no-env-file');expect(new URL(server.url).port).toBe(server.env.PORT);expect(server.env.HBL_BIND_HOST).toBe('127.0.0.1');const descriptor=config.metadata.browserEnvironments.find(item=>item.port===server.env.PORT);expect(descriptor).toBeDefined();expect(server.env.HBL_WORLD_DB_PATH).toBe(join(descriptor.store,'world.sqlite'));expect(server.env.HBL_GUEST_DB_PATH).toBe(join(descriptor.store,'guest.sqlite'));expect(server.env.HBL_TEMPORAL_DB_PATH).toBe(join(descriptor.store,'history.sqlite'));expect(existsSync(descriptor.store)).toBe(false);}
  if(config.servers.length===2){expect(config.servers[0].env.PORT).not.toBe(config.servers[1].env.PORT);expect(config.metadata.partyURL).toBe(new URL(config.servers[1].url).origin);}
 }
});
