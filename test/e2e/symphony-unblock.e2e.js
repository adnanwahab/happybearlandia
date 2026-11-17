import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const route='/world/future-machine.html';
const sourceCommit=()=>execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
test('validated manifest follows the normal paired replay and WHY entry points',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(route);await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('16');await slider.dispatchEvent('input');
 const evidence=await page.evaluate(()=>{const api=window.futureMachine,h=api.history,s=api.state;return {month:s.month,seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,experimentId:h.experimentId,initialEqual:JSON.stringify(h.baseline[0].state)===JSON.stringify(h.plan[0].state),lengths:[h.baseline.length,h.plan.length],metrics:s.diff.metrics,scene:api.stats.scene,events:h.plan[16].events};});
 expect(evidence.month).toBe(16);expect(evidence.seed).toBe(42);expect(evidence.initialEqual).toBe(true);expect(evidence.lengths).toEqual([121,121]);expect(evidence.metrics.housingUnits.delta).toBe(24);
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');
 await page.screenshot({path:info.outputPath('validated-month-16.png'),fullPage:true});await writeFile(info.outputPath('validated-manifest-evidence.json'),JSON.stringify({sourceCommit:sourceCommit(),...evidence,errors},null,2));expect(errors).toEqual([]);
});
test('malformed display title shows a safe actionable error before replay work',async({page},info)=>{
 let replayRequests=0,corrupted=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/replay'))replayRequests++;});
 // Deliberately corrupt only metadata in a real completed API response. No
 // synthetic result is displayed; the unchanged real database remains intact.
 await page.route('**/api/city-experiments/*',async route=>{
  const response=await route.fetch();const record=await response.json();
  if(record.status==='complete'){record.manifest.title='private-value\nforged event';corrupted=true;await route.fulfill({response,json:record});}else await route.fulfill({response});
 });
 await page.goto(route);await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('error');
 const alert=page.getByRole('alert');await expect(alert).toBeVisible();await expect(alert).toContainText('Invalid saved experiment title');await expect(alert).not.toContainText('private-value');expect(corrupted).toBe(true);expect(replayRequests).toBe(0);
 const evidence=await page.evaluate(()=>({status:window.futureMachine.state.status,error:window.futureMachine.state.error,historyLoaded:window.futureMachine.history!==null}));expect(evidence.historyLoaded).toBe(false);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('invalid-manifest-visible-error.png'),fullPage:true});await writeFile(info.outputPath('invalid-manifest-evidence.json'),JSON.stringify({sourceCommit:sourceCommit(),...evidence,replayRequests,corrupted,errors},null,2));
});
