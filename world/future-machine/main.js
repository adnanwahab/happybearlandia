import {mountLedger} from './butterfly-ledger.js';
import {downloadShareCard} from './share/card.js';
import { decomposeRent, renderRentDecomposition } from './rent-decomposition.js';
import {selectMoments} from './story/game-director.js';
import {renderMoments} from './story/moment-narrative.js';
import {mountReplayReceipt} from './ui/replay-receipt.js';
import {replayRunReceipt} from './share/run-receipt.js';
import {readRecent, saveRecent, clearRecent} from './recent.js';
import {createFirstPlayFunnel, visibleDivergence} from './first-play.js';
import {createDiscoveryQuest, mountDiscoveryQuest} from './ui/discovery-quest.js';
import {bindYearShortcuts} from './ui/year-shortcuts.js';
import {describeModelChange, mountChangeNarration} from './story/narration.js';
import {mountDiagnosticReport} from './diagnostics.js';
import {renderEvidenceTrail} from './story/evidence-trail-view.js';
import { constructionReceipts, metricChangeStops } from './evidence.js';
import { createDemoController } from './demo-controller.js';
import { DEFAULT_RECIPE, MONTHS, assertMonth } from './contracts.js';
import { createExperiment, loadExperiment, getFrame, validateRecipe } from './data/index.js';
import { compareHistory, firstDivergence } from './diff/index.js';
import { createStage } from './scene/index.js';
import {createOutcomeTimeline} from './ui/outcome-timeline.js';
import { createUI } from './ui/index.js';
import { buildStory, describeSelection, renderStory } from './story/index.js';
import { createShareURL, parseShareURL, createEvidenceReport, assertHistoryIdentity, validateLanding } from './share/index.js';

import { createChallengeCards } from './ui/challenges.js';
import { parseChallengeURL, verifyChallengeHistory } from './share/challenges.js';

const app=document.querySelector('#app');
let inspectorEntity=null,inspectorMetric=null,outcomeTimeline=null,trailAnchor=null,trailView=null,momentsDispose=()=>{},lastAttempt=null;
const funnel=createFirstPlayFunnel({renderer:()=>stage?.getStats().backend});
let landingEntry='direct';
try{if(parseShareURL(location.href))landingEntry='shared';}catch{/* The normal startup path presents invalid links. */}
function recordMilestone(type,payload){return funnel.record(type,payload,{deferUntilReady:true});}
function recordLanding(){if(disposed)return;recordMilestone('landing',{entry:landingEntry});}
function firstInput(control){recordLanding();recordMilestone('first_input',{control});}
function recordVisibleDivergence(){if(!['ready','error'].includes(state.status))return;const facts=visibleDivergence(history,diffs,state.month);if(facts)recordMilestone('first_divergence',{facts});}
let originalRecipe=structuredClone(DEFAULT_RECIPE);
let history=null,diffs=[],story=null,stage=null,storyDispose=()=>{},request=null,playTimer=null,disposed=false;
let state={status:'idle',message:'Fork the same city. Change one decision. Watch ten modeled years.',recipe:structuredClone(DEFAULT_RECIPE),month:0,playing:false,mode:'split',ghosts:true,autoCamera:true,experimentId:null,shareURL:null,error:null};
let remembering=false;
const stats={startedAt:performance.now(),readyMs:null,runMs:null,evidenceTrailBuilds:0};
app.replaceChildren();
const ui=createUI(app,{onRetry:async()=>{if(!lastAttempt)return;takeover();try{await run(...lastAttempt);}catch{/* run already presents strict receipt errors. */}},onRun:recipe=>{firstInput('policy');takeover();return run(recipe,null,0,{userRun:true});},onConfigure:configure,onReset:resetConfiguration,onCancel:cancel,onMonth:manualMonth,onPlay:manualPlay,onDemo:()=>{firstInput('playback');return playDemo();},onAutoCamera(value){firstInput('scenario');state.autoCamera=value;stage?.cancelCamera?.();update();},onDemoPause:()=>{firstInput('playback');director.togglePause();},onDemoManual:()=>{firstInput('playback');takeover();},onDemoSkip:()=>{firstInput('playback');director.skip();},onMetric:explainMetric,onMode(mode){firstInput('scenario');takeover();state.mode=mode;stage?.setMode(mode);update();},onGhosts(value){firstInput('scenario');takeover();state.ghosts=value;stage?.setGhosts(value);update();},onFirstConstruction:()=>jump(state.firstConstruction),onDirector:direct,onShare:share,onPreviewShare:previewShare,onCopyShare:copyShare,onBrowserShare:typeof navigator.share==='function'?browserShare:undefined,onExport:exportReport,onRemember:remember,onClearRecent:resetRecent,onCard:()=>downloadShareCard(history,state.month)});
const receiptUI=mountReplayReceipt(app,{getContext:()=>({history,month:state.month}),onReopen:input=>{takeover();return run(null,null,0,{receiptInput:input});}});
const quest=createDiscoveryQuest();
const questView=mountDiscoveryQuest(app,{onVisit(){const stop=quest.state.stop;if(stop)manualMonth(stop.month);},onInspect(){const stop=quest.state.stop;if(stop){if(state.month!==stop.month)manualMonth(stop.month);select(stop.entity);}}});
ui.stageElement.before(app.querySelector('.fm-quest'));
const removeYearShortcuts=bindYearShortcuts(ui.stageElement,{getState:()=>state,getDiffs:()=>diffs,onMonth:manualMonth,onMissing(){state.message='No recorded divergence in this comparison.';update();}});
const narration=mountChangeNarration(app);
const outcomeHost=document.createElement("div");ui.stageElement.after(outcomeHost);
const diagnostic=mountDiagnosticReport(app);
const momentsHost=document.createElement('div');outcomeHost.after(momentsHost);
const challenges=createChallengeCards(app.querySelector('.fm-ui'),{getContext:()=>({history,month:state.month})});
stage=createStage(ui.stageElement,{onSelect:select,onCameraInteraction:stopCameraTour});
stage.setMode(state.mode);stage.setGhosts(state.ghosts);
stage.whenReady().then(recordLanding);

