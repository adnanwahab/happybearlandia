import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {assertSidewalkAcceptance} from '../support/sidewalk-acceptance.js';

test('WebKit runs native resident acceptance or explicitly identifies unsupported static view',async({page,browserName},info)=>{
 await page.goto('/routes');
 const capabilities=await page.evaluate(async()=>{
  let adapter=null,error=null;
  try{adapter=await navigator.gpu?.requestAdapter();}catch(e){error=e.message;}
  return {secure:isSecureContext,webgpu:Boolean(navigator.gpu),adapter:Boolean(adapter),error,userAgent:navigator.userAgent};
 });
 expect(capabilities.secure).toBe(true);
 const report={capabilities,nativeResidentAcceptance:capabilities.adapter?'running':'blocked: native WebGPU unavailable',touchGestureCoverage:!capabilities.adapter?'not exercised: native resident runtime unavailable':info.project.name==='mobile'&&browserName==='webkit'?'native touch selection plus keyboard pan; touch swipe not covered':'native browser input'};
 if(capabilities.adapter){
  await assertSidewalkAcceptance({page,browserName},info);
  report.nativeResidentAcceptance='passed';
 }else{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline');
  await expect(page).toHaveURL(/\/world\/static-city\.html\?/);
  await expect(page.getByText('WebGL2 city view only · the simulation requires WebGPU.',{exact:true})).toBeVisible();
  await expect(page.getByText('No residents, simulation workers, time progression or gameplay run in this view.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>Boolean(window.hblWorldTileSource||window.hblSimulationPlayback))).toBe(false);
  await page.screenshot({path:info.outputPath('explicit-unsupported-static-view.png')});
  expect(errors).toEqual([]);
  report.staticFallbackAcceptance='passed; not resident acceptance';
 }
 console.log(JSON.stringify(report));
 await writeFile(info.outputPath('webkit-compatibility.json'),JSON.stringify(report,null,2));
 await info.attach('webkit-compatibility',{body:JSON.stringify(report,null,2),contentType:'application/json'});
});
