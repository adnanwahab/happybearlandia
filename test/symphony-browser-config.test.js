import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('wrapper reload uses the server descriptor, preserves source descriptors and redacts metadata',()=>{
 const artifacts=mkdtempSync(join(tmpdir(),'hbl-wrapper-regression-'));
 try{
  const input={config:join(process.cwd(),'test/symphony-browser-runtime.config.js'),engine:'chromium',device:'mobile',artifacts,wsEndpoint:'ws://localhost/test-capability'};
  const script=`const base=(await import('./scripts/symphony-browser-config.mjs')).default;const configured=base.metadata.browserEnvironments;process.env.TEST_WORKER_INDEX='0';process.env.HBL_BROWSER_TEST_ENVIRONMENTS=JSON.stringify({version:1,environments:configured});const reloaded=(await import('./scripts/symphony-browser-config.mjs?worker')).default;console.log(JSON.stringify({first:base.use.baseURL,reloaded:reloaded.use.baseURL,server:reloaded.webServer.url,metadata:reloaded.metadata,project:reloaded.projects[0]}));`;
  const result=spawnSync(process.execPath,['-e',script],{env:{...process.env,HBL_BROWSER_JOB_CONFIG:JSON.stringify(input)},encoding:'utf8'});
  expect(result.status).toBe(0);const config=JSON.parse(result.stdout);
  expect(config.first).toBe(config.reloaded);expect(config.server).toBe(config.first+'/api/health');
  expect(config.metadata.browserEnvironments).toHaveLength(2);expect(config.metadata.browserJob.wsEndpoint).toBeUndefined();
  expect(config.project.name).toBe('mobile');expect(config.project.use.isMobile).toBe(true);
 }finally{rmSync(artifacts,{recursive:true,force:true});}
});