// Guided presentation changes the selected recorded frame, never the simulation.
let demoGeneration=0,linkGeneration=0;
const director=createDemoController({onMonth:month=>{if(month!==state.month)setMonth(month);},onShot(stop){if(state.autoCamera)stage.focus(stop.entity,{animate:true,scale:stop.scale});},onHighlight(stop){showStory(withContext(entityDescription(stop.entity)));},onExplain(){if(!state.demoExplained){state.demoExplained=true;explainMetric('homes',false);}},onState(demo){const previous=state.demo;const inventory=stage?.getStats().backend==='inventory-fallback';state.demo={...demo,caption:inventory?`Inventory mode · ${demo.caption||'Explore the recorded comparison.'}`:demo.caption};if(demo.paused||demo.status==='complete'||demo.status==='manual'||(previous?.status==='playing'&&demo.status==='idle')){stage?.cancelCamera?.();updateURL();outcomeTimeline?.update(state.month,{announce:true});}update();}});
function takeover(){demoGeneration++;stage?.cancelCamera?.();director.takeover();setPlaying(false);}
function manualMonth(month){firstInput('timeline');takeover();setMonth(month,{reanchor:true});quest.visit(state.month);outcomeTimeline?.update(state.month,{announce:true});updateURL();update();}
function manualPlay(value){firstInput('playback');takeover();setPlaying(value);}
function stopCameraTour(){firstInput('scenario');takeover();}
function withContext(description){return {...description,summary:`${description.summary} Run ${history?.experimentId??'unavailable'} · ${history?.modelVersion??'unavailable'} · seed ${history?.seed??'unavailable'} · Month ${state.month}. Intervention: ${history?.recipe.intervention?`${history.recipe.intervention.type}, proposed amount ${history.recipe.intervention.amount}, district ${history.recipe.intervention.districtId}, ${history.recipe.intervention.cost.toLocaleString('en-US')} illustrative USD`:'none (matched control)'}.`,limitations:[...(description.limitations||[]),'Synthetic, uncalibrated City model; a controlled model contrast is not empirical causal certainty.']};}
function entityDescription(entity){const detail=describeSelection(frame(),diffs[state.month],entity);const receipts=constructionReceipts(history,entity,state.month);return {...detail,entity:{collection:entity.collection,id:entity.id,...(entity.arm?{arm:entity.arm}:{})},evidence:[...detail.evidence,...receipts],summary:detail.summary.replace('No matching entity event was supplied.',receipts.length?'No new event at the selected month; historical completion evidence follows.':'No matching entity event was supplied.')+(receipts.length?` Recorded construction completion at Month ${receipts[0].month} created ${receipts[0].payload.units} homes under ${receipts[0].policyId}; exact model-owned building/project relationship.`:'')};}
async function playDemo(){
 const generation=++demoGeneration;
 director.prepare();state.demoExplained=false;setPlaying(false);
 if(state.status==='loading'||!history||JSON.stringify(history.recipe)!==JSON.stringify(DEFAULT_RECIPE))await run(structuredClone(DEFAULT_RECIPE),null,0,{demoRun:true});
 if(generation!==demoGeneration||disposed)return;
 if(!history||state.status!=='ready'||JSON.stringify(history.recipe)!==JSON.stringify(DEFAULT_RECIPE)){director.stop();return;}
 const activeStage=stage;await activeStage.whenReady();
 if(generation!==demoGeneration||disposed||stage!==activeStage||state.status!=='ready')return;
 state.mode='split';stage.setMode('split');if(state.autoCamera)stage.resetCamera();
 recordLanding();recordMilestone('demo_start',{mode:'fresh'});
 director.start(firstDivergence(history,diffs),{paused:director.getState().paused});director.setHidden(document.hidden);
}
function explainMetric(key,stop=true,{preserveTrail=false}={}){
  if(!history)return;
  if(stop){firstInput('scenario');takeover();}
  const source={homes:'housingUnits',commute:'meanTravelMinutes',rent:'meanRent',spending:'capitalSpending'}[key]||key;
  const metric=diffs[state.month]?.metrics?.[source];
  const stops=metricChangeStops(history,diffs[state.month],source);
  showStory(withContext({metricKey:source,title:`WHY · ${source} · Month ${state.month}`,stops,evidence:[],
    summary:`WITHOUT PLAN ${metric?.baseline??'unavailable'}; WITH PLAN ${metric?.plan??'unavailable'}; delta ${metric?.delta??'unavailable'} ${metric?.unit??''}. ${stops.length?'Select a recorded housing completion to inspect its exact building and event month.':'Unsupported entity causality: no verified metric-to-entity event link is available. No entity selected.'} Housing supply changes when the City construction model completes a funded project; entitlement alone does not create homes. Mean rent covers all recorded units, not incumbent savings. Link travel time is a coarse modeled network mean, not individual commute. Spending is cumulative recorded capital expense.`,
    limitations:['Related events alone do not establish the cause of an aggregate A/B difference.']}),{preserveTrail});
  const diff=diffs[state.month];if(diff?.available&&(diff.changedCount>0||Object.values(diff.metrics).some(metric=>Number.isFinite(metric.delta)&&metric.delta!==0)))recordMilestone('why_opened',{target:'recorded-divergence'});
  const clean=mountLedger(ui.storyElement,history,{month:state.month,metric:source});const previous=storyDispose;storyDispose=()=>{clean();previous();};
}

