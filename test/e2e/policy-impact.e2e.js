import {test,expect} from '@playwright/test';
import {policyHash} from '../../world/policy-preview-contract.js';
import {readFile,writeFile} from 'node:fs/promises';

test.beforeEach(async({page},info)=>{input.source.proposalId=`browser-housing-${info.project.name}`;if(info.project.name==='no-webgpu')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));});
const token='policy-impact-browser-test-token';
const input={schemaVersion:'policy-impact-preview.v1',source:{system:'civic-synthesis',proposalId:'browser-housing',versionId:'v1',contentHash:'a'.repeat(64),type:'bill',title:'Synthetic housing proposal',url:'https://civic-synthesis.example/proposals/browser-housing',visibility:'public'},legal:{baseVersionId:'v0',clauses:[{clauseId:'housing-1',sourcePolicyId:'h_lots',operation:'add',beforeText:'',afterText:'Allow additional homes on eligible modeled parcels.'},{clauseId:'health-1',sourcePolicyId:'unknown-health',operation:'add',beforeText:'',afterText:'Provide universal access to healthcare.'}]},baseline:{kind:'prior-proposal-version',versionId:'v0',label:'Prior proposal version'},simulation:{seed:42,runs:3,months:24}};
input.source.contentHash=policyHash(input.legal);
test('public frozen preview connects legal changes, recorded city pairs, timeline and explanations',async({page,request})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const created=await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:input});expect([200,202]).toContain(created.status());const preview=await created.json();expect(preview.id).toBeTruthy();
 await page.goto(`/world/impact?preview=${preview.id}`);await expect(page.locator('#proposal-title')).toHaveText(input.source.title);await expect(page.locator('.added').first()).toHaveText('+ '+input.legal.clauses[0].afterText);await expect(page.locator('.disclosure')).toContainText('Synthetic');
 await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact?.getState().selected?.proposal?.month),{timeout:90000}).toBe(0);
 if(test.info().project.name!=='no-webgpu'){await expect(page.locator('#city-a canvas')).toBeVisible();await expect(page.locator('#city-b canvas')).toBeVisible();}else await expect(page.locator('#graphics-status')).toContainText('Unsupported graphics');await expect(page.locator('#landscape circle')).toHaveCount(3);
 await page.locator('#month').focus();await page.locator('#month').press('End');await expect(page.locator('#month-label')).toHaveText('Month 24');
 const selected=await page.evaluate(()=>{const state=window.hblPolicyImpact.getState();const run=state.results.runs.find(row=>row.runIndex===state.runIndex);return{month:state.month,a:state.selected.baseline.month,b:state.selected.proposal.month,metric:state.analysis.scorecard.find(row=>row.id==='housingUnits'),recorded:run.proposal.metricsTimeline.find(point=>point.month===state.month).metrics.housingUnits,stats:state.views.map(view=>view.getStats()),cameras:state.views.map(view=>view.getCamera())};});expect(selected.a).toBe(24);expect(selected.b).toBe(24);expect(selected.metric.current).toBe(selected.recorded);expect(selected.cameras[0]).toEqual(selected.cameras[1]);
 await page.locator('#landscape circle').last().click();await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact.getState().runIndex)).toBe(2);await expect(page.locator('#month-label')).toHaveText('Month 24');
 await page.locator('[data-clause="health-1"] button').click();await expect(page.locator('#mapping')).toContainText(/unchanged|unavailable|unsupported/i);await page.locator('#graph [role=button]').first().click();await expect(page.locator('#node-detail')).toContainText('health-1');await expect(page.locator('#node-detail')).toContainText('mappingBoundary');
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1400,height:1000});await page.screenshot({path:test.info().outputPath('policy-impact-desktop.png'),fullPage:true});expect(errors).toEqual([]);
});
test('unavailable preview is explicit',async({page})=>{await page.goto('/world/impact?preview=missing');await expect(page.locator('#status')).toContainText('unavailable');await expect(page.locator('#explorer')).toBeHidden();});

