import {renderEvidenceTrail} from './story/evidence-trail-view.js';
import { constructionReceipts } from './evidence.js';
import { createDemoController } from './demo-controller.js';
import { DEFAULT_RECIPE, MONTHS, assertMonth } from './contracts.js';
import { createExperiment, loadExperiment, getFrame, validateRecipe } from './data/index.js';
import { compareHistory } from './diff/index.js';
import { createStage } from './scene/index.js';
import {createOutcomeTimeline} from './ui/outcome-timeline.js';
import { createUI } from './ui/index.js';
import { buildStory, describeSelection, renderStory } from './story/index.js';
import { createShareURL, parseShareURL, createEvidenceReport, assertHistoryIdentity } from './share/index.js';

const app=document.querySelector('#app');
let inspectorEntity=null,outcomeTimeline=null,lastAttempt=null;
let history=null,diffs=[],story=null,stage=null,storyDispose=()=>{},request=null,playTimer=null,disposed=false;
let state={status:'idle',message:'Fork the same city. Change one decision. Watch ten modeled years.',recipe:structuredClone(DEFAULT_RECIPE),month:0,playing:false,mode:'split',ghosts:true,experimentId:null,shareURL:null,error:null};
const stats={startedAt:performance.now(),readyMs:null,runMs:null};
app.replaceChildren();
const ui=createUI(app,{onRetry:()=>lastAttempt&&run(...lastAttempt),onRun:run,onConfigure:configure,onCancel:cancel,onMonth:manualMonth,onPlay:manualPlay,onDemo:playDemo,onDemoPause:()=>director.togglePause(),onMetric:explainMetric,onMode(mode){state.mode=mode;stage?.setMode(mode);update();},onGhosts(value){state.ghosts=value;stage?.setGhosts(value);update();},onDirector:direct,onShare:share,onExport:exportReport});
const outcomeHost=document.createElement("div");ui.stageElement.after(outcomeHost);
stage=createStage(ui.stageElement,{onSelect:select});
stage.setMode(state.mode);stage.setGhosts(state.ghosts);

// Guided presentation changes the selected recorded frame, never the simulation.
let demoGeneration=0;
const director=createDemoController({onMonth:month=>{if(month!==state.month)setMonth(month);},onHighlight(stop){stage.focus(stop.entity,{animate:true});showStory(withContext(entityDescription(stop.entity)));},onExplain(){if(!state.demoExplained){state.demoExplained=true;explainMetric('homes',false);}},onState(demo){state.demo=demo;update();}});
function manualMonth(month){demoGeneration++;director.stop();setPlaying(false);setMonth(month);}
function manualPlay(value){demoGeneration++;director.stop();setPlaying(value);}
function withContext(description){return {...description,summary:`${description.summary} Run ${history?.experimentId??'unavailable'} · ${history?.modelVersion??'unavailable'} · seed ${history?.seed??'unavailable'} · Month ${state.month}. Intervention: ${history?.recipe.intervention?`${history.recipe.intervention.type}, proposed amount ${history.recipe.intervention.amount}, district ${history.recipe.intervention.districtId}, ${history.recipe.intervention.cost.toLocaleString('en-US')} illustrative USD`:'none (matched control)'}.`,limitations:[...(description.limitations||[]),'Synthetic, uncalibrated City model; a controlled model contrast is not empirical causal certainty.']};}
function entityDescription(entity){const detail=describeSelection(frame(),diffs[state.month],entity);const receipts=constructionReceipts(history,entity,state.month);return {...detail,entity:{collection:entity.collection,id:entity.id},evidence:[...detail.evidence,...receipts],summary:detail.summary.replace('No matching entity event was supplied.',receipts.length?'No new event at the selected month; historical completion evidence follows.':'No matching entity event was supplied.')+(receipts.length?` Recorded construction completion at Month ${receipts[0].month} created ${receipts[0].payload.units} homes under ${receipts[0].policyId}; exact model-owned building/project relationship.`:'')};}
function physicalStop(){for(const diff of diffs){const entity=diff.entities?.find(e=>e.physical&&e.collection==='buildings');if(entity)return {month:diff.month,entity:{collection:entity.collection,id:entity.id}};}return null;}
async function playDemo(){const generation=++demoGeneration;director.stop();state.demoExplained=false;setPlaying(false);if(!history||JSON.stringify(history.recipe)!==JSON.stringify(DEFAULT_RECIPE))await run(structuredClone(DEFAULT_RECIPE));if(generation!==demoGeneration||!history||state.status!=='ready'||JSON.stringify(history.recipe)!==JSON.stringify(DEFAULT_RECIPE))return;state.mode='split';stage.setMode('split');stage.resetCamera();director.start(physicalStop());}
function explainMetric(key,stop=true){if(!history)return;if(stop){demoGeneration++;director.stop();setPlaying(false);}const source={homes:'housingUnits',commute:'meanTravelMinutes',spending:'capitalSpending'}[key]||key;const metric=diffs[state.month]?.metrics?.[source];const changed=diffs[state.month]?.entities?.filter(e=>e.physical)||[];const entity=changed.find(e=>e.collection==='buildings')||changed[0];const details=entity?entityDescription({collection:entity.collection,id:entity.id}):{evidence:[],limitations:[]};showStory(withContext({...details,title:`WHY · ${source} · Month ${state.month}`,summary:`WITHOUT PLAN ${metric?.baseline??'unavailable'}; WITH PLAN ${metric?.plan??'unavailable'}; delta ${metric?.delta??'unavailable'} ${metric?.unit??''}. ${details.summary||'No related physical entity event is recorded at this selected month.'} Housing supply changes when the City construction model completes a funded project; entitlement alone does not create homes. Link travel time is a coarse modeled network mean, not individual commute. Spending is cumulative recorded capital expense.`}));}

