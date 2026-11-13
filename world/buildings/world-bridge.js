import {mountGroundWish} from './ground-wish.js';
// /world integration: resident/day simulation remains independent. Only the
// shared tools' explicit approval callback replaces input. Previews are detached
// ghost objects; results always come from the Decision API, never a local model.
import {attachBuildingWorld,previewBuildingWorld,findBuildableLocation,illustrativeWorldMapping,buildingStateAtMonth} from './renderer.js';
import {createBuildingProposal,validateBuildingProposal} from './proposal.js';
import {mountWorldTools} from '../decision/world-tools.js';
import {housingModel,createHousingScenarios,validateHousingParameters} from '../models/housing/index.js';
import {createDecisionClient,createRunTraceCache,mergeRunTrace} from '../decision/client.js';

export const BUILDING_CHECKPOINT_VERSION='building-workspace-checkpoint.v1';
export const BUILDING_CHECKPOINT_MAX_BYTES=8*1024*1024;
const canonicalTopology=value=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry);
/** Detached JSON only: full selected run trace is retained, not regenerated. */
export function validateBuildingWorkspaceCheckpoint(data,{placementContext}={}){
 const encoded=JSON.stringify(data,(_,value)=>{if(typeof value==='number'&&!Number.isFinite(value)||typeof value==='function'||typeof value==='bigint')throw new Error('Construction checkpoint must contain finite JSON data');return value;});
 if(typeof encoded!=='string'||new TextEncoder().encode(encoded).length>BUILDING_CHECKPOINT_MAX_BYTES)throw new Error('Construction checkpoint exceeds8MB JSON limit');
 const saved=JSON.parse(encoded),input=saved?.input;
 if(saved?.schemaVersion!==BUILDING_CHECKPOINT_VERSION||saved.modelId!==housingModel.id||saved.modelVersion!==housingModel.version||input?.schemaVersion!=='decision-experiment.v1'||input.modelId!==housingModel.id||input.modelVersion!==housingModel.version)throw new Error('Construction checkpoint schema/model version mismatch');
 if(!Number.isInteger(input.years)||input.years<1||input.years>50||!Array.isArray(input.scenarios)||!input.scenarios.length||input.scenarios.length>32||new Set(input.scenarios.map(row=>row.id)).size!==input.scenarios.length)throw new Error('Invalid construction scenario topology');
 for(const scenario of input.scenarios){if(typeof scenario.id!=='string'||!validateHousingParameters(scenario.parameters).valid||scenario.projects!==undefined&&!Array.isArray(scenario.projects))throw new Error('Invalid approved construction scenario');for(const project of scenario.projects??[])if(!validateBuildingProposal(project).valid)throw new Error('Invalid saved building proposal');}
 if(!input.scenarios.some(row=>row.id===saved.scenarioId)||!Number.isInteger(saved.month)||saved.month<0||saved.month>input.years*12||typeof saved.playing!=='boolean'||typeof saved.open!=='boolean')throw new Error('Invalid construction selection or playback clock');
 if(!saved.placementContext||canonicalTopology(saved.placementContext)!==canonicalTopology(input.metadata?.placementContext)||placementContext&&canonicalTopology(saved.placementContext)!==canonicalTopology(placementContext))throw new Error('Construction checkpoint belongs to different source geometry/topology');
 if(saved.results!==null&&(!saved.results||!Array.isArray(saved.results.runs)||saved.results.experiment?.modelVersion&&saved.results.experiment.modelVersion!==housingModel.version))throw new Error('Invalid stored construction results');
 if(saved.run!==null){const run=saved.run;if(typeof run.id!=='string'||run.scenarioId!==saved.scenarioId||!saved.results?.runs.some(row=>row.id===run.id&&row.scenarioId===saved.scenarioId)||run.traceDelivery==='on-demand'||!Array.isArray(run.monthlyTimeline??run.timeline)||!Array.isArray(run.projects??[]))throw new Error('Selected construction future requires its actual full saved trace');const projectIds=new Set(input.scenarios.find(row=>row.id===saved.scenarioId).projects?.map(project=>project.id)??[]);for(const project of run.projects??[])if(!projectIds.has(project.projectId)||!Array.isArray(project.states)||project.states.some(state=>!Number.isInteger(state.month)||state.month<0||state.month>input.years*12))throw new Error('Invalid saved project pipeline');}
 return saved;
}
export function createBuildingWorkspaceCheckpoint(state){return validateBuildingWorkspaceCheckpoint({schemaVersion:BUILDING_CHECKPOINT_VERSION,modelId:housingModel.id,modelVersion:housingModel.version,...state});}