test('100 actual paired futures remain individually selectable without overlapping dots',async({page,request})=>{
 test.setTimeout(180000);
 const fixture=JSON.parse(await readFile(new URL('../../world/policy-preview-demo.json',import.meta.url),'utf8'));
 const created=await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:fixture});expect([200,202]).toContain(created.status());const preview=await created.json();
 await expect.poll(async()=>{const response=await request.get(`/api/policy-previews/${preview.id}`);return (await response.json()).job;},{timeout:150000,intervals:[1000,2000]}).toMatchObject({status:'completed',completed:100,failed:0,total:100});
 const initialReads=[];page.on('request',r=>{if(r.url().includes('/api/policy-previews/'))initialReads.push(new URL(r.url()).pathname+new URL(r.url()).search);});
 await page.goto(`/world/impact?preview=${preview.id}`);await expect(page.locator('#landscape circle')).toHaveCount(100,{timeout:60000});
 await expect(page.locator('#load-status')).toHaveText('Recorded checkpoint loaded.');
 expect(initialReads.some(path=>path.includes('/summary?'))).toBe(true);
 expect(initialReads.filter(path=>path.includes('/results'))).toEqual([`/api/policy-previews/${preview.id}/results?runIndex=0`]);
 // At month0 many identical outcomes must retain distinct positions.
 const dots=await page.locator('#landscape circle').evaluateAll(nodes=>nodes.map(node=>[Number(node.getAttribute('cx')),Number(node.getAttribute('cy'))]));
 expect(new Set(dots.map(point=>point.join(','))).size).toBe(100);
 for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++)expect(Math.hypot(dots[i][0]-dots[j][0],dots[i][1]-dots[j][1])).toBeGreaterThanOrEqual(12);
 await page.locator('#month').focus();await page.locator('#month').press('End');await expect(page.locator('#month-label')).toHaveText('Month 24');await expect(page.locator('#landscape circle')).toHaveCount(100);await expect(page.locator('[data-metric=entitledCapacity]')).toContainText('Δ 12');
 await page.locator('#landscape [data-run-index="99"]').click();await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact.getState().runIndex)).toBe(99);await expect(page.locator('#selection')).toContainText('pair 100');await expect(page.locator('#month-label')).toHaveText('Month 24');
 const recorded=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState();return {month:s.selected.proposal.month,seed:s.selected.proposal.seed,pairSeed:s.results.runs.find(row=>row.runIndex===99).seed};});expect(recorded.month).toBe(24);expect(recorded.seed).toBe(recorded.pairSeed);
 await page.setViewportSize({width:1400,height:1000});await page.locator('#landscape').evaluate(node=>{node.scrollTop=0;});await page.screenshot({path:test.info().outputPath('policy-impact-100-futures.png'),fullPage:true});
});


test('recorded 0/12/24 states, metrics, events, second seed and URL reload stay aligned',async({page,request})=>{
 const created=await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:input});const preview=await created.json();
 await expect.poll(async()=>{const r=await request.get(`/api/policy-previews/${preview.id}`);return (await r.json()).job.status;}).toBe('completed');
 const reads=[];page.on('request',r=>{if(r.url().includes('/api/policy-previews/'))reads.push(new URL(r.url()).pathname+new URL(r.url()).search);});
 await page.goto(`/world/impact?preview=${preview.id}`);
 await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact?.getState().selected?.proposal.month)).toBe(0);
 const observations=[];
 for(const index of [0,1,2]){
  await page.evaluate(i=>window.hblPolicyImpact.selectCheckpoint(i),index);
  const month=[0,12,24][index];
  await expect(page.locator('#month-label')).toHaveText(`Month ${month}`);
  const result=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState(),pair=s.results.runs[0];return {a:s.selected.baseline,b:s.selected.proposal,pair,scorecard:s.analysis.scorecard,events:document.querySelector('#events').textContent};});
  for(const [arm,selected] of [['baseline',result.a],['proposal',result.b]]){
   expect(selected).toEqual(result.pair[arm].checkpoints.find(p=>p.month===month).state);expect(selected.seed).toBe(result.pair.seed);
   const metrics=result.pair[arm].metricsTimeline.find(p=>p.month===month).metrics;
   expect(result.scorecard.find(m=>m.id==='housingUnits')[arm==='baseline'?'baseline':'current']).toBe(metrics.housingUnits);
  }
  observations.push(result);
 }
 expect(observations[0].a).not.toEqual(observations[1].a);expect(observations[1].b).not.toEqual(observations[2].b);
 expect(observations[0].pair.baseline.metricsTimeline[0].metrics).not.toEqual(observations[0].pair.baseline.metricsTimeline[12].metrics);
 expect(observations[0].events).not.toEqual(observations[2].events);for(const arm of ['baseline','proposal']){const pair=observations[0].pair;expect(pair[arm].metricsTimeline[0].metrics).not.toEqual(pair[arm].metricsTimeline[12].metrics);expect(pair[arm].events.filter(e=>(e.simulationTime??e.month??0)<=0)).not.toEqual(pair[arm].events.filter(e=>(e.simulationTime??e.month??0)<=24));}
 await page.locator('[data-metric=housingUnits] button').focus();await page.keyboard.press('Enter');await expect(page.locator('#node-detail')).toContainText('parameterDiff');await expect(page.locator('#node-detail')).toContainText('recorded');
 await page.locator('#entities button').first().click();await expect(page.locator('#node-detail')).toContainText('entity');
 await page.evaluate(()=>window.hblPolicyImpact.selectPair(1));await expect(page.locator('#selection')).toContainText('pair 2');const seed=await page.evaluate(()=>window.hblPolicyImpact.getState().results.runs[0].seed);
 expect(seed).not.toBe(observations[0].pair.seed);expect(page.url()).toContain('pair=1');expect(page.url()).toContain('month=24');
 await page.reload();await expect(page.locator('#selection')).toContainText('pair 2');await expect(page.locator('#month-label')).toHaveText('Month 24');
 expect(await page.evaluate(()=>window.hblPolicyImpact.getState().selected.proposal.seed)).toBe(seed);
 expect(reads.every(p=>!p.endsWith('/results'))).toBe(true);expect(reads.some(p=>p.includes('/summary?month=12'))).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('recorded-mobile-24.png'),fullPage:true});
});