function resetConfiguration(){if(['loading','running','queued'].includes(state.status))return;firstInput('policy');state.recipe=structuredClone(originalRecipe);state.error=null;state.message='Original seed and policy restored. Displayed results, evidence and share link are unchanged. Click Fork City to rerun.';update();}
function configure(recipe){try{state.recipe=validateRecipe(recipe);firstInput('policy');state.error=null;state.message=history?`Next run: ${state.recipe.intervention ? `${state.recipe.intervention.amount} proposed ${state.recipe.intervention.type} units` : 'no intervention'} · seed ${state.recipe.seed}. Fork City reruns from that seed’s initial conditions. Displayed comparison and shared link still refer to run ${history.experimentId}.`:`Configured seed ${state.recipe.seed}. Fork City runs two matched futures.`;update();}catch(error){state.error=error.message;update();}}
let updateFrame=null;
function update(){if(!disposed&&updateFrame===null)updateFrame=requestAnimationFrame(()=>{updateFrame=null;if(!disposed){ui.update({...state,originalRecipe,canRetry:Boolean(lastAttempt),comparisonRecipe:history?.recipe ?? null,comparisonInitial:history?.baseline?.[0]?.state ?? null});questView.update(quest.state,!!history&&['ready','error'].includes(state.status));challenges.update(state);receiptUI.update({history,month:state.month,ready:state.status==='ready'});outcomeTimeline?.update(state.month);}});}
function visibilityChanged(){director.setHidden(document.hidden);}
document.addEventListener('visibilitychange',visibilityChanged);
function cancel(){linkGeneration++;demoGeneration++;director.stop();request?.abort();request=null;setPlaying(false);state.status=history?'ready':'idle';state.error=null;state.message='Run cancelled. Any completed comparison remains available.';update();}
function frame(){return history?getFrame(history,state.month):null;}
function showStory(description,{preserveTrail=false}={}){
 storyDispose();
 const host=document.createElement('div');
 ui.storyElement.prepend(host);
 const clean=renderStory(host,description,{onJump:jump,onNarrate:description.entity?()=>narration.announce(`${describeModelChange(frame(),diffs[state.month],description.entity)} Run ${history?.experimentId??'unavailable'}; model ${history?.modelVersion??'unavailable'}; seed ${history?.seed??'unavailable'}.`):undefined})||(()=>{});
 const entity=description.entity;
 inspectorMetric=description.metricKey??null;
 inspectorEntity=inspectorMetric?null:entity??null;
 if(inspectorMetric==='meanRent')renderRentDecomposition(host,decomposeRent(frame()));
 storyDispose=()=>{clean();host.remove();};
 const anchor=history&&entity?.id?{collection:entity.collection,id:entity.id,month:state.month}:null;
 if(!preserveTrail&&JSON.stringify(anchor)!==JSON.stringify(trailAnchor)){
  trailView?.();trailView=null;trailAnchor=anchor;
  if(anchor){stats.evidenceTrailBuilds++;trailView=renderEvidenceTrail(ui.storyElement,history,anchor,{onJump:jumpTrail,onReturn:returnToTrail});}
 }
 trailView?.update(state.month);
}
function jumpTrail(stop){
 if(!trailAnchor)return;
 takeover();setMonth(stop.month);outcomeTimeline?.update(state.month,{announce:true});updateURL();update();
 const located=stop.entity?stage.focus(stop.entity):false;
 trailView?.update(state.month,stop.nodeId,Boolean(stop.entity&&!located));
}
function returnToTrail(){if(!trailAnchor)return;takeover();setMonth(trailAnchor.month);outcomeTimeline?.update(state.month,{announce:true});updateURL();update();stage.focus(trailAnchor);trailView?.update(state.month);}
function recentFailure(error){state.recentMessage=`Local continuation unavailable: ${error.message}. Clear the saved comparison or start a new run.`;}
function persistRecent(){
  if(!remembering||!history)return;
  try{saveRecent(window.localStorage,{recipe:history.recipe,experimentId:history.experimentId,month:state.month});state.recentMessage='Continuing is enabled on this browser. Recipe and selected month saved locally.';}
  catch(error){remembering=false;recentFailure(error);}
  state.remembering=remembering;
}
function remember(){if(!history||state.status!=='ready')return;remembering=true;persistRecent();update();}
function resetRecent(){
  remembering=false;state.remembering=false;
  try{clearRecent(window.localStorage);state.recentMessage='Saved comparison cleared. Local continuation is off.';}
  catch(error){state.recentMessage=`Could not clear local continuation: ${error.message}. Browser storage must be available to remove the saved reference. Continuing is off for this visit.`;}
  update();
}
function landingContext(){
 const backend=stage?.getStats?.().backend,pose=stage?.getCamera?.();
 const camera=['webgpu','webgl'].includes(backend)&&pose?.position&&pose?.target?{position:pose.position,target:pose.target}:backend==='canvas2d'&&pose?{x:pose.x,z:pose.z,zoom:pose.zoom}:null;
 const context={version:1,mode:state.mode,ghosts:state.ghosts,camera};
 try{return validateLanding(context);}catch{return validateLanding({...context,camera:null});}
}
function updateURL(){if(!history)return;state.shareURL=createShareURL({recipe:history.recipe,experimentId:history.experimentId,month:state.month,landing:landingContext()},location.href.split('#')[0]);if(state.challengeHash&&state.month===state.challengeMonth)state.shareURL+=state.challengeHash;if(location.href!==state.shareURL)try{window.history.replaceState(null,'',state.shareURL);}catch{state.message='Comparison link is ready to share; the browser could not update the address bar.';}persistRecent();}
function setMonth(month,{reanchor=false}={}){try{state.month=assertMonth(Number(month));if(history){state.frame=frame();state.diff=diffs[state.month];stage.update(state.frame,state.diff);if(inspectorMetric)explainMetric(inspectorMetric,false,{preserveTrail:!reanchor});else if(inspectorEntity&&reanchor)showStory(withContext(entityDescription(inspectorEntity)));else trailView?.update(state.month);}recordVisibleDivergence();update();}catch(error){state.error=error.message;update();}}
function setPlaying(value){const wasPlaying=state.playing;clearInterval(playTimer);playTimer=null;state.playing=Boolean(value&&history);if(state.playing){if(state.month===MONTHS)setMonth(0);playTimer=setInterval(()=>{if(state.month>=MONTHS)return setPlaying(false);setMonth(state.month+1);},200);}else{updateURL();if(wasPlaying)outcomeTimeline?.update(state.month,{announce:true});}update();}
function select(entity){if(!history)return;quest.inspect(state.month,entity);update();firstInput('scenario');takeover();stage.focus(entity);showStory(withContext(entityDescription(entity)));if(constructionReceipts(history,entity,state.month).length)recordMilestone('why_opened',{target:'recorded-event'});}
function jump(stop){if(!history||!stop)return;firstInput('scenario');takeover();setMonth(stop.month);quest.visit(state.month);update();outcomeTimeline?.update(state.month,{announce:true});updateURL();const located=stop.entity?stage.focus(stop.entity):false;const detail=stop.entity?entityDescription(stop.entity):stop;showStory(withContext({...stop,...detail,title:stop.title??detail.title,entity:stop.entity,evidence:stop.evidence?.length?stop.evidence:detail.evidence,summary:`${detail.summary}${stop.entity&&!located?' No unambiguous scene mapping for this entity; camera unchanged.':''}`,limitations:story.limitations}));if((stop.evidence?.length??detail.evidence?.length)>0)recordMilestone('why_opened',{target:'recorded-event'});}
function direct(){if(!story)return;firstInput('scenario');takeover();const physical=(story.stops||[]).filter(stop=>stop.entity?.collection==='buildings');const stops=physical.length?physical:story.stops||[];const next=stops.find(stop=>stop.month>state.month)||stops[0];if(next)jump(next);else showStory(story);}
async function run(recipe=state.recipe,savedId=null,selectedMonth=0,{demoRun=false,userRun=false,receiptInput=null,challenge=null,challengeHash=null,entry=null,landing=null}={}){
  diagnostic.clear();state.sharePreview=null;
  linkGeneration++;
  lastAttempt=[structuredClone(recipe),savedId,selectedMonth,{receiptInput:receiptInput?structuredClone(receiptInput):null,challenge:challenge?structuredClone(challenge):null,challengeHash,entry,userRun,landing:landing?structuredClone(landing):null}];
  if(!demoRun)director.stop();
  storyDispose();
  request?.abort();request=new AbortController();const current=request;const start=performance.now();
  setPlaying(false);state={...state,status:'loading',error:null,message:savedId?'Opening saved experiment…':'Running paired 120-month futures…',shareURL:null,challengeQuestion:null,challengeHash:null};update();
  const options={signal:current.signal,onProgress(progress){if(request!==current)return;state.message=progress.message||progress.status;update();}};
  try{
    let loaded;let fallback=false;
    if(receiptInput){const reopened=await replayRunReceipt(receiptInput,options);loaded=reopened.history;selectedMonth=reopened.month;recipe=loaded.recipe;savedId=loaded.experimentId;}
    recipe=validateRecipe(recipe);
    if(receiptInput){/* Strict receipt replay already verified above. */}
    else if(savedId){try{loaded=await loadExperiment(savedId,options);}catch(error){if(challenge||current.signal.aborted||!/not found/i.test(error.message))throw error;fallback=true;state.message=`Saved experiment unavailable (${error.message}). Recomputing the bounded shared recipe.`;update();loaded=await createExperiment(recipe,options);loaded={...loaded,provenance:{...loaded.provenance,shareFallback:'Saved record unavailable; recomputed from recipe.'}};}}
    else loaded=await createExperiment(recipe,options);
    if(disposed||request!==current){if(receiptInput)throw new Error('Receipt replay cancelled or superseded.');return;}
    assertHistoryIdentity(loaded,{recipe,experimentId:fallback?null:savedId});
    if(challenge)await verifyChallengeHistory(loaded,challenge);
    if(disposed||request!==current)return;
    state.challengeQuestion=challenge?.question??null;state.challengeHash=challenge?challengeHash:null;state.challengeMonth=challenge?.month;
    if(landing){state.mode=landing.mode;state.ghosts=landing.ghosts;}
    stage.dispose();stage=createStage(ui.stageElement,{onSelect:select,onCameraInteraction:stopCameraTour,history:loaded});stage.setMode(state.mode);stage.setGhosts(state.ghosts);
    trailView?.();trailView=null;trailAnchor=null;inspectorEntity=null;inspectorMetric=null;outcomeTimeline?.dispose();outcomeTimeline=createOutcomeTimeline(outcomeHost,{history:loaded,onMonth:manualMonth});
    history=loaded;momentsDispose();momentsDispose=renderMoments(momentsHost,selectMoments(history),{onJump:jump});diffs=compareHistory(history);quest.reset(diffs,{userRun});
    // A physical difference alone does not establish a construction event.
    const first=firstDivergence(history,diffs);
    state.firstConstruction=first&&constructionReceipts(history,first.entity,first.month).some(receipt=>receipt.month===first.month)?first:null;
    story=buildStory(history,diffs);story.limitations.push(...(history.baseline[0].state.provenance.assumptions||[]));stats.runMs=performance.now()-start;
    state={...state,status:'ready',recipe:history.recipe,provenance:{seed:history.seed,modelVersion:history.modelVersion,experimentId:history.experimentId},experimentId:history.experimentId,message:`${fallback?'Saved record unavailable; reran the versioned recipe. ':''}120 months complete · detailed states recomputed from the saved monthly City manifest. Synthetic, uncalibrated model.`,error:null};
    state.message+= ' Inventory ready; graphics loading in the background.';
    setMonth(selectedMonth);outcomeTimeline?.update(state.month,{announce:true});updateURL();showStory(withContext(story));stats.readyMs=performance.now()-stats.startedAt;
    const activeStage=stage,cameraGeneration=demoGeneration;
    void activeStage.whenReady().then(()=>{if(disposed||stage!==activeStage)return;recordLanding();if(request!==current)return;const cameraRestored=!landing?.camera||cameraGeneration!==demoGeneration||activeStage.setCamera(landing.camera);updateURL();recordMilestone('demo_start',{mode:savedId&&!fallback?'saved':'fresh'});if(entry)recordMilestone('return',{entry});recordVisibleDivergence();state.message=`${cameraRestored?'':'Shared camera unavailable in this renderer; showing default framing. '}${fallback?'Saved record unavailable; recomputed from the versioned recipe. ':''}120 recorded months ready · ${activeStage.getStats().backend} · Synthetic monthly City model.`;update();});
  }catch(error){if(request!==current||disposed){if(receiptInput)throw error;return;}state.status='error';state.error=error.message;state.message=history?'The new comparison could not be opened. The previous completed run remains displayed. Check your connection and Retry comparison.':'The comparison could not be opened. Check your connection and Retry comparison.';update();diagnostic.show({errorType:'comparison-failure',renderer:stage?.getStats?.().backend});if(receiptInput)throw error;}
}
async function transferLink(native=false,{url:previewURL=null}={}){
  if(!history||!['ready','error'].includes(state.status)||state.shareBusy)return;
  if(!previewURL)updateURL();const url=previewURL??state.shareURL;state.shareBusy=true;state.message=native?'Opening browser sharing…':'Copying comparison link…';update();
  let message;
  try{
    if(native){await navigator.share({title:'One City, Two Futures',url});recordMilestone('share',{method:'native',result:'succeeded'});message='Comparison shared.';}
    else {await navigator.clipboard.writeText(url);recordMilestone('share',{method:'copy',result:'succeeded'});message=previewURL?'Previewed comparison link copied.':'Comparison link copied. It includes the versioned recipe, saved experiment and selected month.';}
  }catch(error){recordMilestone('share',{method:native?'native':'copy',result:native&&error?.name==='AbortError'?'canceled':'failed'});message=native?(error?.name==='AbortError'?'Sharing cancelled. You can still copy the comparison link.':'Browser sharing failed. Use Copy comparison link or select the Comparison URL below.'):previewURL?'Copy unavailable. Open the previewed comparison link and copy its address.':'Could not copy automatically. Select the Comparison URL below and copy it, or try Copy comparison link again.';}
  finally{state.shareBusy=false;if(!disposed&&['ready','error'].includes(state.status))state.message=(previewURL?state.sharePreview?.url===url:state.shareURL===url)?message:'Comparison changed. Copy or share its current link.';update();}
}
function share(){return transferLink();}
function browserShare(){return transferLink(true);}
function previewShare(){
  if(!history||!['ready','error'].includes(state.status))return;
  takeover();updateURL();
  state.sharePreview={url:state.shareURL,context:parseShareURL(state.shareURL)};
  state.message='Review the displayed comparison before copying. Next-run edits are excluded.';update();
}
function copyShare(){const preview=state.sharePreview;return preview?transferLink(false,{url:preview.url}):undefined;}
function exportReport(){if(!history)return;const report=createEvidenceReport(history,{month:state.month,diff:diffs[state.month],story});const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='future-machine-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dispose(){if(disposed)return;persistRecent();disposed=true;if(updateFrame!==null)cancelAnimationFrame(updateFrame);document.removeEventListener('visibilitychange',visibilityChanged);request?.abort();removeYearShortcuts();clearInterval(playTimer);storyDispose();narration.dispose();momentsDispose();trailView?.();outcomeTimeline?.dispose();stage?.dispose();receiptUI.dispose();questView.dispose();ui.dispose();diagnostic.dispose();challenges.dispose();director.dispose();funnel.dispose();history=null;diffs=[];story=null;state.frame=null;state.diff=null;window.removeEventListener('pagehide',dispose);}
window.addEventListener('pagehide',dispose);
window.addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
// Read-only diagnostics for local resource measurements and integration checks.
window.futureMachine={get firstPlayEvents(){return funnel.snapshot();},get history(){return history;},get state(){return {...state};},get stats(){return {...stats,scene:stage?.getStats?.()};},dispose};
update();
async function openLink(){
 const generation=linkGeneration,entryURL=location.href;
 try{
  let recent=null;
  try{recent=readRecent(window.localStorage);remembering=!!recent;state.remembering=remembering;if(recent){if(landingEntry==='direct')landingEntry='internal';state.recentMessage='Opening your locally saved comparison…';}}
  catch(error){recentFailure(error);}
  const challenge=await parseChallengeURL(entryURL);
  if(disposed||generation!==linkGeneration)return;
  const context=challenge||parseShareURL(entryURL);if(context)originalRecipe=structuredClone(context.recipe);update();
  if(context)await run(context.recipe,context.experimentId,context.month,{challenge,challengeHash:challenge?new URL(entryURL).hash:null,entry:'shared',landing:context.landing??null});
  else if(new URL(entryURL).searchParams.get('demo')==='1')void playDemo();
  else if(recent){originalRecipe=structuredClone(recent.recipe);await run(recent.recipe,recent.experimentId,recent.month,{entry:'resume'});}
 }catch(error){if(disposed||generation!==linkGeneration)return;state.status='error';state.error=`Invalid shared comparison: ${error.message}`;state.message='Use Fork City to start a valid bounded comparison.';update();diagnostic.show({errorType:'invalid-share',renderer:stage?.getStats?.().backend});}
}
void openLink();
