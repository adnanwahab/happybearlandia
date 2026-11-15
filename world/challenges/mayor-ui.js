import {MAYOR_DECISIONS,MAYOR_VERSION,createMayorChallenge,mayorAllocation,createMayorTimer} from './mayor.js';
import {verifyChallenge} from './contract.js';

const root=document.querySelector('#mayor-mode');
const $=s=>root.querySelector(s);
const timer=createMayorTimer();
let envelope,worker,abort,busy=false;
root.innerHTML=`<p class="eyebrow">GUIDED CHALLENGE · MONTHLY CITY ENGINE</p><h2>Five-minute mayor</h2>
<p>Make three hard trade-offs, then compare twelve modeled months with a no-intervention city. Start here: choose one option in each decision, check your budget, and run.</p>
<p>Synthetic scenario: 30 households, seed 42. Costs and policy amounts are authored game assumptions, not real-world estimates. This creates a separate City run; no World resident IDs or daily clocks are mapped.</p>
<details open><summary>Success rubric — declared before you run</summary><p>Choose exactly three interventions within 25,000 synthetic USD. To win, reduce unhoused households or recorded worker-trip minutes without worsening either beyond its frozen tolerance (0 households; 0.000001 minutes). Retain population and employment and do not increase unhoused households relative to the matched control. Both actual cumulative capital ledgers must stay within the cap (0.000001 USD numerical tolerance). Missing trip observations mean no verdict. Operating costs and private construction are outside the capital cap.</p></details>
<div class="actions"><label><input id="mayor-timed" type="checkbox"> Optional five-minute timer</label><button id="mayor-pause" class="secondary" disabled>Resume timer</button><output id="mayor-clock" aria-label="Time remaining">5:00</output></div><p>Timer expiry is a reminder only. You can pause, disable it, and continue at any time; it never affects success.</p>
<form id="mayor-form">${MAYOR_DECISIONS.map(d=>`<fieldset><legend>${d.title}</legend><p>${d.note}</p>${d.options.map(o=>`<label class="policy"><input type="radio" name="${d.id}" value="${o.id}"><span>${o.label}<small>${o.cost.toLocaleString()} synthetic USD capital</small></span></label>`).join('')}</fieldset>`).join('')}
<p id="mayor-budget" role="status">Choose one option in each decision.</p><div class="actions"><button id="mayor-run" disabled>Run matched futures</button><button id="mayor-cancel" type="button" class="secondary" disabled>Cancel run</button></div></form>
<p id="mayor-status" role="status">Preparing frozen synthetic city…</p><section id="mayor-results" aria-label="Matched mayor outcomes" hidden></section>
<details><summary>Frozen inputs and provenance</summary><pre id="mayor-provenance"></pre></details>`;
const selection=()=>[...root.querySelectorAll('input[type=radio]:checked')].map(n=>n.value);
function update(){
  $('#mayor-results').hidden=true;
  try {const b=mayorAllocation(envelope,selection());$('#mayor-budget').textContent=`Committed ${b.committed.toLocaleString()} / ${envelope.budget.cap.toLocaleString()} synthetic USD · ${b.remaining.toLocaleString()} remaining. ${b.withinCap?'Ready to compare.':'Over budget: choose a smaller intervention.'}`;$('#mayor-run').disabled=busy||!b.withinCap;}
  catch(e){$('#mayor-budget').textContent=e.message;$('#mayor-run').disabled=true;}
}
function lock(value){busy=value;root.querySelectorAll('input[type=radio]').forEach(n=>n.disabled=value);$('#mayor-cancel').disabled=!value;update();}
function show(result){
  const box=$('#mayor-results');box.replaceChildren();box.hidden=false;
  const add=(tag,text,parent=box)=>{const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;};
  add('h3',result.won?'Mayor challenge met':result.status==='metrics-unavailable'?'Outcome unavailable':'Trade-offs to reconsider');
  add('p',`Engine verdict: ${result.status}. These are synthetic modeled outcomes, not forecasts.`);
  const table=add('table',''),head=add('tr','',table);
  for(const title of ['Metric / unit','Control','Your plan','Change'])add('th',title,head).scope='col';
  for(const row of result.metrics){const tr=add('tr','',table);add('th',`${row.label} / ${row.unit}`,tr).scope='row';for(const v of [row.reference,row.candidate,row.delta])add('td',Number.isFinite(v)?String(v):'Unavailable',tr);}
  if(result.status==='metrics-unavailable')add('p','No supported trip observation was recorded. Missing values are not zero and cannot earn success.');
  add('p',`Actual capital: control ${result.budget.referenceSpent}; your plan ${result.budget.candidateSpent}; cap ${result.budget.cap} synthetic USD.`);
  for(const guard of result.guards)add('p',`${guard.id}: ${guard.passed?'passed':'failed'} (control ${guard.reference}, plan ${guard.candidate})`);
  if(result.metrics.every(m=>m.status==='available'&&!m.strictlyBetter&&m.noWorse))add('p','No resolved improvement at this horizon. This does not establish that the interventions have no effect.');
  const details=add('details','');add('summary','Inspect exact outcomes, states and monthly capital ledgers',details);add('pre',JSON.stringify({guideVersion:MAYOR_VERSION,result},null,2),details);
}
$('#mayor-form').addEventListener('change',update);
$('#mayor-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!envelope)return;
  const chosen=selection();try{if(!mayorAllocation(envelope,chosen).withinCap)throw Error('Plan exceeds budget.');}catch(e){$('#mayor-status').textContent=e.message;return;}
  lock(true);timer.pause();running=false;$('#mayor-pause').textContent='Resume timer';$('#mayor-status').textContent='Computing matched futures from the same frozen state…';
  abort=new AbortController();
  try{
    let result;
    if(typeof Worker==='function')result=await new Promise((resolve,reject)=>{
      worker=new Worker(new URL('./verification.worker.js',import.meta.url),{type:'module'});
      abort.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
      worker.onmessage=({data})=>{if(data.type==='RESULT')resolve(data.result);else if(data.type==='ERROR')reject(Error(data.error));else if(data.type==='PROGRESS')$('#mayor-status').textContent=`${data.progress.role}: month ${data.progress.completed} / ${data.progress.total}`;};
      worker.onerror=()=>reject(Error('Simulation worker unavailable. Retry after reloading; no outcome claimed.'));
      worker.postMessage({envelope,selection:chosen});
    });else result=await verifyChallenge(envelope,{selection:chosen},{signal:abort.signal});
    lock(false);show(result);$('#mayor-status').textContent='Comparison complete. Inspect outcomes and evidence below, or revise your choices.';
  }catch(e){lock(false);$('#mayor-status').textContent=e.name==='AbortError'?'Run cancelled. No outcome claimed.':`Mayor mode unavailable: ${e.message}`;}
  finally{worker?.terminate();worker=null;abort=null;}
});
$('#mayor-cancel').onclick=()=>abort?.abort();
let running=false;
$('#mayor-timed').onchange=()=>{running=$('#mayor-timed').checked;if(running)timer.start();else timer.pause();$('#mayor-pause').disabled=!running;$('#mayor-pause').textContent=running?'Pause timer':'Resume timer';};
$('#mayor-pause').onclick=()=>{running=!running;running?timer.start():timer.pause();$('#mayor-pause').textContent=running?'Pause timer':'Resume timer';};
setInterval(()=>{const seconds=Math.ceil(timer.read()/1000);$('#mayor-clock').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}${seconds===0?' · Time is up; continue at your pace.':''}`;},250);
createMayorChallenge().then(value=>{envelope=value;$('#mayor-provenance').textContent=JSON.stringify({guideVersion:MAYOR_VERSION,envelope},null,2);$('#mayor-status').textContent='Frozen terms ready. Choose your three interventions.';update();}).catch(e=>{$('#mayor-status').textContent=`Mayor mode unavailable: ${e.message}`;});
