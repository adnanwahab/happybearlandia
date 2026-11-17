import { mountMystery } from './rashomon-mystery.js';
mountMystery(document.querySelector('#rashomon'));
const $=s=>document.querySelector(s);let id,receiptURL,busy=false;
async function request(path,body){const response=await fetch('/api/detective'+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}
async function action(work){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');try{$('#status').textContent='Loading…';await work();$('#status').textContent='Ready. This URL reopens your saved puzzle.';}catch(e){$('#status').textContent=e.message;}finally{busy=false;document.body.removeAttribute('aria-busy');}}
function reveal(r){$('#reveal').textContent=`${r.correct?'Correct':'Incorrect'} — ${r.answer}\nEvidence steps: ${r.evidenceSteps}. Score: ${r.score}/95.\nFrozen evidence SHA-256: ${r.graphHash??'Legacy reveal'}\nRecipe SHA-256: ${r.recipeHash}`;$('#submit').disabled=true;if(receiptURL)URL.revokeObjectURL(receiptURL);receiptURL=URL.createObjectURL(new Blob([JSON.stringify(r.receipt,null,2)],{type:'application/json'}));$('#download').href=receiptURL;$('#download').download='matched-run-receipt.json';$('#download').hidden=false;}
async function load(){const p=await request('/'+id);$('main').hidden=false;$('#outcome').textContent=`${p.outcome.homes} homes · mean unit rent ${p.outcome.meanRent.toFixed(2)} USD/month`;$('#count').textContent=`${p.evidenceSteps} distinct evidence steps`;$('#evidence').textContent='';$('#reveal').textContent='';$('#download').hidden=true;$('#submit').disabled=false;$('#answers').replaceChildren(Object.assign(document.createElement('legend'),{textContent:'Which authorization explains the extra homes?'}));for(const c of p.choices){const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='choice';input.value=c.id;label.append(input,document.createTextNode(c.label));$('#answers').append(label);}if(p.reveal)reveal(p.reveal);}
$('#new').onclick=()=>action(async()=>{const p=await request('',{caseIndex:Number($('#case').value)});id=p.experimentId;history.replaceState(null,'','?experiment='+encodeURIComponent(id));await load();});
for(const b of document.querySelectorAll('[data-step]'))b.onclick=()=>action(async()=>{const p=await request('/'+id+'/evidence',{step:b.dataset.step});$('#count').textContent=`${p.evidenceSteps} distinct evidence steps`;renderEvidence(p);});
$('#submit').onclick=()=>action(async()=>{const c=$('input[name=choice]:checked');if(!c)throw Error('Choose an answer first.');reveal(await request('/'+id+'/answer',{choiceId:c.value}));$('#reveal').focus();});
const params=new URLSearchParams(location.search);id=params.get('experiment');if(id)action(load);

function renderEvidence({step,evidence,limits}) {
 const notebook=$('#evidence');notebook.replaceChildren();
 const line=text=>{const p=document.createElement('p');p.textContent=text;notebook.append(p);};
 line('Frozen records · '+step);
 if(step==='inventory')line(`Month ${evidence.month}: baseline ${evidence.baselineHomes} homes; future ${evidence.hiddenFutureHomes} homes.`);
 if(step==='completion'){
  if(!evidence.recordedCompletions.length)line('Completion records unavailable. Try the inventory and WHY trail.');
  for(const e of evidence.recordedCompletions)line(`Plan event ${e.eventId} · month ${e.month} · ${e.homes} completed homes.`);
 }
 if(step==='trail'){
  if(!evidence.nodes?.length)line('WHY trail unavailable. Try the inventory and completion records.');
  for(const n of evidence.nodes??[])line(`${n.arm} · ${n.type} · ${n.month===null?'month unavailable':'month '+n.month} · ${n.entity?.id??'identity unavailable'}${n.eventId?' · event '+n.eventId:''}${n.homes!==null?' · '+n.homes+' homes':''}: ${n.unavailableReason??'recorded'}`);
  for(const e of evidence.relationships??[])line(`${e.from} → ${e.to}: ${e.relationship}. ${e.unavailableReason??e.status}`);
 }
 line(limits);
}
