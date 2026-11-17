import {CHOICES, OBJECTIVES, validateDrill, runDrill, replayDrill} from './crisis.js';
const root=document.querySelector('#crisis-drill');
root.innerHTML=`<h2>Crisis Judgment Drill</h2><p><b>Scripted briefing:</b> Riverside faces an authored flood at month 10. Choose one preparedness response before inspecting the modeled outcomes at month 12. This coarse monthly toy cannot model immediate rescue.</p><p><b>Preregistered objectives:</b> ${OBJECTIVES}</p><p>Synthetic City toy model · authored seeds 42, 73, 101 · measured observations: unavailable. Three seeds are not event probabilities. Unmodeled care, distribution, emergency response and structural uncertainty remain unknown. Equal endpoints can hide different paths and costs; meeting these objectives does not establish the best response.</p><fieldset><legend>Choose one bounded response</legend>${CHOICES.map((c,i)=>`<label class="policy"><input type="radio" name="crisis-choice" value="${c.id}" ${i===0?'checked':''}><span><strong>${c.label}</strong><small>${c.detail}</small></span></label>`).join('')}</fieldset><div class="actions"><button id="crisis-load">Load pinned demo</button><button id="crisis-run" disabled>Commit decision and inspect</button><button id="crisis-alternative" disabled>Review alternative</button><button id="crisis-cancel" disabled>Cancel pending run</button></div><p id="crisis-status" role="status">No source data loaded. No outcomes inferred.</p><ol id="crisis-history" aria-label="Immutable session decisions"></ol><p>Completed decisions stay in this page session. Alternative reviews never replace them. Reload ends the session; nothing is uploaded or saved.</p>`;
const get=id=>root.querySelector('#crisis-'+id), history=get('history');
let scenario=null, controller=null, decisions=0;
function controls(){const busy=!!controller;get('load').disabled=busy;get('run').disabled=busy||!scenario;get('alternative').disabled=busy||!scenario||decisions===0;get('cancel').disabled=!busy;root.querySelectorAll('input').forEach(i=>i.disabled=busy);root.querySelectorAll('[data-replay]').forEach(b=>b.disabled=busy);}
get('load').onclick=async()=>{
  controller=new AbortController();controls();get('status').textContent='Loading pinned source…';
  try{const response=await fetch('./challenges/crisis-demo.v1.json',{signal:controller.signal});if(!response.ok)throw Error('Pinned source unavailable.');const checked=await validateDrill(await response.json());if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');scenario=checked;get('status').textContent='Pinned demo ready. Objectives frozen before your decision.';}
  catch(error){scenario=null;get('status').textContent=error.name==='AbortError'?'Cancelled. No source or result inferred.':`No source data: ${error.message}`;}
  finally{controller=null;controls();}
};
function append(receipt,kind){
  const li=document.createElement('li');
  const title=document.createElement('h3');title.textContent=`${kind}: ${CHOICES.find(c=>c.id===receipt.choice).label}`;li.append(title);
  const note=document.createElement('p');note.textContent=receipt.uncertainty;li.append(note);
  const table=document.createElement('table');
  table.innerHTML='<caption>Matched reserve → response at month 12</caption><thead><tr><th>Seed</th><th>Unhoused households</th><th>Commute minutes</th><th>Capital USD</th><th>Objectives</th></tr></thead>';
  const body=document.createElement('tbody');
  for(const run of receipt.runs){const tr=document.createElement('tr');const [housing,commute]=run.result.metrics;for(const value of [run.seed,...[housing,commute].map(m=>m.status==='available'?`${m.reference.toFixed(2)} → ${m.candidate.toFixed(2)}`:'Unavailable'),run.result.budget.candidateSpent,run.grade.status]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);}table.append(body);
  const scroll=document.createElement('div');scroll.className='crisis-table';scroll.append(table);li.append(scroll);
  const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect immutable receipt and initial/final checkpoints';pre.textContent=JSON.stringify(receipt,null,2);details.append(summary,pre);li.append(details);
  const replay=document.createElement('button');replay.textContent='Repeat same seeds and verify';replay.dataset.replay='true';replay.onclick=()=>execute(()=>replayDrill(receipt,{signal:controller.signal}),false);li.append(replay);history.append(li);
}
async function execute(work,kind){controller=new AbortController();controls();get('status').textContent='Running matched synthetic branches…';try{const receipt=await work();if(kind)append(receipt,kind);if(kind==='Decision')decisions++;get('status').textContent=kind?'Completed. Inspect objective checks and limitations; no moral certainty claimed.':'Replay verified against the entire immutable receipt. History retained.';}
catch(error){get('status').textContent=error.name==='AbortError'?'Cancelled. No completed decision or alternative recorded. History retained.':`No verified result: ${error.message}`;}finally{controller=null;controls();}}
const choice=()=>root.querySelector('input:checked').value;
get('run').onclick=()=>execute(()=>runDrill(scenario,choice(),{signal:controller.signal}),'Decision');
get('alternative').onclick=()=>execute(()=>runDrill(scenario,choice(),{signal:controller.signal}),'Alternative review');
get('cancel').onclick=()=>controller?.abort();
