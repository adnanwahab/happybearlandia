import {speedrunScenario,decisionTimer} from './speedrun.js';
const root=document.querySelector('#speedrun');
root.innerHTML=`<h2>Change-One-Thing Speedrun</h2>
<p>One decision, one frozen synthetic neighborhood. Can you reduce housing exclusion?</p>
<p>Authored demo v1 · seed 42 · 6 starting households · 20 monthly City steps · capital cap 5,000 synthetic USD. Starting homes are unavailable, parcel development is blocked and utility capacity is ample. Employment guard is disabled; population and housing guards remain. These are artificial toy assumptions, not measured observations. The challenge title is scripted flavor.</p>
<p>Score: round(100 × clamp((baseline unhoused − candidate unhoused) / 6, 0, 1)). Only a verified improvement earns a local placement. Exact ties have identical scores. No real-world welfare claim.</p>
<p>Optional 60-second practice target. Time never affects score, eligibility or available decisions. No deadline or automatic submission. Pause whenever you like; switching tabs pauses time.</p>
<p data-clock>Decision time: 0 seconds · paused</p>
<div class="actions"><button data-timer>Start timer</button></div>
<fieldset disabled><legend>Choose exactly one supported decision</legend><div data-options></div></fieldset>
<div class="actions"><button data-run disabled>Run one decision</button><button data-cancel disabled>Cancel run</button><button data-reset>Reset attempt</button></div>
<p role="status" data-status>Loading pinned source checkpoint…</p>
<h3>Honest outcome scoreboard · current attempt only</h3><p data-score>No verified run. No placement.</p>
<details><summary>Inspect frozen source and verified receipt</summary><pre data-evidence></pre></details>`;
const $=s=>root.querySelector(s),timer=decisionTimer();
let envelope=null,worker=null,generation=0;
const status=text=>$('[data-status]').textContent=text;
function clock(){const running=timer.running;$('[data-clock]').textContent=`Decision time: ${Math.floor(timer.milliseconds()/1000)} seconds · ${running?'running':'paused'}`;$('[data-timer]').textContent=running?'Pause timer':'Resume timer';}
function clearResult(){ $('[data-score]').textContent='No verified run. No placement.';$('[data-evidence]').textContent=envelope?JSON.stringify(envelope,null,2):'Source unavailable.'; }
function stop(){generation++;worker?.terminate();worker=null;timer.pause();clock();$('[data-cancel]').disabled=true;$('[data-run]').disabled=!envelope;$('fieldset').disabled=!envelope;}
$('[data-timer]').onclick=()=>{timer.running?timer.pause():timer.resume();clock();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){timer.pause();clock();}});
setInterval(clock,500);
$('[data-cancel]').onclick=()=>{stop();clearResult();status('Run cancelled. No score or placement.');};
$('[data-reset]').onclick=()=>{stop();timer.reset();clock();clearResult();for(const input of root.querySelectorAll('input'))input.checked=false;status(envelope?'Choose one decision. The pinned checkpoint is unchanged.':'Source unavailable; reload to retry.');};
root.addEventListener('change',()=>{stop();clearResult();status('Decision changed. Run again to verify.');});
$('[data-run]').onclick=()=>{
 const selection=[...root.querySelectorAll('input:checked')].map(input=>input.value);
 if(selection.length!==1){status('Choose exactly one supported decision.');return;}
 stop();clearResult();const token=generation;
 try{
 worker=new Worker(new URL('./speedrun.worker.js',import.meta.url),{type:'module'});
 $('fieldset').disabled=true;$('[data-run]').disabled=true;$('[data-cancel]').disabled=false;
 status('Running matched-seed baseline and candidate, then checking an independent replay…');
 const fail=message=>{if(token!==generation)return;stop();clearResult();status(`Unavailable: ${message} No score or placement.`);};
 worker.onerror=event=>fail(event.message||'Worker failed.');
 worker.onmessage=({data})=>{
 if(token!==generation)return;
 if(data.type==='ERROR'){fail(data.error);return;}
 if(data.type!=='RESULT')return;
 stop();const r=data.receipt;
 $('[data-score]').textContent=`${r.success?'Verified improvement':'No verified improvement'} · ${r.score}/100 · ${r.placement===null?'No placement':'Local placement 1 of 1 completed attempt'}. Baseline ${r.result.metrics[0].reference}, candidate ${r.result.metrics[0].candidate} unhoused households. Actual capital ${r.result.budget.candidateSpent} synthetic USD. Independent replay matched.`;
 $('[data-evidence]').textContent=JSON.stringify({envelope,receipt:r},null,2);
 status('Complete. These are synthetic modeled outcomes; no measured observations or public ranking.');
 };
 worker.postMessage({envelope,selection});
 }catch(error){stop();clearResult();status(`Unavailable: ${error.message} No score or placement.`);}
};
try{
 envelope=await speedrunScenario();
 for(const action of envelope.actions){const label=document.createElement('label');label.className='policy';const input=document.createElement('input');input.type='radio';input.name='speedrun-decision';input.value=action.id;label.append(input,document.createTextNode(action.label));$('[data-options]').append(label);}
 $('fieldset').disabled=false;$('[data-run]').disabled=false;clearResult();status('Pinned source loaded. Choose one decision; timer starts only if you choose.');
}catch(error){clearResult();status(`Source unavailable: ${error.message} No score or placement.`);}
window.addEventListener('pagehide',stop);
