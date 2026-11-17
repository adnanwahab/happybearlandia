import {DEMO,PLANS,compare,replay} from './model.js';
export function mountSchoolRun(root,{loadSource=async()=>DEMO}={}){
 root.innerHTML=`<h2>School-Run Rush Hour</h2><p>Tame one chaotic morning intersection. Authored synthetic toy: Maple Toy School, synthetic 08:00. No measured traffic observations or real school times. No collision physics or real-world safety claim.</p><p>Eight pupils start together. Main and garden crossings each admit one pupil for 10 seconds. Garden adds 5 seconds of walking. Goal: reduce total queue delay and get everyone across by second 65.</p><label>Safe toy route adjustment <select data-route>${Object.entries(PLANS).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><div class="actions"><button data-run>Run school morning</button><button data-cancel class="secondary" disabled>Cancel school run</button><button data-replay class="secondary" disabled>Verify recorded replay</button></div><p data-status role="status">Pinned demo: synthetic-maple-morning.v1 · school-run.v1 · seed 702. No run yet.</p><div data-trips></div>`;
 const q=s=>root.querySelector(s);let controller=null,record=null,generation=0;
 const clear=()=>{record=null;q('[data-replay]').disabled=true;q('[data-trips]').replaceChildren();};
 const stop=()=>{generation++;controller?.abort();controller=null;q('[data-run]').disabled=false;q('[data-cancel]').disabled=true;};
 q('[data-cancel]').onclick=()=>{stop();clear();q('[data-status]').textContent='Cancelled; no score.';};
 q('[data-route]').onchange=()=>{stop();clear();q('[data-status]').textContent='Route changed; run again for recorded outcomes.';};
 q('[data-run]').onclick=async()=>{
  stop();clear();const ticket=generation;controller=new AbortController();const signal=controller.signal;
  q('[data-run]').disabled=true;q('[data-cancel]').disabled=false;q('[data-status]').textContent='Loading pinned source…';
  try{
   const source=await loadSource({signal});if(ticket!==generation)return;
   const result=compare(source,q('[data-route]').value,{signal});record=result.candidate;
   q('[data-status]').textContent=`${result.success?'Morning solved':'Try another route'} · synthetic executed trips: ${record.trips.length}/8. Queue delay: ${result.baseline.totalDelay} → ${record.totalDelay} seconds. Late: ${record.late}. Seed ${record.seed}. Model ${record.version}.`;
   const list=document.createElement('ul');for(const t of record.trips){const li=document.createElement('li');li.textContent=`${t.id}: ${t.crossing}, crossing ${t.start}–${t.end}s, queue ${t.delay}s${t.late?', late':''}`;list.append(li);}q('[data-trips]').append(list);q('[data-replay]').disabled=false;
  }catch(error){if(ticket===generation){clear();q('[data-status]').textContent=error.message;}}
  finally{if(ticket===generation)stop();}
 };
 q('[data-replay]').onclick=()=>{try{replay(record);q('[data-status]').textContent='Recorded replay verified against all retained trip outcomes · synthetic toy, seed 702.';}catch(error){clear();q('[data-status]').textContent=error.message;}};
 return {destroy(){stop();root.replaceChildren();}};
}
if(typeof document!=='undefined'){const root=document.querySelector('#school-run');if(root)mountSchoolRun(root);}