test('late pair requests never replace the latest selected seed',async({page,request})=>{
 const preview=await(await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:input})).json();
 await expect.poll(async()=> (await(await request.get(`/api/policy-previews/${preview.id}`)).json()).job.status).toBe('completed');
 await page.goto(`/world/impact?preview=${preview.id}`);await expect.poll(()=>page.evaluate(()=>!!window.hblPolicyImpact?.getState().selected)).toBe(true);
 await page.route('**/results?runIndex=1',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue().catch(()=>{});});
 await page.evaluate(async()=>{const api=window.hblPolicyImpact;const slow=api.selectPair(1);await new Promise(r=>setTimeout(r,30));await api.selectPair(2);await slow;});
 await expect(page.locator('#selection')).toContainText('pair 3');await page.waitForTimeout(400);
 const s=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState();return [s.runIndex,s.results.runs[0].seed,s.selected.baseline.seed,s.selected.proposal.seed];});expect(s[0]).toBe(2);expect(s[1]).toBe(s[2]);expect(s[2]).toBe(s[3]);
});

for(const scenario of ['failed','partial','malformed','old'])test(`honest ${scenario} summary without synthetic states`,async({page,request})=>{
 const preview=await(await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:input})).json();
 await page.route('**/summary?*',async route=>{const response=await route.fetch();const s=await response.json();if(scenario==='old')s.schemaVersion='old';else if(scenario==='malformed')s.pairs=null;else{s.job={status:scenario,completed:0,failed:3,total:3};s.pairs=s.pairs.map(p=>({...p,status:'failed',metrics:null}));}await route.fulfill({response,json:s});});
 await page.goto(`/world/impact?preview=${preview.id}`);await expect(page.locator('#load-status')).toContainText(scenario==='old'||scenario==='malformed'?'Failed to load':'No successful recorded');expect(await page.evaluate(()=>window.hblPolicyImpact.getState().selected)).toBeNull();await expect(page.locator('#metrics article')).toHaveCount(0);await expect(page.locator('#month')).toBeDisabled();
});

test('job progress changing between summary pages retries without mixing snapshots',async({page,request})=>{
 const fixture=JSON.parse(await readFile(new URL('../../world/policy-preview-demo.json',import.meta.url),'utf8'));
 const preview=await(await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:fixture})).json();
 await expect.poll(async()=>(await(await request.get(`/api/policy-previews/${preview.id}`)).json()).job.status,{timeout:150000}).toBe('completed');
 await page.route(`**/api/policy-previews/${preview.id}`,async route=>{const response=await route.fetch(),m=await response.json();m.job={status:'running',completed:0,failed:0,total:100};await route.fulfill({response,json:m});});
 let summaryReads=0;
 await page.route('**/summary?*',async route=>{const response=await route.fetch(),s=await response.json();if(summaryReads++===0)s.job={status:'running',completed:50,failed:0,total:100};await route.fulfill({response,json:s});});
 await page.goto(`/world/impact?preview=${preview.id}`);
 await expect(page.locator('#load-status')).toHaveText('Recorded checkpoint loaded.');
 expect(summaryReads).toBeGreaterThanOrEqual(4);
 const selected=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState();return {seed:s.results.runs[0].seed,a:s.selected.baseline.seed,b:s.selected.proposal.seed};});
 expect(selected.a).toBe(selected.seed);expect(selected.b).toBe(selected.seed);
});

