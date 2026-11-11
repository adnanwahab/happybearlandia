import { DEFAULT_RECIPE, MONTHS, assertMonth } from './contracts.js';
import { createExperiment, loadExperiment, getFrame, validateRecipe } from './data/index.js';
import { compareHistory } from './diff/index.js';
import { createStage } from './scene/index.js';
import { createUI } from './ui/index.js';
import { buildStory, describeSelection, renderStory } from './story/index.js';
import { createShareURL, parseShareURL, createEvidenceReport, assertHistoryIdentity } from './share/index.js';

const app=document.querySelector('#app');
let history=null,diffs=[],story=null,stage=null,storyDispose=()=>{},request=null,playTimer=null,disposed=false;
let state={status:'idle',message:'Fork the same city. Change one decision. Watch ten modeled years.',recipe:structuredClone(DEFAULT_RECIPE),month:0,playing:false,mode:'split',ghosts:true,experimentId:null,shareURL:null,error:null};
const stats={startedAt:performance.now(),readyMs:null,runMs:null};
app.replaceChildren();
const ui=createUI(app,{onRun:run,onCancel:cancel,onMonth:setMonth,onPlay:setPlaying,onMode(mode){state.mode=mode;stage?.setMode(mode);update();},onGhosts(value){state.ghosts=value;stage?.setGhosts(value);update();},onDirector:direct,onShare:share,onExport:exportReport});
stage=createStage(ui.stageElement,{onSelect:select});
stage.setMode(state.mode);stage.setGhosts(state.ghosts);
function update(){if(!disposed)ui.update(state);}
function cancel(){request?.abort();request=null;setPlaying(false);state.status=history?'ready':'idle';state.error=null;state.message='Run cancelled. Any completed comparison remains available.';update();}
function frame(){return history?getFrame(history,state.month):null;}
function showStory(description){storyDispose();storyDispose=renderStory(ui.storyElement,description,{onJump:jump})||(()=>{});}
function updateURL(){if(!history)return;state.shareURL=createShareURL({recipe:history.recipe,experimentId:history.experimentId,month:state.month},location.href);window.history.replaceState(null,'',state.shareURL);}
function setMonth(month){try{state.month=assertMonth(Number(month));if(history){state.frame=frame();state.diff=diffs[state.month];stage.update(state.frame,state.diff);updateURL();}update();}catch(error){state.error=error.message;update();}}
function setPlaying(value){clearInterval(playTimer);playTimer=null;state.playing=Boolean(value&&history);if(state.playing){if(state.month===MONTHS)setMonth(0);playTimer=setInterval(()=>{if(state.month>=MONTHS)return setPlaying(false);setMonth(state.month+1);},200);}update();}
function select(entity){if(!history)return;setPlaying(false);showStory(describeSelection(frame(),diffs[state.month],entity));}
function jump(stop){if(!history||!stop)return;setPlaying(false);setMonth(stop.month);const located=stop.entity?stage.focus(stop.entity):false;showStory({...stop,summary:`${stop.summary}${stop.entity&&!located?' No unambiguous scene mapping for this entity; camera unchanged.':''}`,limitations:story.limitations});}
function direct(){if(!story)return;setPlaying(false);const stops=story.stops||[];const next=stops.find(stop=>stop.month>state.month)||stops[0];if(next)jump(next);else showStory(story);}
async function run(recipe=state.recipe,savedId=null,selectedMonth=0){
  request?.abort();request=new AbortController();const current=request;const start=performance.now();
  setPlaying(false);state={...state,status:'loading',error:null,message:savedId?'Opening saved experiment…':'Running paired 120-month futures…',shareURL:null};update();
  const options={signal:current.signal,onProgress(progress){if(request!==current)return;state.message=progress.message||progress.status;update();}};
  try{
    recipe=validateRecipe(recipe);let loaded;let fallback=false;
    if(savedId){try{loaded=await loadExperiment(savedId,options);}catch(error){if(current.signal.aborted||!/not found/i.test(error.message))throw error;fallback=true;state.message=`Saved experiment unavailable (${error.message}). Recomputing the bounded shared recipe.`;update();loaded=await createExperiment(recipe,options);loaded={...loaded,provenance:{...loaded.provenance,shareFallback:'Saved record unavailable; recomputed from recipe.'}};}}
    else loaded=await createExperiment(recipe,options);
    if(disposed||request!==current)return;
    assertHistoryIdentity(loaded,{recipe,experimentId:fallback?null:savedId});
    stage.dispose();stage=createStage(ui.stageElement,{onSelect:select});stage.setMode(state.mode);stage.setGhosts(state.ghosts);
    history=loaded;diffs=compareHistory(history);story=buildStory(history,diffs);story.limitations.push(...(history.baseline[0].state.provenance.assumptions||[]));stats.runMs=performance.now()-start;
    state={...state,status:'ready',recipe:history.recipe,experimentId:history.experimentId,message:`${fallback?'Saved record unavailable; reran the versioned recipe. ':''}120 months complete · detailed states recomputed from the saved monthly City manifest. Synthetic, uncalibrated model.`,error:null};
    setMonth(selectedMonth);showStory(story);stats.readyMs=performance.now()-stats.startedAt;
  }catch(error){if(request!==current||disposed)return;state.status='error';state.error=error.message;state.message='The comparison could not be opened. Check the inputs and use Fork City to retry.';update();}
}
async function share(){if(!history)return;updateURL();update();try{await navigator.clipboard.writeText(state.shareURL);state.message='Comparison link copied. It includes the versioned recipe, saved experiment and selected month.';}catch{state.message='Your comparison link is ready below. Copy it to reopen this month.';}update();}
function exportReport(){if(!history)return;const report=createEvidenceReport(history,{month:state.month,diff:diffs[state.month],story});const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='future-machine-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dispose(){if(disposed)return;disposed=true;request?.abort();clearInterval(playTimer);storyDispose();stage?.dispose();ui.dispose();window.removeEventListener('pagehide',dispose);}
window.addEventListener('pagehide',dispose);
window.addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
// Read-only diagnostics for local resource measurements and integration checks.
window.futureMachine={get history(){return history;},get state(){return {...state};},get stats(){return {...stats,scene:stage?.getStats?.()};},dispose};
update();
try{const context=parseShareURL(location.href);if(context)void run(context.recipe,context.experimentId,context.month);}catch(error){state.status='error';state.error=`Invalid shared comparison: ${error.message}`;state.message='Use Fork City to start a valid bounded comparison.';update();}
