import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

async function seek(page,month){
 const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.month)).toBe(month);
}
async function observation(page){
 return page.evaluate(async()=>{
  const api=window.futureMachine,{history,state}=api,month=state.month;
  const {recordedConstructionProgress}=await import('/world/future-machine/scene/construction-progress.js');
  const {createSpatialMapping}=await import('/world/future-machine/scene/mapping.js');
  const mapping=createSpatialMapping();let projection;
  // Match stage initialization: reserve schematic slots across its full history.
  for(let m=0;m<=120;m++)mapping.frame(history.baseline[m].state,history.plan[m].state);
  projection=mapping.frame(history.baseline[month].state,history.plan[month].state);
  return {month,seed:history.seed,modelVersion:history.modelVersion,runId:history.experimentId,initialHash:history.initialHash,recipe:history.recipe,
   projects:recordedConstructionProgress(history.plan[month]),baselineProjects:recordedConstructionProgress(history.baseline[month]),
   buildings:history.plan[month].state.buildings,baselineBuildings:history.baseline[month].state.buildings,
   events:history.plan[month].events,metrics:state.diff.metrics,scene:api.stats.scene,projection,provenance:history.provenance};
 });
}
for(const renderer of ['native-metal','canvas2d'])test(`${renderer}: recorded construction, completion and reverse scrub`,async({page},info)=>{
 const source=info.config.metadata.sourceRoot;
 const sourceCommitAtStart=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
 const errors={page:[],console:[]};page.on('pageerror',error=>errors.page.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.console.push(message.text());});
 await page.goto('/world/future-machine.html'+(renderer==='canvas2d'?'?renderer=canvas2d':''));
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe(renderer==='canvas2d'?'canvas2d':'webgpu');
 const stage=page.getByTestId('future-machine-stage');await stage.scrollIntoViewIfNeeded();
 const records=[];
 async function capture(name,month){await seek(page,month);const data=await observation(page);records.push({name,...data});await writeFile(info.outputPath(`${name}.json`),JSON.stringify(data,null,2));await stage.screenshot({path:info.outputPath(`${name}.png`)});return data;}
 const start=await capture('month-0',0);expect(start.seed).toBe(42);expect(start.recipe.intervention).toMatchObject({type:'housing',amount:24,cost:1000000,delay:0});expect(start.projects).toEqual([]);expect(start.buildings).toEqual(start.baselineBuildings);expect(start.metrics.housingUnits.delta).toBe(0);
 const before=await capture('month-15-construction',15);const project=before.projects.find(p=>p.type==='housing');
 expect(project).toMatchObject({stage:'construction',progress:11,duration:12,units:24,buildingPresent:false});expect(project.progressRatio).toBe(11/12);
 const marker=before.projection.b.find(row=>row.collection==='projects'&&row.id===project.id);expect(marker.construction).toEqual(project);expect(marker.polygon).toBe(null);expect(before.buildings.some(b=>b.id===project.housingProjectBuildingId)).toBe(false);expect(before.metrics.housingUnits.delta).toBe(0);
 await expect(stage.getByRole('button',{name:new RegExp(project.id+'.*construction.*24 planned homes')})).toBeVisible();
 const completed=await capture('month-16-completed',16);const building=completed.projection.b.find(row=>row.collection==='buildings'&&row.id===project.housingProjectBuildingId);
 expect(completed.projects.find(p=>p.id===project.id)).toMatchObject({stage:'completion',progress:12,progressRatio:1,buildingPresent:true});expect(building.record.floors).toBe(3);expect([building.x,building.z]).toEqual([marker.x,marker.z]);expect(completed.projection.b.some(row=>row.collection==='projects'&&row.id===project.id)).toBe(false);
 expect(completed.metrics.housingUnits).toMatchObject({baseline:36,plan:60,delta:24});expect(completed.metrics.capitalSpending.delta).toBe(1000000);
 expect(completed.events.some(event=>event.eventType==='PROJECT_COMPLETE'&&event.payload?.projectId===project.id)).toBe(true);
 await expect(stage.getByRole('button',{name:new RegExp('^'+project.housingProjectBuildingId+' ·')})).toBeVisible();
 const reverse=await capture('reverse-month-15',15);expect(reverse.projects).toEqual(before.projects);expect(reverse.projection).toEqual(before.projection);expect(reverse.scene.camera).toEqual(before.scene.camera);expect(reverse.buildings.some(b=>b.id===project.housingProjectBuildingId)).toBe(false);
 const reset=await capture('reverse-month-0',0);expect(reset.projection).toEqual(start.projection);expect(reset.projects).toEqual([]);expect(reset.scene.camera).toEqual(start.scene.camera);await expect(stage.getByRole('button',{name:new RegExp(project.id)})).toHaveCount(0);
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
 await writeFile(info.outputPath('construction-evidence.json'),JSON.stringify({schemaVersion:'construction-recorded-browser.v1',renderer,sourceCommitAtStart,sourceCommit,sourceRoot:source,browser:page.context().browser().version(),records,errors,limitations:['Synthetic schematic coordinates; no real parcel mapping.','Project work ratio does not measure elapsed calendar time or completed homes.','Native proof requires a functioning WebGPU adapter; no SwiftShader support claim.']},null,2));
 expect(errors).toEqual({page:[],console:[]});
});