function configure(recipe){try{state.recipe=validateRecipe(recipe);state.error=null;state.message=history?`Next run configured with seed ${state.recipe.seed}. Displayed results and shared link still refer to saved seed ${history.seed}.`:`Configured seed ${state.recipe.seed}. Fork City runs two matched futures.`;update();}catch(error){state.error=error.message;update();}}
function update(){if(!disposed){ui.update({...state,canRetry:Boolean(lastAttempt)});outcomeTimeline?.update(state.month);}}
function cancel(){demoGeneration++;director.stop();request?.abort();request=null;setPlaying(false);state.status=history?'ready':'idle';state.error=null;state.message='Run cancelled. Any completed comparison remains available.';update();}
function frame(){return history?getFrame(history,state.month):null;}
function showStory(description){storyDispose();const clean=renderStory(ui.storyElement,description,{onJump:jump})||(()=>{});const entity=description.entity;inspectorEntity=entity??null;const trailClean=history&&entity?.id?renderEvidenceTrail(ui.storyElement,history,{...entity,month:state.month},{onJump:jump}):()=>{};storyDispose=()=>{clean();trailClean();};}
function updateURL(){if(!history)return;state.shareURL=createShareURL({recipe:history.recipe,experimentId:history.experimentId,month:state.month},location.href);window.history.replaceState(null,'',state.shareURL);}
function setMonth(month){try{state.month=assertMonth(Number(month));if(history){state.frame=frame();state.diff=diffs[state.month];stage.update(state.frame,state.diff);updateURL();if(inspectorEntity)showStory(withContext(entityDescription(inspectorEntity)));}update();}catch(error){state.error=error.message;update();}}
function setPlaying(value){clearInterval(playTimer);playTimer=null;state.playing=Boolean(value&&history);if(state.playing){if(state.month===MONTHS)setMonth(0);playTimer=setInterval(()=>{if(state.month>=MONTHS)return setPlaying(false);setMonth(state.month+1);},200);}update();}
function select(entity){if(!history)return;director.stop();setPlaying(false);stage.focus(entity);showStory(withContext(entityDescription(entity)));}
function jump(stop){if(!history||!stop)return;demoGeneration++;director.stop();setPlaying(false);setMonth(stop.month);const located=stop.entity?stage.focus(stop.entity):false;const detail=stop.entity?entityDescription(stop.entity):stop;showStory(withContext({...stop,...detail,summary:`${detail.summary}${stop.entity&&!located?' No unambiguous scene mapping for this entity; camera unchanged.':''}`,limitations:story.limitations}));}
function direct(){if(!story)return;director.stop();setPlaying(false);const physical=(story.stops||[]).filter(stop=>stop.entity?.collection==='buildings');const stops=physical.length?physical:story.stops||[];const next=stops.find(stop=>stop.month>state.month)||stops[0];if(next)jump(next);else showStory(story);}
async function run(recipe=state.recipe,savedId=null,selectedMonth=0){
  lastAttempt=[structuredClone(recipe),savedId,selectedMonth];
  director.stop();
  request?.abort();request=new AbortController();const current=request;const start=performance.now();
  setPlaying(false);state={...state,status:'loading',error:null,message:savedId?'Opening saved experiment…':'Running paired 120-month futures…',shareURL:null};update();
  const options={signal:current.signal,onProgress(progress){if(request!==current)return;state.message=progress.message||progress.status;update();}};
  try{
    recipe=validateRecipe(recipe);let loaded;let fallback=false;
    if(savedId){try{loaded=await loadExperiment(savedId,options);}catch(error){if(current.signal.aborted||!/not found/i.test(error.message))throw error;fallback=true;state.message=`Saved experiment unavailable (${error.message}). Recomputing the bounded shared recipe.`;update();loaded=await createExperiment(recipe,options);loaded={...loaded,provenance:{...loaded.provenance,shareFallback:'Saved record unavailable; recomputed from recipe.'}};}}
    else loaded=await createExperiment(recipe,options);
    if(disposed||request!==current)return;
    assertHistoryIdentity(loaded,{recipe,experimentId:fallback?null:savedId});
    stage.dispose();stage=createStage(ui.stageElement,{onSelect:select,history:loaded});stage.setMode(state.mode);stage.setGhosts(state.ghosts);
    inspectorEntity=null;outcomeTimeline?.dispose();outcomeTimeline=createOutcomeTimeline(outcomeHost,{history:loaded,onMonth:manualMonth});
    history=loaded;diffs=compareHistory(history);story=buildStory(history,diffs);story.limitations.push(...(history.baseline[0].state.provenance.assumptions||[]));stats.runMs=performance.now()-start;
    state={...state,status:'ready',recipe:history.recipe,provenance:{seed:history.seed,modelVersion:history.modelVersion,experimentId:history.experimentId},experimentId:history.experimentId,message:`${fallback?'Saved record unavailable; reran the versioned recipe. ':''}120 months complete · detailed states recomputed from the saved monthly City manifest. Synthetic, uncalibrated model.`,error:null};
    state.status='loading';state.message='Preparing synchronized city graphics…';setMonth(selectedMonth);await stage.whenReady();if(disposed||request!==current)return;state.status='ready';state.message=`${fallback?"Saved record unavailable; recomputed from the versioned recipe. ":""}120 recorded months ready · ${stage.getStats().backend} · Synthetic monthly City model.`;update();showStory(withContext(story));stats.readyMs=performance.now()-stats.startedAt;
  }catch(error){if(request!==current||disposed)return;state.status='error';state.error=error.message;state.message=history?'The new comparison could not be opened. The previous completed run remains displayed. Check your connection and Retry comparison.':'The comparison could not be opened. Check your connection and Retry comparison.';update();}
}
async function share(){if(!history)return;updateURL();update();try{await navigator.clipboard.writeText(state.shareURL);state.message='Comparison link copied. It includes the versioned recipe, saved experiment and selected month.';}catch{state.message='Your comparison link is ready below. Copy it to reopen this month.';}update();}
function exportReport(){if(!history)return;const report=createEvidenceReport(history,{month:state.month,diff:diffs[state.month],story});const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='future-machine-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dispose(){if(disposed)return;disposed=true;request?.abort();clearInterval(playTimer);storyDispose();outcomeTimeline?.dispose();stage?.dispose();ui.dispose();director.dispose();history=null;diffs=[];story=null;state.frame=null;state.diff=null;window.removeEventListener('pagehide',dispose);}
window.addEventListener('pagehide',dispose);
window.addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
// Read-only diagnostics for local resource measurements and integration checks.
window.futureMachine={get history(){return history;},get state(){return {...state};},get stats(){return {...stats,scene:stage?.getStats?.()};},dispose};
update();
try{const context=parseShareURL(location.href);if(context)void run(context.recipe,context.experimentId,context.month);else if(new URLSearchParams(location.search).get('demo')==='1')void playDemo();}catch(error){state.status='error';state.error=`Invalid shared comparison: ${error.message}`;state.message='Use Fork City to start a valid bounded comparison.';update();}
