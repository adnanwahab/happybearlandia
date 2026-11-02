// /world integration: resident/day simulation remains independent. Only the
// shared tools' explicit approval callback replaces input. Previews are detached
// ghost objects; results always come from the Decision API, never a local model.
import {attachBuildingWorld,previewBuildingWorld,findBuildableLocation,illustrativeWorldMapping} from './renderer.js';
import {createBuildingProposal} from './proposal.js';
import {mountWorldTools} from '../decision/world-tools.js';
import {housingModel,createHousingScenarios} from '../models/housing/index.js';
import {createDecisionClient,createRunTraceCache,mergeRunTrace} from '../decision/client.js';

export function mountWorldBuildingBridge({scene,camera,renderer,controls,town,THREE,container=document.body}={}) {
  const doc=container.ownerDocument,root=doc.createElement('details');root.className='bw-world-tools';root.dataset.testid='world-building-tools';
  root.innerHTML='<summary>+ Build something · ✦ Edit world</summary><p>Draft a physical project, approve it, then explore construction across possible futures.</p><div class="bw-bridge-controls"><label>Scenario <select data-bw-scenario aria-label="Building scenario"></select></label><button data-bw-simulate>Simulate projects</button></div><div class="bw-bridge-controls"><button data-bw-play>Play construction</button><label>Month <output data-bw-time>0</output></label><input data-bw-month type="range" min="0" max="120" step="1" value="0" aria-label="Construction month"></div><p data-bw-future-metrics class="bw-future-metrics"></p><div class="bw-bridge-status" role="status" aria-live="polite">No construction run selected. Approve a project, then simulate.</div><div data-bw-runs class="bw-bridge-controls" hidden><label>Future <select data-bw-run aria-label="Construction future"></select></label><a data-bw-link target="_blank" rel="noopener">Open exact experiment</a></div><div class="bw-selection" hidden></div><div data-bw-tools></div>';
  const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./buildings.css',import.meta.url).href;root.append(sheet);const toolSheet=doc.createElement('link');toolSheet.rel='stylesheet';toolSheet.href=new URL('../decision/world-tools.css',import.meta.url).href;root.append(toolSheet);container.append(root);
  const $=s=>root.querySelector(s),client=createDecisionClient(),clone=value=>structuredClone(value);
  const traceCache=createRunTraceCache({loadRun:(experimentId,runId)=>client.run(experimentId,runId),limit:2});let traceSelection=0,pendingTrace=null;
  const key=`hbl.world.buildings.v1:${new URLSearchParams(location.search).get('lat')||'default'}:${new URLSearchParams(location.search).get('lng')||'default'}`;
  const polygons=(town?.buildings||[]).filter(b=>Array.isArray(b.poly||b.polygon)).map(b=>({id:String(b.id),polygon:clone(b.poly||b.polygon)}));
  const placementContext={buildings:polygons,districts:clone(town?.districts||[]),bounds:town?.bounds||{minX:-1500,maxX:1500,minZ:-1500,maxZ:1500}};
  let input={schemaVersion:'decision-experiment.v1',name:'Neighborhood building experiment',decision:'Test a specific housing development in the neighborhood.',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:10,years:10,scenarios:createHousingScenarios(),metadata:{placementContext}};
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.modelVersion===housingModel.version&&Array.isArray(saved.scenarios))input={...saved,metadata:{...saved.metadata,placementContext}}}catch{}
  let scenarioId=input.scenarios.find(s=>s.kind==='plan-a')?.id||input.scenarios[0].id,results=null,run=null,month=0,previewState=null,timer=null,watcher=null,busy=false,destroyed=false,tools=null;
  let futureMapping=illustrativeWorldMapping(null);
  const current=()=>input.scenarios.find(s=>s.id===scenarioId)||input.scenarios[0];
  const announce=message=>{$('.bw-bridge-status').textContent=message};
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(input))}catch{announce('Browser storage unavailable; export or run the experiment to preserve this revision.')}};
  const selectionWithContext=selection=>({...selection,placementContext});
  const worldView=attachBuildingWorld({scene,camera,renderer,controls,town:{...town,...placementContext},THREE,panel:$('.bw-selection'),statusElement:$('.bw-bridge-status'),onPlace:proposal=>{root.open=true;tools?.setPlacement(proposal)},onCancel:()=>tools?.setPlacement(null),onSelect:selection=>{root.open=true;tools?.setSelection(selectionWithContext(selection))}});
  const placementHUD=doc.createElement('div');placementHUD.className='bw-placement-hud';placementHUD.setAttribute('role','status');placementHUD.hidden=true;container.append(placementHUD);
  const hudObserver=new MutationObserver(()=>{placementHUD.hidden=!worldView.isPlacing;placementHUD.textContent=$('.bw-bridge-status').textContent});hudObserver.observe($('.bw-bridge-status'),{childList:true,characterData:true,subtree:true});
  const stop=()=>{clearInterval(timer);timer=null;$('[data-bw-play]').textContent='Play construction'};
  function render(){const loading=run?.traceDelivery==='on-demand';futureMapping=illustrativeWorldMapping(loading?null:run,month);const scenario=current();root.dataset.traceState=loading?'loading':run?'loaded':'none';worldView.update({projects:previewState?.projects||(loading?[]:scenario.projects||[]),run:loading?null:run,month,worldVisuals:previewState?.worldVisuals||scenario.worldVisuals||{}});$('[data-bw-future-metrics]').textContent=futureMapping.recordedMonth===null?'':`Recorded month ${futureMapping.recordedMonth} · housing ${futureMapping.supply==null?'unavailable':Math.round(futureMapping.supply).toLocaleString()} · vacancy ${futureMapping.vacancyPercent==null?'unavailable':futureMapping.vacancyPercent.toFixed(2)+'%'}. Surrounding height/shade are illustrative supply/vacancy mappings, not additional modeled buildings.`;$('[data-bw-time]').textContent=String(month);$('[data-bw-month]').max=String(input.years*12);$('[data-bw-month]').value=String(month);$('[data-bw-simulate]').disabled=busy;if(new URLSearchParams(location.search).has('decisionRun')&&results?.experiment?.id&&run)$('[data-bw-link]').href=`/world/decision.html?experiment=${encodeURIComponent(results.experiment.id)}&run=${encodeURIComponent(run.id)}&month=${month}#futures`}
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
  function runOptions(){const select=$('[data-bw-run]'),rows=(results?.runs||[]).filter(r=>r.status==='completed'&&r.scenarioId===scenarioId);select.replaceChildren(...rows.map(r=>{const option=doc.createElement('option');option.value=r.id;option.textContent=`Seed ${r.seed} · ${r.id}`;return option}));const summary=rows.find(r=>r.id===run?.id)||rows[0]||null;const experimentId=results?.experiment?.id;traceCache.setExperiment(experimentId||null);run=summary?mergeRunTrace(summary,traceCache.peek(experimentId,summary.id)):null;if(run)select.value=run.id;$('[data-bw-runs]').hidden=!run;if(experimentId)$('[data-bw-link]').href=`/world/decision.html?experiment=${encodeURIComponent(experimentId)}`;hydrateSelectedRun()}
  async function simulate(){if(busy)return;stop();busy=true;render();watcher?.destroy();announce('Creating reproducible construction experiment…');try{const created=await client.create(clone(input));if(destroyed)return;await client.start(created.experiment.id);watcher=client.watch(created.experiment.id,{onUpdate:next=>{if(destroyed)return;results=next;runOptions();render();const p=next.experiment.progress||{};announce(`${p.completed||0} / ${p.total||0} futures complete. Construction replay uses the selected future’s stored monthly states.`);if(['completed','cancelled','failed'].includes(next.experiment.status)){busy=false;render()}},onError:error=>{busy=false;announce(error.message);render()}})}catch(error){busy=false;announce(error.message);render()}}
  tools=mountWorldTools($('[data-bw-tools]'),{getInput:()=>clone(input),getScenarioId:()=>scenarioId,onInputChange:async(next,{rerun=false}={})=>{stop();const math=value=>JSON.stringify({scenarios:value.scenarios.map(({worldVisuals,...scenario})=>scenario),seed:value.seed,years:value.years,modelVersion:value.modelVersion});const mathChanged=math(input)!==math(next);if(mathChanged){watcher?.destroy();busy=false;traceSelection++;pendingTrace=null;traceCache.clear()}input=clone(next);input.metadata={...input.metadata,placementContext};previewState=null;if(mathChanged){run=null;results=null}persist();scenarioOptions();render();if(mathChanged)focusProject(current().projects?.at(-1));announce('Approved revision saved. Prior experiments remain unchanged. Simulate to update construction.');if(rerun)await simulate()},onPreview:value=>{previewState=value?previewBuildingWorld(current(),value):null;render()},onPlaceRequest:proposal=>{root.open=false;focusPlacement(proposal.location);worldView.beginPlacement(proposal)},onCancelPreview:()=>{previewState=null;worldView.cancelPlacement();render()}});
  $('.world-tools').classList.add('wt-compact');
  tools.setSelection(selectionWithContext({kind:'district',id:'neighborhood',label:'Current neighborhood',location:findBuildableLocation(createBuildingProposal(),placementContext)||{x:142,z:100}}));
  const handlers=[];const listen=(selector,event,fn)=>{const node=$(selector);node.addEventListener(event,fn);handlers.push(()=>node.removeEventListener(event,fn))};
  listen('[data-bw-scenario]','change',()=>{stop();scenarioId=$('[data-bw-scenario]').value;previewState=null;worldView.cancelPlacement();runOptions();tools.update();render()});
  listen('[data-bw-month]','input',()=>{stop();month=Number($('[data-bw-month]').value);render()});listen('[data-bw-simulate]','click',simulate);
  listen('[data-bw-play]','click',()=>{if(timer)return stop();if(!run){announce('Simulate approved projects before playing construction.');return}if(month>=input.years*12)month=0;$('[data-bw-play]').textContent='Pause construction';timer=setInterval(()=>{month++;render();if(month>=input.years*12)stop()},180)});
  listen('[data-bw-run]','change',()=>{stop();traceSelection++;pendingTrace=null;run=(results?.runs||[]).find(r=>r.id===$('[data-bw-run]').value)||null;hydrateSelectedRun();render()});
  scenarioOptions();render();
  const query=new URLSearchParams(location.search),requested=query.get('decisionExperiment');
  if(requested){client.results(requested).then(next=>{
    if(destroyed)return;results=next;input={...clone(next.experiment),metadata:{...next.experiment.metadata,placementContext}};
    const requestedId=query.get('decisionRun')||query.get('run'),requestedRun=requestedId?(next.runs||[]).find(r=>r.id===requestedId&&r.status==='completed'):null;
    if(requestedId&&!requestedRun){announce('The requested future is unavailable in this experiment. No substitute future was loaded.');return}
    scenarioId=requestedRun?.scenarioId||input.scenarios.find(s=>s.kind==='plan-a')?.id||input.scenarios[0].id;run=requestedRun;
    month=Math.max(0,Math.min(input.years*12,Math.round(Number(query.get('month'))||0)));
    scenarioOptions();runOptions();tools.update();render();focusProject(current().projects?.[0]);
    root.dataset.enteredFuture=run?.id||'';
    $('[data-bw-link]').textContent='Return to possible futures';
    $('[data-bw-link]').href=`/world/decision.html?experiment=${encodeURIComponent(requested)}&run=${encodeURIComponent(run?.id||'')}&month=${month}#futures`;
    $('[data-bw-link]').removeAttribute('target');root.open=true;
    announce(`Entered exact future ${run?.id||'none'}, seed ${run?.seed??'unknown'}, month ${month}. Construction uses stored states; the surrounding resident town is illustrative.`);
  }).catch(error=>announce(error.message))}
  return {get futureMapping(){return futureMapping},get worldVisuals(){return previewState?.worldVisuals||current().worldVisuals||{}},ready:worldView.ready,destroy(){destroyed=true;traceSelection++;traceCache.clear();stop();hudObserver.disconnect();placementHUD.remove();watcher?.destroy();tools.destroy();worldView.destroy();for(const off of handlers)off();root.remove()}};
}