export function mountWorldBuildingBridge({scene,camera,renderer,controls,town,THREE,container=document.body}={}) {
  const doc=container.ownerDocument,root=doc.createElement('details');root.className='bw-world-tools';root.dataset.testid='world-building-tools';
  root.innerHTML='<summary>+ Build something · ✦ Edit world</summary><p>Draft a physical project, approve it, then explore construction across possible futures.</p><div class="bw-bridge-controls"><label>Scenario <select data-bw-scenario aria-label="Building scenario"></select></label><button data-bw-simulate>Simulate projects</button></div><div class="bw-bridge-controls"><button data-bw-play>Play construction</button><label>Month <output data-bw-time>0</output></label><input data-bw-month type="range" min="0" max="120" step="1" value="0" aria-label="Construction month"></div><p data-bw-future-metrics class="bw-future-metrics"></p><div class="bw-bridge-status" role="status" aria-live="polite">No construction run selected. Approve a project, then simulate.</div><div data-bw-runs class="bw-bridge-controls" hidden><label>Future <select data-bw-run aria-label="Construction future"></select></label><a data-bw-link target="_blank" rel="noopener">Open exact experiment</a></div><div class="bw-selection" hidden></div><section aria-label="Project World Diff"><h3>World Diff · building projects</h3><div data-bw-diff></div></section><div data-bw-tools></div>';
  const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./buildings.css',import.meta.url).href;root.append(sheet);const toolSheet=doc.createElement('link');toolSheet.rel='stylesheet';toolSheet.href=new URL('../decision/world-tools.css',import.meta.url).href;root.append(toolSheet);container.append(root);
  const $=s=>root.querySelector(s),client=createDecisionClient(),clone=value=>structuredClone(value);
  const traceCache=createRunTraceCache({loadRun:(experimentId,runId)=>client.run(experimentId,runId),limit:2});let traceSelection=0,pendingTrace=null;
  const key=`hbl.world.buildings.v1:${new URLSearchParams(location.search).get('lat')||'default'}:${new URLSearchParams(location.search).get('lng')||'default'}`;
  const polygons=(town?.buildings||[]).filter(b=>Array.isArray(b.poly||b.polygon)).map(b=>({id:String(b.id),polygon:clone(b.poly||b.polygon)}));
  const placementContext={buildings:polygons,districts:clone(town?.districts||[]),bounds:town?.bounds||{minX:-1500,maxX:1500,minZ:-1500,maxZ:1500}};
  let input={schemaVersion:'decision-experiment.v1',name:'Neighborhood building experiment',decision:'Test a specific housing development in the neighborhood.',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:10,years:10,scenarios:createHousingScenarios(),metadata:{placementContext}};
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.modelVersion===housingModel.version&&Array.isArray(saved.scenarios))input={...saved,metadata:{...saved.metadata,placementContext}}}catch{}
  let scenarioId=input.scenarios.find(s=>s.kind==='plan-a')?.id||input.scenarios[0].id,results=null,run=null,month=0,previewState=null,timer=null,watcher=null,busy=false,destroyed=false,tools=null,checkpointRestored=false,autoPlay=false;
  let futureMapping=illustrativeWorldMapping(null);
  const current=()=>input.scenarios.find(s=>s.id===scenarioId)||input.scenarios[0];
  const announce=message=>{$('.bw-bridge-status').textContent=message};
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(input))}catch{announce('Browser storage unavailable; export or run the experiment to preserve this revision.')}};
  const selectionWithContext=selection=>({...selection,placementContext});
  const worldView=attachBuildingWorld({scene,camera,renderer,controls,town:{...town,...placementContext},THREE,panel:$('.bw-selection'),statusElement:$('.bw-bridge-status'),onPlace:proposal=>{tools?.setPlacement(proposal)},onCancel:()=>tools?.setPlacement(null),onSelect:selection=>{tools?.setSelection(selectionWithContext(selection))}});
  const placementHUD=doc.createElement('div');placementHUD.className='bw-placement-hud';placementHUD.setAttribute('role','status');placementHUD.hidden=true;container.append(placementHUD);
  const hudObserver=new MutationObserver(()=>{placementHUD.hidden=!worldView.isPlacing;placementHUD.textContent=$('.bw-bridge-status').textContent});hudObserver.observe($('.bw-bridge-status'),{childList:true,characterData:true,subtree:true});
  const stop=()=>{clearInterval(timer);timer=null;$('[data-bw-play]').textContent='Play construction'};
  function render(){if(autoPlay&&run&&run.traceDelivery!=='on-demand'&&results?.experiment?.status==='completed'){autoPlay=false;if(!doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches)startPlayback()}const diff=$('[data-bw-diff]');diff.replaceChildren();for(const project of current().projects||[]){const row=doc.createElement('p'),state=buildingStateAtMonth(run,project,month);row.dataset.entityId=project.id;row.textContent=`${project.name} · Model entity ${project.id} · before intervention: absent → month ${month}: ${state.status}, ${state.completedUnits||0} completed homes, ${state.occupiedUnits||0} occupied homes`;diff.append(row)}if(!diff.children.length)diff.textContent='No approved building projects in this scenario.';const loading=run?.traceDelivery==='on-demand';futureMapping=illustrativeWorldMapping(loading?null:run,month);const scenario=current();root.dataset.traceState=loading?'loading':run?'loaded':'none';worldView.update({projects:previewState?.projects||(loading?[]:scenario.projects||[]),run:loading?null:run,month,worldVisuals:previewState?.worldVisuals||scenario.worldVisuals||{}});$('[data-bw-future-metrics]').textContent=futureMapping.recordedMonth===null?'':`Recorded month ${futureMapping.recordedMonth} · housing ${futureMapping.supply==null?'unavailable':Math.round(futureMapping.supply).toLocaleString()} · vacancy ${futureMapping.vacancyPercent==null?'unavailable':futureMapping.vacancyPercent.toFixed(2)+'%'}. Surrounding height/shade are illustrative supply/vacancy mappings, not additional modeled buildings.`;$('[data-bw-time]').textContent=String(month);$('[data-bw-month]').max=String(input.years*12);$('[data-bw-month]').value=String(month);$('[data-bw-simulate]').disabled=busy;if(new URLSearchParams(location.search).has('decisionRun')&&results?.experiment?.id&&run)$('[data-bw-link]').href=`/world/decision.html?experiment=${encodeURIComponent(results.experiment.id)}&run=${encodeURIComponent(run.id)}&month=${month}#futures`}
  function focusPlacement(location){if(!location||!controls?.target)return;const target=new THREE.Vector3(location.x,0,location.z);camera.position.add(target.clone().sub(controls.target));controls.target.copy(target);camera.lookAt(target);controls.update?.()}
  function focusProject(project){if(!project||!controls?.target)return;const target=new THREE.Vector3(project.location.x,Math.min(30,project.geometry.heightMeters/3),project.location.z);camera.position.add(target.clone().sub(controls.target));controls.target.copy(target);controls.update?.();worldView.selectProject(project.id)}
  function scenarioOptions(){const select=$('[data-bw-scenario]');select.replaceChildren(...input.scenarios.map(s=>{const option=doc.createElement('option');option.value=s.id;option.textContent=s.name;return option}));select.value=scenarioId}
  function hydrateSelectedRun(){
    const experimentId=results?.experiment?.id,runId=run?.id;
    if(!experimentId||!runId||run.traceDelivery!=='on-demand')return;
    traceCache.setExperiment(experimentId);
    const cached=traceCache.peek(experimentId,runId);if(cached){run=mergeRunTrace(run,cached);render();return}
    const key=`${experimentId}:${runId}`;if(pendingTrace===key)return;
    const token=++traceSelection;pendingTrace=key;announce(`Loading recorded monthly construction for ${runId}…`);
    traceCache.get(experimentId,runId).then(full=>{
      if(destroyed||token!==traceSelection||results?.experiment?.id!==experimentId||run?.id!==runId||!full)return;
      run=mergeRunTrace(run,full);root.dataset.traceLoadedRun=runId;render();
      announce(`Loaded stored future ${runId}, seed ${run.seed}, month ${month}. Construction uses the selected trace.`);
    }).catch(error=>{if(!destroyed&&token===traceSelection)announce(`Could not load recorded construction: ${error.message}`)}).finally(()=>{if(token===traceSelection)pendingTrace=null});
  }
  function runOptions({hydrate=true,preserveEmpty=false}={}){const select=$('[data-bw-run]'),rows=(results?.runs||[]).filter(r=>r.status==='completed'&&r.scenarioId===scenarioId);select.replaceChildren(...rows.map(r=>{const option=doc.createElement('option');option.value=r.id;option.textContent=`Seed ${r.seed} · ${r.id}`;return option}));const summary=preserveEmpty?null:rows.find(r=>r.id===run?.id)||rows[0]||null;const experimentId=results?.experiment?.id;traceCache.setExperiment(experimentId||null);run=summary?mergeRunTrace(summary,traceCache.peek(experimentId,summary.id)):null;if(run)select.value=run.id;$('[data-bw-runs]').hidden=!run;if(experimentId)$('[data-bw-link]').href=`/world/decision.html?experiment=${encodeURIComponent(experimentId)}`;if(hydrate)hydrateSelectedRun()}
  async function simulate(){if(busy)return;checkpointRestored=false;stop();busy=true;render();watcher?.destroy();announce('Creating reproducible construction experiment…');try{const created=await client.create(clone(input));if(destroyed)return;await client.start(created.experiment.id);watcher=client.watch(created.experiment.id,{onUpdate:next=>{if(destroyed||checkpointRestored)return;results=next;runOptions();render();const p=next.experiment.progress||{};announce(`${p.completed||0} / ${p.total||0} futures complete. Construction replay uses the selected future’s stored monthly states.`);if(['completed','cancelled','failed'].includes(next.experiment.status)){busy=false;render()}},onError:error=>{busy=false;announce(error.message);render()}})}catch(error){busy=false;announce(error.message);render()}}
  tools=mountWorldTools($('[data-bw-tools]'),{getInput:()=>clone(input),getScenarioId:()=>scenarioId,onInputChange:async(next,{rerun=false}={})=>{stop();const math=value=>JSON.stringify({scenarios:value.scenarios.map(({worldVisuals,...scenario})=>scenario),seed:value.seed,years:value.years,modelVersion:value.modelVersion});const mathChanged=math(input)!==math(next);if(mathChanged){watcher?.destroy();busy=false;traceSelection++;pendingTrace=null;traceCache.clear()}input=clone(next);input.metadata={...input.metadata,placementContext};previewState=null;if(mathChanged){run=null;results=null}persist();scenarioOptions();render();if(mathChanged)focusProject(current().projects?.at(-1));announce('Approved revision saved. Prior experiments remain unchanged. Simulate to update construction.');if(rerun){autoPlay=true;month=0;await simulate()}},onPreview:value=>{previewState=value?previewBuildingWorld(current(),value):null;render()},onPlaceRequest:proposal=>{root.open=false;focusPlacement(proposal.location);worldView.beginPlacement(proposal)},onCancelPreview:()=>{previewState=null;worldView.cancelPlacement();render()}});
  const wish=mountGroundWish({canvas:renderer.domElement,container,resolveGround:event=>{
    if(worldView.isPlacing)return null;
    const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hits=ray.intersectObjects(scene.children,true);
    if(hits[0]&&(hits[0].object.userData.b||hits[0].object.userData.contextBuilding||hits[0].object.userData.projectId))return null;
    const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
    if(!point)return null;const bounds=placementContext.bounds;
    if(point.x<(bounds.minX??bounds.min?.x)||point.x>(bounds.maxX??bounds.max?.x)||point.z<(bounds.minZ??bounds.min?.z)||point.z>(bounds.maxZ??bounds.max?.z))return null;
    return {x:Math.round(point.x),z:Math.round(point.z)};
  },onWish:({prompt,location})=>{root.open=true;tools.requestWish(prompt,selectionWithContext({kind:'district',id:'neighborhood',label:'Chosen ground',location}));}});
  $('.world-tools').classList.add('wt-compact');
  tools.setSelection(selectionWithContext({kind:'district',id:'neighborhood',label:'Current neighborhood',location:findBuildableLocation(createBuildingProposal(),placementContext)||{x:142,z:100}}));
  const handlers=[];const listen=(selector,event,fn)=>{const node=$(selector);node.addEventListener(event,fn);handlers.push(()=>node.removeEventListener(event,fn))};
  listen('[data-bw-scenario]','change',()=>{stop();scenarioId=$('[data-bw-scenario]').value;previewState=null;worldView.cancelPlacement();runOptions();tools.update();render()});
  listen('[data-bw-month]','input',()=>{stop();month=Number($('[data-bw-month]').value);render()});listen('[data-bw-simulate]','click',simulate);
  function startPlayback(){if(!run)return;if(month>=input.years*12)month=0;$('[data-bw-play]').textContent='Pause construction';timer=setInterval(()=>{month++;render();if(month>=input.years*12)stop()},180)}
  listen('[data-bw-play]','click',()=>{if(timer)return stop();if(!run){announce('Simulate approved projects before playing construction.');return}startPlayback()});
  listen('[data-bw-run]','change',()=>{stop();traceSelection++;pendingTrace=null;run=(results?.runs||[]).find(r=>r.id===$('[data-bw-run]').value)||null;hydrateSelectedRun();render()});
  scenarioOptions();render();
  const query=new URLSearchParams(location.search),requested=query.get('decisionExperiment');
  if(requested){client.results(requested).then(next=>{
    if(destroyed||checkpointRestored)return;results=next;input={...clone(next.experiment),metadata:{...next.experiment.metadata,placementContext}};
    const requestedId=query.get('decisionRun')||query.get('run'),requestedRun=requestedId?(next.runs||[]).find(r=>r.id===requestedId&&r.status==='completed'):null;
    if(requestedId&&!requestedRun){announce('The requested future is unavailable in this experiment. No substitute future was loaded.');return}
    scenarioId=requestedRun?.scenarioId||input.scenarios.find(s=>s.kind==='plan-a')?.id||input.scenarios[0].id;run=requestedRun;
    month=Math.max(0,Math.min(input.years*12,Math.round(Number(query.get('month'))||0)));
    scenarioOptions();runOptions();tools.update();render();focusProject(current().projects?.[0]);
    root.dataset.enteredFuture=run?.id||'';
    $('[data-bw-link]').textContent='Return to possible futures';
    $('[data-bw-link]').href=`/world/decision.html?experiment=${encodeURIComponent(requested)}&run=${encodeURIComponent(run?.id||'')}&month=${month}#futures`;
    $('[data-bw-link]').removeAttribute('target');
    announce(`Entered exact future ${run?.id||'none'}, seed ${run?.seed??'unknown'}, month ${month}. Construction uses stored states; the surrounding resident town is illustrative.`);
  }).catch(error=>announce(error.message))}
  async function captureCheckpoint(){
    // Hydrate only an already selected recorded run; never creates/starts a run.
    if(run?.traceDelivery==='on-demand'){const selectedId=run.id,experimentId=results?.experiment?.id;if(!experimentId)throw new Error('Selected construction trace has no experiment ID');const full=await traceCache.get(experimentId,selectedId);if(run?.id!==selectedId||results?.experiment?.id!==experimentId)throw new Error('Construction selection changed while saving; retry');run=mergeRunTrace(run,full);if(run.traceDelivery==='on-demand')throw new Error('Full selected construction trace is unavailable');}
    return createBuildingWorkspaceCheckpoint({input:clone(input),placementContext:clone(placementContext),scenarioId,results:clone(results),run:clone(run),month,previewState:clone(previewState),playing:!!timer,open:root.open,executionWasBusy:busy,draftCoverage:'Visible detached project preview is retained. Internal unsubmitted text fields and approval dialogs are not exposed by world-tools.'});
  }
  function restoreCheckpoint(data){
    const saved=validateBuildingWorkspaceCheckpoint(data,{placementContext});
    // Validate the complete detached payload before cancelling current activity.
    checkpointRestored=true;autoPlay=false;stop();watcher?.destroy();watcher=null;busy=false;traceSelection++;pendingTrace=null;traceCache.clear();worldView.cancelPlacement();
    input=clone(saved.input);scenarioId=saved.scenarioId;results=clone(saved.results);run=clone(saved.run);month=saved.month;previewState=clone(saved.previewState);root.open=saved.open;
    if(run&&results){const index=results.runs.findIndex(row=>row.id===run.id);results.runs[index]=clone(run);}
    scenarioOptions();runOptions({hydrate:false,preserveEmpty:saved.run===null});tools.update();render();persist();if(saved.playing&&run&&month<input.years*12)startPlayback();announce(`Restored saved construction future ${run?.id||'none'} at month ${month}. Stored project states are replayed; no simulation was rerun.`);return{scenarioId,runId:run?.id??null,month,playing:!!timer};
  }
  return {openWish(){root.open=true;$('[data-action="edit-world"]').click()},captureCheckpoint,restoreCheckpoint,get futureMapping(){return futureMapping},get worldVisuals(){return previewState?.worldVisuals||current().worldVisuals||{}},ready:worldView.ready,destroy(){wish.destroy();destroyed=true;traceSelection++;traceCache.clear();stop();hudObserver.disconnect();placementHUD.remove();watcher?.destroy();tools.destroy();worldView.destroy();for(const off of handlers)off();root.remove()}};
}
