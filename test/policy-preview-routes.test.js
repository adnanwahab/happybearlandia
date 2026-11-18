import {test,expect} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('normal server routes enforce preview auth and page-specific embedding policy',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'hbl-policy-routes-'));
 const server=Bun.spawn([process.execPath,'--no-env-file','run','server.js'],{
  env:{PATH:process.env.PATH,PORT:'0',HBL_WORLD_DB_PATH:':memory:',HBL_POLICY_PREVIEW_DIR:join(directory,'previews'),HBL_WORKFLOW_STORE_DIR:join(directory,'workflows'),HBL_CHECKPOINT_STORE_DIR:join(directory,'checkpoints'),HBL_JOURNAL_ROOT:join(directory,'journals'),DECISION_STORE_DIR:join(directory,'decision'),HBL_POLICY_PREVIEW_TOKEN:'route-test-only',HBL_POLICY_EMBED_ORIGINS:'https://civic.example,https://dear-congress.fly.dev',HBL_POLICY_PREVIEW_ORIGIN:'https://hbl.example',NODE_ENV:'test'},stdout:'pipe',stderr:'pipe'});
 const timeout=setTimeout(()=>server.kill(),10000);
 try{
  const reader=server.stdout.getReader(),decoder=new TextDecoder();let output='',port;
  while(!port){const {value,done}=await reader.read();if(done)throw Error('Server did not start: '+await new Response(server.stderr).text());output+=decoder.decode(value,{stream:true});port=output.match(/HappyBearLandia running at http:\/\/localhost:(\d+)/)?.[1];}
  reader.releaseLock();clearTimeout(timeout);
  const origin=`http://127.0.0.1:${port}`;
  const response=await fetch(origin+'/world/impact?preview=missing');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'self' https://dear-congress.fly.dev https://civic.example");
  expect(await response.text()).toContain('Policy Impact');
  const alias=await fetch(origin+'/world/policy-impact.html');
  expect(alias.headers.get('content-security-policy')).toBe(response.headers.get('content-security-policy'));
  const encodedAlias=await fetch(origin+'/world/policy-impact%2ehtml');
  expect(encodedAlias.headers.get('content-security-policy')).toBe(response.headers.get('content-security-policy'));
  const unrelated=await fetch(origin+'/visualize-constitution');
  expect(unrelated.status).toBe(200);expect(unrelated.headers.get('content-security-policy')).toBeNull();
  expect((await fetch(origin+'/world/experiment-lab.html')).status).toBe(200);
  for(const path of ['policy-preview-api.js','policy-preview-contract.js','policy-preview-security.js'])expect((await fetch(origin+'/world/'+path)).status).toBe(404);
  expect((await fetch(origin+'/api/policy-previews',{method:'POST',body:'{}'})).status).toBe(401);
  expect((await fetch(origin+'/api/policy-previews/missing')).status).toBe(404);
 }finally{clearTimeout(timeout);server.kill();await server.exited;await rm(directory,{recursive:true,force:true});}
},20000);