test('native GPU evidence requires a genuine adapter and changed rendered pixels',async({page,request},info)=>{
 test.skip(info.project.name!=='native-webgpu','Native GPU coverage requires the isolated native configuration; software WebGPU is not acceptance.');
 const gpuErrors=[];page.on('pageerror',e=>gpuErrors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/GPUValidationError/.test(m.text()))gpuErrors.push(m.text());});
 const preview=await(await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:input})).json();
 await page.goto(`/world/impact?preview=${preview.id}`);
 const adapter=await page.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter();if(!a)return null;const device=await a.requestDevice();const result={info:{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description},fallback:a.info?.isFallbackAdapter??a.isFallbackAdapter,features:[...device.features],limits:{maxTextureDimension2D:device.limits.maxTextureDimension2D}};device.destroy();return result;});
 test.skip(!adapter||adapter.fallback||/swiftshader|software|llvmpipe/i.test(JSON.stringify(adapter)),'Native adapter unavailable; NOT RUN.');
 await writeFile(info.outputPath('adapter-device.json'),JSON.stringify(adapter,null,2));await info.attach('adapter-device.json',{body:JSON.stringify(adapter),contentType:'application/json'});
 await expect(page.locator('#graphics-status')).toContainText('Graphics ready');await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact?.getState().selected?.proposal.month)).toBe(0);
 const captures={a:[],b:[]},observations=[];
 for(const [index,month] of [0,12,24].entries()){
  await page.evaluate(i=>window.hblPolicyImpact.selectCheckpoint(i),index);
  await expect(page.locator('#month-label')).toHaveText(`Month ${month}`);
  await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact.getState().views.map(v=>v.getStats().month))).toEqual([month,month]);
  await page.waitForTimeout(250);
  const recorded=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState(),pair=s.results.runs[0];return {month:s.month,seed:pair.seed,stats:s.views.map(v=>v.getStats()),buildings:{baseline:s.selected.baseline.buildings,proposal:s.selected.proposal.buildings},statesMatch:JSON.stringify(s.selected.baseline)===JSON.stringify(pair.baseline.checkpoints.find(p=>p.month===s.month).state)&&JSON.stringify(s.selected.proposal)===JSON.stringify(pair.proposal.checkpoints.find(p=>p.month===s.month).state)};});
  expect(recorded.statesMatch).toBe(true);expect(recorded.stats.every(s=>s.backend==='webgpu'&&s.seed===recorded.seed&&s.objects>0)).toBe(true);observations.push(recorded);
  for(const arm of ['a','b']){
   const canvas=page.locator(`#city-${arm} canvas`);await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
   // Crop out DOM labels at the top and bottom: only rendered scene pixels count.
   const pad=Math.min(85,box.height/3),pixels=await page.screenshot({clip:{x:box.x+8,y:box.y+pad,width:box.width-16,height:box.height-pad*2}});
   captures[arm].push(pixels);await writeFile(info.outputPath(`native-${arm}-month${month}-scene.png`),pixels);await info.attach(`native-${arm}-month${month}-scene.png`,{body:pixels,contentType:'image/png'});
  }
 }
 expect(captures.a[0].equals(captures.a[2])).toBe(false);expect(captures.b[0].equals(captures.b[2])).toBe(false);
 await writeFile(info.outputPath('native-recorded-state-and-geometry.json'),JSON.stringify(observations,null,2));await info.attach('native-recorded-state-and-geometry.json',{body:JSON.stringify(observations,null,2),contentType:'application/json'});
 const canvas=page.locator('#city-a canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),before=await page.evaluate(()=>window.hblPolicyImpact.getState().views[0].getCamera());
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+20,{steps:8});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>{const v=window.hblPolicyImpact.getState().views;return JSON.stringify(v[0].getCamera())===JSON.stringify(v[1].getCamera());})).toBe(true);
 expect(await page.evaluate(()=>window.hblPolicyImpact.getState().views[0].getCamera())).not.toEqual(before);
 expect(gpuErrors).toEqual([]);
});
